use std::convert::TryInto;
use std::sync::Arc;

use ::reqwest::Proxy;
use http::header::USER_AGENT;
use http::header::{HeaderMap, HeaderValue};
use reqwest_middleware::ClientWithMiddleware as Client;
use tracing::info;
use crate::auth::{Auth, Credentials, Token};
use crate::download::{DownloadAction, Downloader};
use crate::error::{self, Error, Result};
use crate::games::{GameRef, Games};
use crate::mods::ModRef;
use crate::reports::Reports;
use crate::request::RequestBuilder;
use crate::routing::Route;
use crate::user::Me;
use crate::{TargetPlatform, TargetPortal};


const PROXY_HOST: &str = "https://api.v1st.net/https://api.mod.io/v1";
const DEFAULT_HOST: &str = "https://api.mod.io/v1";

const TEST_HOST: &str = "https://api.test.mod.io/v1";

/// A `Builder` can be used to create a `Modio` client with custom configuration.
#[must_use]
pub struct Builder {
    config: Config,
}

impl TargetPlatform {
    #[inline]
    fn header_name() -> &'static str {
        "X-Modio-Platform"
    }

    fn into_header_value(self) -> HeaderValue {
        match self {
            Self::Android => HeaderValue::from_static("Android"),
            Self::Ios => HeaderValue::from_static("iOS"),
            Self::Linux => HeaderValue::from_static("Linux"),
            Self::Mac => HeaderValue::from_static("Mac"),
            Self::Windows => HeaderValue::from_static("Windows"),
            Self::PS4 => HeaderValue::from_static("PS4"),
            Self::PS5 => HeaderValue::from_static("PS5"),
            Self::Switch => HeaderValue::from_static("Switch"),
            Self::XboxOne => HeaderValue::from_static("XboxOne"),
            Self::XboxSeriesX => HeaderValue::from_static("XboxSeriesX"),
            Self::Oculus => HeaderValue::from_static("Oculus"),
        }
    }
}

impl TargetPortal {
    #[inline]
    fn header_name() -> &'static str {
        "X-Modio-Portal"
    }

    fn into_header_value(self) -> HeaderValue {
        match self {
            Self::Steam => HeaderValue::from_static("Steam"),
            Self::GOG => HeaderValue::from_static("GOG"),
            Self::EGS => HeaderValue::from_static("EGS"),
            Self::Itchio => HeaderValue::from_static("Itchio"),
            Self::Nintendo => HeaderValue::from_static("Nintendo"),
            Self::PSN => HeaderValue::from_static("PSN"),
            Self::XboxLive => HeaderValue::from_static("XboxLive"),
            Self::Apple => HeaderValue::from_static("Apple"),
            Self::Google => HeaderValue::from_static("Google"),
            Self::Facebook => HeaderValue::from_static("Facebook"),
            Self::Discord => HeaderValue::from_static("Discord"),
        }
    }
}

struct Config {
    host: Option<String>,
    credentials: Credentials,
    client: Client,
    headers: HeaderMap,
    proxies: Vec<Proxy>,
    #[cfg(feature = "__tls")]
    tls: TlsBackend,
    error: Option<Error>,
}

#[cfg(feature = "__tls")]
enum TlsBackend {
    #[cfg(feature = "default-tls")]
    Default,
    #[cfg(feature = "rustls-tls")]
    Rustls,
}

#[cfg(feature = "__tls")]
impl Default for TlsBackend {
    fn default() -> TlsBackend {
        #[cfg(feature = "default-tls")]
        {
            TlsBackend::Default
        }
        #[cfg(all(feature = "rustls-tls", not(feature = "default-tls")))]
        {
            TlsBackend::Rustls
        }
    }
}

impl Builder {
    /// Constructs a new `Builder`.
    ///
    /// This is the same as `Modio::builder(credentials)`.
    pub fn new<C: Into<Credentials>>(credentials: C, client: Client) -> Builder {
        Builder {
            config: Config {
                host: None,
                credentials: credentials.into(),
                client,
                headers: HeaderMap::new(),
                proxies: Vec::new(),
                #[cfg(feature = "__tls")]
                tls: TlsBackend::default(),
                error: None,
            },
        }
    }

