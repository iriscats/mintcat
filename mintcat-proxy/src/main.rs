mod cert;
mod config;
mod dns;
mod hosts;
mod proxy;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use std::sync::Arc;
use tracing_subscriber::fmt::MakeWriter;

#[derive(Clone)]
struct FileLogWriter {
    path: Arc<PathBuf>,
}

impl<'a> MakeWriter<'a> for FileLogWriter {
    type Writer = std::fs::File;

    fn make_writer(&'a self) -> Self::Writer {
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.path.as_ref())
            .expect("failed to open mintcat-proxy log file")
    }
}

#[derive(Parser)]
#[command(
    name = "mintcat-proxy",
    about = "Cross-platform Steam acceleration CLI tool"
)]
struct Cli {
    /// Override data directory for certificates and cached rules
    #[arg(long, global = true)]
    data_dir: Option<PathBuf>,
    /// Write logs to a file instead of stderr
    #[arg(long, global = true)]
    log_file: Option<PathBuf>,
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the acceleration proxy
    Start {
        /// HTTPS listen port
        #[arg(short, long, default_value = "443")]
        port: u16,
        /// Use cached rules only, don't fetch from API
        #[arg(long)]
        offline: bool,
        /// Bind address
        #[arg(long, default_value = "0.0.0.0")]
        bind: String,
        /// Install CA certificate to system trust store before serving
        #[arg(long)]
        install_cert: bool,
    },
    /// Stop acceleration (cleanup hosts file, optionally terminate a proxy process)
    Stop {
        /// Proxy process id to terminate after cleanup
        #[arg(long)]
        pid: Option<u32>,
    },
    /// Terminate a running proxy process by PID
    Kill {
        /// Proxy process id to terminate
        #[arg(long)]
        pid: u32,
    },
    /// Manage CA root certificate
    Cert {
        #[command(subcommand)]
        action: CertAction,
    },
    /// Show current acceleration rules
    Rules {
        /// Force refresh from API
        #[arg(long)]
        refresh: bool,
    },
}

#[derive(Subcommand)]
enum CertAction {
    /// Install CA certificate to system trust store
    Install,
    /// Uninstall CA certificate from system trust store
    Uninstall,
}

#[tokio::main]
async fn main() -> Result<()> {
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("failed to install rustls crypto provider");

    let cli = Cli::parse();
    init_logging(cli.log_file.clone())?;
    let data_dir = cli.data_dir.unwrap_or_else(config::data_dir);

    match cli.command {
        Commands::Start {
            port,
            offline,
            bind,
            install_cert,
        } => cmd_start(port, offline, bind, install_cert, &data_dir).await,
        Commands::Stop { pid } => cmd_stop(pid),
        Commands::Kill { pid } => cmd_kill(pid),
        Commands::Cert { action } => cmd_cert(action, &data_dir),
        Commands::Rules { refresh } => cmd_rules(refresh, &data_dir).await,
    }
}

fn init_logging(log_file: Option<PathBuf>) -> Result<()> {
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

    if let Some(path) = log_file {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .with_ansi(false)
            .with_writer(FileLogWriter {
                path: Arc::new(path),
            })
            .init();
        return Ok(());
    }

    tracing_subscriber::fmt().with_env_filter(env_filter).init();
    Ok(())
}

