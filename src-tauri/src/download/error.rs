use std::fmt;

#[derive(Debug, Clone)]
pub enum DownloadError {
    NetworkError(String),
    FileSystemError(String),
    ChecksumMismatch { expected: String, actual: String },
    InvalidUrl(String),
    Cancelled,
    Timeout,
    HttpError(u16, String),
}

impl fmt::Display for DownloadError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DownloadError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            DownloadError::FileSystemError(msg) => write!(f, "File system error: {}", msg),
            DownloadError::ChecksumMismatch { expected, actual } => {
                write!(
                    f,
                    "Checksum mismatch: expected {}, got {}",
                    expected, actual
                )
            }
            DownloadError::InvalidUrl(url) => write!(f, "Invalid URL: {}", url),
            DownloadError::Cancelled => write!(f, "Download cancelled"),
            // 连接/读取超时与“无法访问 URL”都会走 timeout，提示用户可能原因
            DownloadError::Timeout => write!(
                f,
                "Download timeout (may be unreachable URL or slow network)"
            ),
            DownloadError::HttpError(code, msg) => write!(f, "HTTP error {}: {}", code, msg),
        }
    }
}

impl std::error::Error for DownloadError {}

impl From<reqwest::Error> for DownloadError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            DownloadError::Timeout
        } else if let Some(status) = err.status() {
            DownloadError::HttpError(status.as_u16(), err.to_string())
        } else {
            DownloadError::NetworkError(err.to_string())
        }
    }
}

impl From<std::io::Error> for DownloadError {
    fn from(err: std::io::Error) -> Self {
        DownloadError::FileSystemError(err.to_string())
    }
}

impl From<DownloadError> for String {
    fn from(err: DownloadError) -> Self {
        err.to_string()
    }
}
