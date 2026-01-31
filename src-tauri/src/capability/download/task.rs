use crate::capability::download::checksum::{ChecksumCalculator, ChecksumType};
use crate::capability::download::error::DownloadError;
use futures::StreamExt;
use rand::Rng;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::fs::{File, OpenOptions};
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub download_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: f64,
    pub eta_secs: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadStatus {
    pub download_id: String,
    pub status: String,
    pub error: Option<String>,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DownloadOptions {
    pub checksum: Option<String>,
    pub checksum_type: Option<ChecksumType>,
    pub timeout_secs: Option<u64>,
    pub retry_count: Option<u32>,
    pub resume: Option<bool>,
}

impl Default for DownloadOptions {
    fn default() -> Self {
        Self {
            checksum: None,
            checksum_type: None,
            timeout_secs: Some(300),
            retry_count: Some(3),
            resume: Some(true),
        }
    }
}

pub struct DownloadTask {
    pub id: String,
    pub url: String,
    pub file_path: PathBuf,
    pub options: DownloadOptions,
    pub app: AppHandle,
    pub client: reqwest::Client,
    cancelled: Arc<Mutex<bool>>,
}

impl DownloadTask {
    pub fn new(
        id: String,
        url: String,
        file_path: PathBuf,
        options: DownloadOptions,
        app: AppHandle,
        client: reqwest::Client,
    ) -> Self {
        Self {
            id,
            url,
            file_path,
            options,
            app,
            client,
            cancelled: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn cancel(&self) {
        let mut cancelled = self.cancelled.lock().await;
        *cancelled = true;
    }

    async fn is_cancelled(&self) -> bool {
        *self.cancelled.lock().await
    }

    fn calculate_backoff_delay(&self, attempt: u32) -> Duration {
        let base_delay_ms = 1000u64;
        let max_delay_ms = 30000u64;
        let multiplier = 2u64;

        let delay_ms = base_delay_ms * multiplier.pow(attempt);
        let delay_ms = delay_ms.min(max_delay_ms);

        // Add jitter (±25%)
        let mut rng = rand::thread_rng();
        let jitter = rng.gen_range(-0.25..=0.25);
        let jittered_delay = (delay_ms as f64 * (1.0 + jitter)) as u64;

        Duration::from_millis(jittered_delay)
    }

    fn emit_progress(&self, downloaded: u64, total: u64, speed: f64, eta: f64) {
        let _ = self.app.emit(
            "download-progress",
            DownloadProgress {
                download_id: self.id.clone(),
                downloaded_bytes: downloaded,
                total_bytes: total,
                speed_bytes_per_sec: speed,
                eta_secs: eta,
            },
        );
    }

    fn emit_status(&self, status: &str, error: Option<String>, file_path: Option<String>) {
        let _ = self.app.emit(
            "download-status",
            DownloadStatus {
                download_id: self.id.clone(),
                status: status.to_string(),
                error,
                file_path,
            },
        );
    }

    async fn get_partial_file_size(&self) -> Result<u64, DownloadError> {
        let part_path = self.file_path.with_extension("part");
        if part_path.exists() {
            let metadata = tokio::fs::metadata(&part_path).await?;
            Ok(metadata.len())
        } else {
            Ok(0)
        }
    }

    async fn download_with_resume(&self, _attempt: u32) -> Result<(), DownloadError> {
        let part_path = self.file_path.with_extension("part");
        let resume_enabled = self.options.resume.unwrap_or(true);
        
        // Ensure parent directory exists before downloading
        if let Some(parent) = self.file_path.parent() {
            if !parent.exists() {
                tokio::fs::create_dir_all(parent).await?;
            }
        }
        
        let start_byte = if resume_enabled {
            self.get_partial_file_size().await?
        } else {
            0
        };

        // Build request
        let mut request = self.client.get(&self.url);
        
        if start_byte > 0 {
            request = request.header("Range", format!("bytes={}-", start_byte));
        }

        if let Some(timeout) = self.options.timeout_secs {
            request = request.timeout(Duration::from_secs(timeout));
        }

        // Send request
        let response = request.send().await?;
        
        if !response.status().is_success() && response.status().as_u16() != 206 {
            return Err(DownloadError::HttpError(
                response.status().as_u16(),
                response.status().to_string(),
            ));
        }

        let total_size = response.content_length().unwrap_or(0) + start_byte;

        // Open file for writing
        let mut file = if start_byte > 0 {
            OpenOptions::new()
                .append(true)
                .open(&part_path)
                .await?
        } else {
            File::create(&part_path).await?
        };

        // Initialize checksum calculator if needed
        let mut checksum_calculator = if let Some(checksum_type) = &self.options.checksum_type {
            Some(ChecksumCalculator::new(checksum_type.clone()))
        } else {
            None
        };

        // Download with progress tracking
        let mut downloaded = start_byte;
        let mut stream = response.bytes_stream();
        let start_time = Instant::now();
        let mut last_progress_time = Instant::now();

        while let Some(chunk) = stream.next().await {
            if self.is_cancelled().await {
                return Err(DownloadError::Cancelled);
            }

            let chunk = chunk?;
            file.write_all(&chunk).await?;
            
            if let Some(calculator) = &mut checksum_calculator {
                calculator.update(&chunk);
            }

            downloaded += chunk.len() as u64;

            // Emit progress every 100ms
            if last_progress_time.elapsed() >= Duration::from_millis(100) {
                let elapsed = start_time.elapsed().as_secs_f64();
                let speed = if elapsed > 0.0 {
                    (downloaded - start_byte) as f64 / elapsed
                } else {
                    0.0
                };
                let eta = if speed > 0.0 && total_size > downloaded {
                    (total_size - downloaded) as f64 / speed
                } else {
                    0.0
                };

                self.emit_progress(downloaded, total_size, speed, eta);
                last_progress_time = Instant::now();
            }
        }

        file.flush().await?;
        drop(file);

        // Verify checksum if provided
        if let (Some(expected_checksum), Some(calculator)) = 
            (&self.options.checksum, checksum_calculator) {
            let actual_checksum = calculator.finalize();
            if expected_checksum.to_lowercase() != actual_checksum.to_lowercase() {
                return Err(DownloadError::ChecksumMismatch {
                    expected: expected_checksum.clone(),
                    actual: actual_checksum,
                });
            }
        }

        // Rename .part to final file
        tokio::fs::rename(&part_path, &self.file_path).await?;

        Ok(())
    }

    pub async fn execute(&self) -> Result<(), DownloadError> {
        let max_retries = self.options.retry_count.unwrap_or(3);
        let mut last_error = None;

        for attempt in 0..=max_retries {
            if self.is_cancelled().await {
                self.emit_status("cancelled", None, None);
                return Err(DownloadError::Cancelled);
            }

            match self.download_with_resume(attempt).await {
                Ok(_) => {
                    self.emit_status(
                        "completed",
                        None,
                        Some(self.file_path.to_string_lossy().to_string()),
                    );
                    return Ok(());
                }
                Err(e) => {
                    last_error = Some(e.clone());
                    
                    // Don't retry on certain errors
                    match &e {
                        DownloadError::Cancelled => {
                            self.emit_status("cancelled", None, None);
                            return Err(e);
                        }
                        DownloadError::ChecksumMismatch { .. } => {
                            // Delete the file on checksum mismatch
                            let _ = tokio::fs::remove_file(&self.file_path).await;
                            self.emit_status("failed", Some(e.to_string()), None);
                            return Err(e);
                        }
                        DownloadError::InvalidUrl(_) => {
                            self.emit_status("failed", Some(e.to_string()), None);
                            return Err(e);
                        }
                        _ => {}
                    }

                    // Wait before retry (except on last attempt)
                    if attempt < max_retries {
                        let delay = self.calculate_backoff_delay(attempt);
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }

        // All retries failed
        if let Some(error) = last_error {
            self.emit_status("failed", Some(error.to_string()), None);
            Err(error)
        } else {
            let error = DownloadError::NetworkError("Unknown error".to_string());
            self.emit_status("failed", Some(error.to_string()), None);
            Err(error)
        }
    }
}