async fn cmd_start(
    port: u16,
    offline: bool,
    bind: String,
    install_cert: bool,
    data_dir: &std::path::Path,
) -> Result<()> {
    let cert_mgr = Arc::new(
        cert::CertManager::new_or_load(data_dir)
            .context("failed to initialize certificate manager")?,
    );
    if install_cert {
        cert_mgr
            .install_ca_trust()
            .context("failed to install CA certificate")?;
    }

    // Fetch or load acceleration rules
    let groups = if offline {
        tracing::info!("offline mode: loading cached rules");
        config::WattApiClient::load_cache(data_dir)?
    } else {
        let api_client = config::WattApiClient::new();
        match api_client.fetch_all().await {
            Ok(groups) => {
                config::WattApiClient::save_cache(data_dir, &groups)?;
                groups
            }
            Err(e) => {
                tracing::warn!("failed to fetch from API: {}, trying cache", e);
                config::WattApiClient::load_cache(data_dir)
                    .context("no cached rules available and API fetch failed")?
            }
        }
    };

    let mut domain_configs = config::flatten_projects(&groups);

    config::custom_rules_path(data_dir);
    let mut custom = config::load_custom_rules(data_dir);

    if let Some(exe_dir) = config::exe_dir() {
        if exe_dir.as_path() != data_dir {
            let exe_custom = config::load_custom_rules(&exe_dir);
            custom.extend(exe_custom);
        }
    }

    if !custom.is_empty() {
        domain_configs.extend(custom);
    }

    tracing::info!("loaded {} total acceleration rules", domain_configs.len());

    if domain_configs.is_empty() {
        anyhow::bail!("no acceleration rules found. Run `mintcat-proxy rules --refresh` first.");
    }

    // Print summary
    for c in &domain_configs {
        let target = if let Some(ip) = &c.forward_ip {
            format!("-> IP {}", ip)
        } else if let Some(d) = &c.forward_domain {
            format!("-> domain {}", d)
        } else if let Some(u) = &c.destination_url {
            format!("-> URL {}", u)
        } else {
            "-> (DoH fallback)".to_string()
        };
        tracing::debug!("  [{}] {} {}", c.name, c.listen_domains.join(", "), target);
    }

    // Update hosts file
    let proxy_ip = if bind == "0.0.0.0" {
        "127.0.0.1".to_string()
    } else {
        bind.clone()
    };

    let host_entries: Vec<(String, String)> = domain_configs
        .iter()
        .flat_map(|c| {
            c.listen_domains
                .iter()
                .map(|d| (d.clone(), proxy_ip.clone()))
        })
        .collect();

    if !host_entries.is_empty() {
        hosts::update_hosts(&host_entries)
            .context("failed to update hosts file. Try running with sudo.")?;
        tracing::info!(
            "hosts file updated with {} domain entries",
            host_entries.len()
        );
    }

    // Setup cleanup on Ctrl+C / termination
    let cleanup_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let cleanup_flag2 = cleanup_flag.clone();
    ctrlc::set_handler(move || {
        if !cleanup_flag2.load(std::sync::atomic::Ordering::SeqCst) {
            cleanup_flag2.store(true, std::sync::atomic::Ordering::SeqCst);
            tracing::info!("shutting down, cleaning up hosts...");
            if let Err(e) = hosts::cleanup_hosts() {
                tracing::error!("failed to cleanup hosts: {}", e);
            }
            std::process::exit(0);
        }
    })?;

    // Build TLS config
    let tls_config = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_cert_resolver(cert_mgr);

    let tls_acceptor = tokio_rustls::TlsAcceptor::from(Arc::new(tls_config));

    let listener = tokio::net::TcpListener::bind(format!("{}:{}", bind, port))
        .await
        .with_context(|| {
            format!(
                "failed to bind {}:{}. Port in use or need sudo?",
                bind, port
            )
        })?;

    tracing::info!("mintcat-proxy listening on {}:{}", bind, port);
    tracing::info!("press Ctrl+C to stop");

    let configs = Arc::new(domain_configs);
    let doh = Arc::new(dns::DohResolver::new());

    let upstream_client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .no_proxy()
        .timeout(std::time::Duration::from_secs(30))
        .dns_resolver(Arc::new(dns::ReqwestDohResolver(doh)))
        .build()?;

    loop {
        let (tcp_stream, peer_addr) = listener.accept().await?;
        let tls_acceptor = tls_acceptor.clone();
        let configs = configs.clone();
        let upstream_client = upstream_client.clone();

        tokio::spawn(async move {
            let tls_stream = match tls_acceptor.accept(tcp_stream).await {
                Ok(s) => s,
                Err(e) => {
                    tracing::debug!("TLS handshake failed from {}: {}", peer_addr, e);
                    return;
                }
            };

            let io = hyper_util::rt::TokioIo::new(tls_stream);
            let service = hyper::service::service_fn(move |req| {
                let configs = configs.clone();
                let client = upstream_client.clone();
                async move { proxy::handle_request(req, configs, client).await }
            });

            if let Err(e) =
                hyper_util::server::conn::auto::Builder::new(hyper_util::rt::TokioExecutor::new())
                    .serve_connection(io, service)
                    .await
            {
                tracing::debug!("connection error from {}: {}", peer_addr, e);
            }
        });
    }
}