    /// Returns a `Modio` client that uses this `Builder` configuration.
    pub fn build(self) -> Result<Modio> {
        use reqwest::blocking::Client;
        use std::time::Duration;

        let config = self.config;
        if let Some(e) = config.error {
            return Err(e);
        }

        let client = Client::new();
        let mut host = config.host.unwrap_or_else(|| DEFAULT_HOST.to_string());
        let resp = client.get(DEFAULT_HOST)
            .timeout(Duration::from_secs(2))
            .send();

        match resp {
            Ok(_) => {}
            Err(_) => {
                host = PROXY_HOST.parse().unwrap();
                info!("Use MintCat Proxy Server Connect mod.io!");
            }
        }
       

        let credentials = config.credentials;

        Ok(Modio {
            inner: Arc::new(ClientRef {
                host,
                client: config.client,
                credentials,
            }),
        })
    }

    /// Set the mod.io api host.
    ///
    /// Defaults to `"https://api.mod.io/v1"`
    pub fn host<S: Into<String>>(mut self, host: S) -> Builder {
        self.config.host = Some(host.into());
        self
    }

    /// Use the mod.io api test host.
    pub fn use_test(mut self) -> Builder {
        self.config.host = Some(TEST_HOST.into());
        self
    }

    /// Set the user agent used for every request.
    ///
    /// Defaults to `"modio/{version}"`
    pub fn user_agent<V>(mut self, value: V) -> Builder
    where
        V: TryInto<HeaderValue>,
        V::Error: Into<http::Error>,
    {
        match value.try_into() {
            Ok(value) => {
                self.config.headers.insert(USER_AGENT, value);
            }
            Err(e) => {
                self.config.error = Some(error::builder(e.into()));
            }
        }
        self
    }

    /// Add a `Proxy` to the list of proxies the client will use.
    pub fn proxy(mut self, proxy: Proxy) -> Builder {
        self.config.proxies.push(proxy);
        self
    }

    /// Set the target platform.
    ///
    /// See the [mod.io docs](https://docs.mod.io/#targeting-a-platform) for more information.
    pub fn target_platform(mut self, platform: TargetPlatform) -> Builder {
        let name = TargetPlatform::header_name();
        let value = platform.into_header_value();
        self.config.headers.insert(name, value);
        self
    }

    /// Set the target portal.
    ///
    /// See the [mod.io docs](https://docs.mod.io/#targeting-a-portal) for more information.
    pub fn target_portal(mut self, portal: TargetPortal) -> Builder {
        let name = TargetPortal::header_name();
        let value = portal.into_header_value();
        self.config.headers.insert(name, value);
        self
    }

    /// Use native TLS backend.
    #[cfg(feature = "default-tls")]
    pub fn use_default_tls(mut self) -> Builder {
        self.config.tls = TlsBackend::Default;
        self
    }

    /// Use rustls TLS backend.
    #[cfg(feature = "rustls-tls")]
    pub fn use_rustls_tls(mut self) -> Builder {
        self.config.tls = TlsBackend::Rustls;
        self
    }
}

/// Endpoint interface to interacting with the [mod.io](https://mod.io) API.
#[derive(Clone, Debug)]
pub struct Modio {
    pub(crate) inner: Arc<ClientRef>,
}

#[derive(Debug)]
pub(crate) struct ClientRef {
    pub(crate) host: String,
    pub(crate) client: Client,
    pub(crate) credentials: Credentials,
}

impl Modio {
    /// Constructs a new `Builder` to configure a `Modio` client.
    ///
    /// This is the same as `Builder::new(credentials)`.
    pub fn builder<C: Into<Credentials>>(credentials: C, client: Client) -> Builder {
        Builder::new(credentials, client)
    }

    /// Create an endpoint to [https://api.mod.io/v1](https://docs.mod.io/#mod-io-api-v1).
    pub fn new<C>(credentials: C, client: Client) -> Result<Self>
    where
        C: Into<Credentials>,
    {
        Builder::new(credentials, client).build()
    }

    /// Create an endpoint to a different host.
    pub fn host<H, C>(host: H, credentials: C, client: Client) -> Result<Self>
    where
        H: Into<String>,
        C: Into<Credentials>,
    {
        Builder::new(credentials, client).host(host).build()
    }

