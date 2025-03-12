pub const GITHUB_RELEASE_URL: &str = "https://api.github.com/repos/iriscats/mint/releases/latest";
pub const GITHUB_REQ_USER_AGENT: &str = "iriscats/mint";

#[derive(Debug, serde::Deserialize)]
pub struct GitHubRelease {
    pub html_url: String,
    pub tag_name: String,
    pub body: String,
}