fn cmd_stop(pid: Option<u32>) -> Result<()> {
    hosts::cleanup_hosts().context("failed to cleanup hosts file")?;
    if let Some(pid) = pid {
        cmd_kill(pid)?;
    }
    tracing::info!("hosts file cleaned up. Proxy stopped.");
    Ok(())
}

fn cmd_kill(pid: u32) -> Result<()> {
    if pid == 0 {
        anyhow::bail!("invalid proxy process id");
    }

    #[cfg(target_os = "windows")]
    {
        let status = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status()
            .context("failed to run taskkill")?;
        if !status.success() {
            anyhow::bail!("taskkill failed (exit {})", status);
        }
        tracing::info!("terminated proxy process {}", pid);
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let status = std::process::Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .status()
            .context("failed to send SIGTERM")?;
        if !status.success() {
            anyhow::bail!("kill -TERM failed (exit {})", status);
        }

        for _ in 0..20 {
            if !process_exists(pid) {
                tracing::info!("terminated proxy process {}", pid);
                return Ok(());
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }

        let status = std::process::Command::new("kill")
            .args(["-KILL", &pid.to_string()])
            .status()
            .context("failed to send SIGKILL")?;
        if !status.success() {
            anyhow::bail!("kill -KILL failed (exit {})", status);
        }
        tracing::info!("force terminated proxy process {}", pid);
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
fn process_exists(pid: u32) -> bool {
    std::process::Command::new("kill")
        .args(["-0", &pid.to_string()])
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn cmd_cert(action: CertAction, data_dir: &std::path::Path) -> Result<()> {
    let cert_mgr = cert::CertManager::new_or_load(data_dir)?;
    match action {
        CertAction::Install => {
            cert_mgr.install_ca_trust()?;
            println!("CA certificate installed successfully.");
            println!("Location: {}", cert_mgr.ca_pem_path().display());
        }
        CertAction::Uninstall => {
            cert_mgr.uninstall_ca_trust()?;
            println!("CA certificate uninstalled.");
        }
    }
    Ok(())
}

async fn cmd_rules(refresh: bool, data_dir: &std::path::Path) -> Result<()> {
    let groups = if refresh {
        let client = config::WattApiClient::new();
        let groups = client.fetch_all().await?;
        config::WattApiClient::save_cache(data_dir, &groups)?;
        groups
    } else {
        match config::WattApiClient::load_cache(data_dir) {
            Ok(g) => g,
            Err(_) => {
                println!("No cached rules. Fetching from API...");
                let client = config::WattApiClient::new();
                let groups = client.fetch_all().await?;
                config::WattApiClient::save_cache(data_dir, &groups)?;
                groups
            }
        }
    };

    let mut configs = config::flatten_projects(&groups);
    let mut custom = config::load_custom_rules(data_dir);

    if let Some(exe_dir) = config::exe_dir() {
        if exe_dir.as_path() != data_dir {
            let exe_custom = config::load_custom_rules(&exe_dir);
            custom.extend(exe_custom);
        }
    }

    if !custom.is_empty() {
        println!("Custom rules ({} entries):", custom.len());
        configs.extend(custom);
    }
    println!("Acceleration rules ({} entries):\n", configs.len());

    for c in &configs {
        let target = if let Some(ip) = &c.forward_ip {
            format!("IP {}", ip)
        } else if let Some(d) = &c.forward_domain {
            format!("Domain {}", d)
        } else if let Some(u) = &c.destination_url {
            format!("URL {}", u)
        } else {
            "(DoH fallback)".to_string()
        };

        let proxy_type = if c.is_server_proxy {
            "ServerAccelerate"
        } else if c.destination_url.is_some() {
            "Redirect"
        } else {
            "Local"
        };

        println!(
            "  [{}] {} -> {} (type: {})",
            c.name,
            c.listen_domains.join(", "),
            target,
            proxy_type,
        );
    }

    Ok(())
}