    /// Return an endpoint with new credentials.
    #[must_use]
    pub fn with_credentials<CR>(&self, credentials: CR) -> Self
    where
        CR: Into<Credentials>,
    {
        Self {
            inner: Arc::new(ClientRef {
                host: self.inner.host.clone(),
                client: self.inner.client.clone(),
                credentials: credentials.into(),
            }),
        }
    }

    /// Return an endpoint with a new token.
    #[must_use]
    pub fn with_token<T>(&self, token: T) -> Self
    where
        T: Into<Token>,
    {
        Self {
            inner: Arc::new(ClientRef {
                host: self.inner.host.clone(),
                client: self.inner.client.clone(),
                credentials: Credentials {
                    api_key: self.inner.credentials.api_key.clone(),
                    token: Some(token.into()),
                },
            }),
        }
    }

    /// Return a reference to an interface for requesting access tokens.
    pub fn auth(&self) -> Auth {
        Auth::new(self.clone())
    }

    /// Return a reference to an interface that provides access to game information.
    pub fn games(&self) -> Games {
        Games::new(self.clone())
    }

    /// Return a reference to a game.
    pub fn game(&self, game_id: u32) -> GameRef {
        GameRef::new(self.clone(), game_id)
    }

    /// Return a reference to a mod.
    pub fn mod_(&self, game_id: u32, mod_id: u32) -> ModRef {
        ModRef::new(self.clone(), game_id, mod_id)
    }

    /// Returns [`Downloader`] for saving to file or retrieving
    /// the data via [`Stream`].
    ///
    /// The download fails with [`modio::download::Error`] as source
    /// if a primary file, a specific file or a specific version is not found.
    ///
    /// [`Downloader`]: crate::download::Downloader
    /// [`modio::download::Error`]: crate::download::Error
    /// [`Stream`]: futures_core::Stream
    ///
    /// # Example
    /// ```no_run
    /// use futures_util::{future, TryStreamExt};
    /// use modio::download::{DownloadAction, ResolvePolicy};
    /// # async fn run() -> Result<(), Box<dyn std::error::Error>> {
    /// #    let modio = modio::Modio::new("user-or-game-api-key")?;
    ///
    /// // Download the primary file of a mod.
    /// let action = DownloadAction::Primary {
    ///     game_id: 5,
    ///     mod_id: 19,
    /// };
    /// modio.download(action).save_to_file("mod.zip").await?;
    ///
    /// // Download the specific file of a mod.
    /// let action = DownloadAction::File {
    ///     game_id: 5,
    ///     mod_id: 19,
    ///     file_id: 101,
    /// };
    /// modio.download(action).save_to_file("mod.zip").await?;
    ///
    /// // Download the specific version of a mod.
    /// // if multiple files are found then the latest file is downloaded.
    /// // Set policy to `ResolvePolicy::Fail` to return with
    /// // `modio::download::Error::MultipleFilesFound` as source error.
    /// let action = DownloadAction::Version {
    ///     game_id: 5,
    ///     mod_id: 19,
    ///     version: "0.1".to_string(),
    ///     policy: ResolvePolicy::Latest,
    /// };
    /// modio
    ///     .download(action)
    ///     .stream()
    ///     .try_for_each(|bytes| {
    ///         println!("Bytes: {:?}", bytes);
    ///         future::ok(())
    ///     })
    ///     .await?;
    /// #    Ok(())
    /// # }
    /// ```
    pub fn download<A>(&self, action: A) -> Downloader
    where
        DownloadAction: From<A>,
    {
        Downloader::new(self.clone(), action.into())
    }

    /// Return a reference to an interface that provides access to resources owned by the user
    /// associated with the current authentication credentials.
    pub fn user(&self) -> Me {
        Me::new(self.clone())
    }

    /// Return a reference to an interface to report games, mods and users.
    pub fn reports(&self) -> Reports {
        Reports::new(self.clone())
    }

    pub(crate) fn request(&self, route: Route) -> RequestBuilder {
        RequestBuilder::new(self.clone(), route)
    }
}
