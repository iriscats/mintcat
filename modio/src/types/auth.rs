use serde::Deserialize;
use url::Url;

/// See the [Terms Object](https://docs.mod.io/#terms-object) docs for more information.
#[derive(Debug, Deserialize)]
#[non_exhaustive]
pub struct Terms {
    pub plaintext: String,
    pub html: String,
    pub links: Links,
}

/// Part of [`Terms`]
///
/// See the [Terms Object](https://docs.mod.io/#terms-object) docs for more information.
#[derive(Debug, Deserialize)]
#[non_exhaustive]
pub struct Links {
    pub website: Link,
    pub terms: Link,
    pub privacy: Link,
    pub manage: Link,
}

/// Part of [`Terms`]
///
/// See the [Terms Object](https://docs.mod.io/#terms-object) docs for more information.
#[derive(Debug, Deserialize)]
#[non_exhaustive]
pub struct Link {
    pub text: String,
    pub url: Url,
    pub required: bool,
}
