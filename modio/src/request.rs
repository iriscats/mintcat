use futures_util::TryFutureExt;
use reqwest::header::{HeaderValue, CONTENT_TYPE};
use reqwest::multipart::Form;
use reqwest::StatusCode;
use serde::de::DeserializeOwned;
use serde::ser::Serialize;
use tracing::{debug, level_enabled, trace};
use url::Url;

use crate::auth::Token;
use crate::error::{self, Result};
use crate::routing::{AuthMethod, Route};
use crate::types::ErrorResponse;
use crate::Modio;

#[allow(dead_code)]
mod headers {
    const X_MODIO_ERROR_REF: &str = "x-modio-error-ref";
    const X_MODIO_REQUEST_ID: &str = "x-modio-request-id";
    const X_RATELIMIT_LIMIT: &str = "x-ratelimit-limit";
    const X_RATELIMIT_REMAINING: &str = "x-ratelimit-remaining";
    const X_RATELIMIT_RETRY_AFTER: &str = "x-ratelimit-retryafter";

    use http::HeaderMap;

    pub fn parse_headers(headers: &HeaderMap) -> (Option<u64>, Option<u64>) {
        fn to_str<'a>(headers: &'a HeaderMap, name: &'static str) -> Option<&'a str> {
            headers.get(name).and_then(|v| v.to_str().ok())
        }
        fn parse<T: std::str::FromStr>(headers: &HeaderMap, name: &'static str) -> Option<T> {
            to_str(headers, name).and_then(|v| v.parse().ok())
        }

        let remaining = parse(headers, X_RATELIMIT_REMAINING);
        let reset_after = parse(headers, X_RATELIMIT_RETRY_AFTER);
        (remaining, reset_after)
    }
}

pub struct RequestBuilder {
    modio: Modio,
    request: Result<reqwest_middleware::RequestBuilder>,
}

impl RequestBuilder {
    pub fn new(modio: Modio, route: Route) -> Self {
        let (method, path, auth_method) = route.pieces();

        if let (AuthMethod::Token, None) = (&auth_method, &modio.inner.credentials.token) {
            return Self {
                modio,
                request: Err(error::token_required()),
            };
        }

        let url = format!("{}{}", modio.inner.host, path);
        let params = if modio.inner.credentials.token.is_some() {
            vec![]
        } else {
            vec![("api_key", &modio.inner.credentials.api_key)]
        };
        let request = Url::parse_with_params(&url, &params)
            .map(|url| {
                let mut req = modio.inner.client.request(method, url);

                if let (AuthMethod::Token | AuthMethod::Any, Some(Token { value, .. })) =
                    (&auth_method, &modio.inner.credentials.token)
                {
                    req = req.bearer_auth(value);
                }
                req
            })
            .map_err(error::builder);

        Self { modio, request }
    }

    pub fn query<T: Serialize + ?Sized>(self, query: &T) -> Self {
        Self {
            request: self.request.map(|r| r.query(query)),
            ..self
        }
    }

    pub fn form<T: Serialize + ?Sized>(self, form: &T) -> Self {
        Self {
            request: self.request.map(|r| r.form(form)),
            ..self
        }
    }

    pub fn multipart(self, form: Form) -> Self {
        Self {
            request: self.request.map(|r| r.multipart(form)),
            ..self
        }
    }

    pub async fn send<Out>(self) -> Result<Out>
    where
        Out: DeserializeOwned + Send,
    {
        let mut req = self.request?.build().map_err(error::builder)?;
        if !req.headers().contains_key(CONTENT_TYPE) {
            req.headers_mut().insert(
                CONTENT_TYPE,
                HeaderValue::from_static("application/x-www-form-urlencoded"),
            );
        }

        debug!("request: {} {}", req.method(), req.url());
        let response = self
            .modio
            .inner
            .client
            .execute(req)
            .map_err(error::request)
            .await?;

        let status = response.status();

        let (remaining, reset) = if status.is_success() {
            (None, None)
        } else {
            headers::parse_headers(response.headers())
        };

        trace!("response headers: {:?}", response.headers());

        let body = response.bytes().map_err(error::request).await?;

        if level_enabled!(tracing::Level::TRACE) {
            match std::str::from_utf8(&body) {
                Ok(s) => trace!("status: {}, response: {}", status, s),
                Err(_) => trace!("status: {}, response: {:?}", status, body),
            }
        }

        if status == StatusCode::NO_CONTENT {
            serde_json::from_str("null").map_err(error::decode)
        } else if status.is_success() {
            serde_json::from_slice(&body).map_err(error::decode)
        } else {
            match (remaining, reset) {
                (Some(remaining), Some(reset)) if remaining == 0 => {
                    debug!("ratelimit reached: reset in {} seconds", reset);
                    Err(error::ratelimit(reset))
                }
                _ => serde_json::from_slice::<ErrorResponse>(&body)
                    .map(|mer| Err(error::error_for_status(status, mer.error)))
                    .map_err(error::decode)?,
            }
        }
    }
}
