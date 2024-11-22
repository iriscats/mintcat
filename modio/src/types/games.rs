use std::collections::HashMap;
use std::fmt;

use serde::de::{Deserializer, IgnoredAny, MapAccess, Visitor};
use serde::{Deserialize, Serialize};
use url::Url;

use crate::TargetPlatform;

use super::{deserialize_empty_object, DeserializeField, MissingField};
use super::{Logo, Status};

/// See the [Game Object](https://docs.mod.io/#game-object) docs for more information.
#[derive(Debug, Deserialize)]
#[non_exhaustive]
pub struct Game {
    pub id: u32,
    pub status: Status,
    pub date_added: u64,
    pub date_updated: u64,
    pub date_live: u64,
    pub presentation_option: PresentationOption,
    pub submission_option: SubmissionOption,
    pub curation_option: CurationOption,
    pub community_options: CommunityOptions,
    pub revenue_options: RevenueOptions,
    pub api_access_options: ApiAccessOptions,
    pub maturity_options: MaturityOptions,
    pub ugc_name: String,
    pub icon: Icon,
    pub logo: Logo,
    #[serde(default, deserialize_with = "deserialize_empty_object")]
    pub header: Option<HeaderImage>,
    pub name: String,
    pub name_id: String,
    pub summary: String,
    pub instructions: Option<String>,
    pub instructions_url: Option<Url>,
    pub profile_url: Url,
    /// The field is `None` when the game object is fetched from `/me/games`.
    #[serde(deserialize_with = "deserialize_empty_object")]
    pub stats: Option<Statistics>,
    /// The field is `None` when the game object is fetched from `/me/games`.
    #[serde(deserialize_with = "deserialize_empty_object")]
    pub theme: Option<Theme>,
    pub other_urls: Vec<OtherUrl>,
    pub tag_options: Vec<TagOption>,
    pub platforms: Vec<Platform>,
}

enum_number! {
    /// Presentation style used on the mod.io website.
    #[derive(Clone, Copy, Debug, Deserialize)]
    #[serde(from = "u8")]
    #[non_exhaustive]
    pub enum PresentationOption {
        /// Displays mods in a grid.
        GridView = 0,
        /// Displays mods in a table.
        TableView = 1,
        _ => Unknown(u8),
    }
}

enum_number! {
    /// Submission process modders must follow.
    #[derive(Clone, Copy, Debug, Deserialize)]
    #[serde(from = "u8")]
    #[non_exhaustive]
    pub enum SubmissionOption {
        /// Mod uploads must occur via the API using a tool by the game developers.
        ApiOnly = 0,
        /// Mod uploads can occur from anywhere, include the website and API.
        Anywhere = 1,
        _ => Unknown(u8),
    }
}

enum_number! {
    /// Curation process used to approve mods.
    #[derive(Clone, Copy, Debug, Deserialize)]
    #[serde(from = "u8")]
    #[non_exhaustive]
    pub enum CurationOption {
        /// No curation: Mods are immediately available to play.
        No = 0,
        /// Paid curation: Mods are immediately to play unless they choose to receive
        /// donations. These mods must be accepted to be listed.
        Paid = 1,
        /// Full curation: All mods must be accepted by someone to be listed.
        Full = 2,
        _ => Unknown(u8),
    }
}

enum_number! {
    /// Option to allow developers to select if they flag their mods containing mature content.
    #[derive(Clone, Copy, Debug, Deserialize)]
    #[serde(from = "u8")]
    #[non_exhaustive]
    pub enum MaturityOptions {
        NotAllowed = 0,
        /// Allow flagging mods as mature.
        Allowed = 1,
        _ => Unknown(u8),
    }
}

bitflags! {
    /// Community features enabled on the mod.io website.
    pub struct CommunityOptions: u8 {
        /// Discussion board enabled.
        const DISCUSSIONS       = 1;
        /// Guides & News enabled.
        const GUIDES_NEWS       = 2;
        /// "Subscribe to install" button disabled.
        const DISABLE_SUBSCRIBE = 4;
        const ALL = Self::DISCUSSIONS.bits | Self::GUIDES_NEWS.bits | Self::DISABLE_SUBSCRIBE.bits;
    }

    /// Revenue capabilities mods can enable.
    pub struct RevenueOptions: u8 {
        /// Allow mods to be sold.
        const SELL      = 1;
        /// Allow mods to receive donations.
        const DONATIONS = 2;
        /// Allow mods to be traded.
        const TRADE     = 4;
        /// Allow mods to control supply and scarcity.
        const SCARCITY  = 8;
        const ALL = Self::SELL.bits | Self::DONATIONS.bits | Self::TRADE.bits | Self::SCARCITY.bits;
    }

    /// Level of API access allowed by a game.
    pub struct ApiAccessOptions: u8 {
        /// Allow third parties to access a game's API endpoints.
        const ALLOW_THIRD_PARTY     = 1;
        /// Allow mods to be downloaded directly.
        const ALLOW_DIRECT_DOWNLOAD = 2;
        const ALL = Self::ALLOW_THIRD_PARTY.bits | Self::ALLOW_DIRECT_DOWNLOAD.bits;
    }
}

/// See the [Icon Object](https://docs.mod.io/#icon-object) docs for more information.
#[derive(Deserialize)]
#[non_exhaustive]
pub struct Icon {
    pub filename: String,
    pub original: Url,
    pub thumb_64x64: Url,
    pub thumb_128x128: Url,
    pub thumb_256x256: Url,
}

impl fmt::Debug for Icon {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Icon")
            .field("filename", &self.filename)
            .field("original", &self.original.as_str())
            .field("thumb_64x64", &self.thumb_64x64.as_str())
            .field("thumb_128x128", &self.thumb_128x128.as_str())
            .field("thumb_256x256", &self.thumb_256x256.as_str())
            .finish()
    }
}

/// See the [Header Image Object](https://docs.mod.io/#header-image-object) docs for more
/// information.
#[derive(Deserialize)]
#[non_exhaustive]
pub struct HeaderImage {
    pub filename: String,
    pub original: Url,
}

impl fmt::Debug for HeaderImage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("HeaderImage")
            .field("filename", &self.filename)
            .field("original", &self.original.as_str())
            .finish()
    }
}

/// See the [Game Statistics Object](https://docs.mod.io/#game-stats-object) docs for more
/// information.
#[derive(Debug)]
#[non_exhaustive]
pub struct Statistics {
    pub game_id: u32,
    pub mods_total: u32,
    pub subscribers_total: u32,
    pub downloads: Downloads,
    pub expired_at: u64,
}

impl<'de> Deserialize<'de> for Statistics {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(field_identifier, rename_all = "snake_case")]
        enum Field {
            GameId,
            ModsCountTotal,
            ModsSubscribersTotal,
            ModsDownloadsTotal,
            ModsDownloadsToday,
            ModsDownloadsDailyAverage,
            DateExpires,
            Other(String),
        }

        struct StatisticsVisitor;

        impl<'de> Visitor<'de> for StatisticsVisitor {
            type Value = Statistics;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("struct Statistics")
            }

            fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
                let mut game_id = None;
                let mut mods_total = None;
                let mut subscribers_total = None;
                let mut downloads_total = None;
                let mut downloads_today = None;
                let mut downloads_daily_average = None;
                let mut expired_at = None;

                while let Some(key) = map.next_key()? {
                    match key {
                        Field::GameId => {
                            game_id.deserialize_value("game_id", &mut map)?;
                        }
                        Field::ModsCountTotal => {
                            mods_total.deserialize_value("mods_count_total", &mut map)?;
                        }
                        Field::ModsSubscribersTotal => {
                            subscribers_total
                                .deserialize_value("mods_subscribers_total", &mut map)?;
                        }
                        Field::ModsDownloadsToday => {
                            downloads_today.deserialize_value("mods_downloads_today", &mut map)?;
                        }
                        Field::ModsDownloadsTotal => {
                            downloads_total.deserialize_value("mods_downloads_total", &mut map)?;
                        }
                        Field::ModsDownloadsDailyAverage => {
                            downloads_daily_average
                                .deserialize_value("mods_downloads_daily_average", &mut map)?;
                        }
                        Field::DateExpires => {
                            expired_at.deserialize_value("date_expires", &mut map)?;
                        }
                        Field::Other(_) => {
                            map.next_value::<IgnoredAny>()?;
                        }
                    }
                }

                let game_id = game_id.missing_field("game_id")?;
                let mods_total = mods_total.missing_field("mods_count_total")?;
                let subscribers_total =
                    subscribers_total.missing_field("mods_subscribers_total")?;
                let downloads_total = downloads_total.missing_field("mods_downloads_total")?;
                let downloads_today = downloads_today.missing_field("mods_downloads_today")?;
                let downloads_daily_average =
                    downloads_daily_average.missing_field("mods_downloads_daily_average")?;
                let expired_at = expired_at.missing_field("date_expires")?;

                Ok(Statistics {
                    game_id,
                    mods_total,
                    subscribers_total,
                    downloads: Downloads {
                        total: downloads_total,
                        today: downloads_today,
                        daily_average: downloads_daily_average,
                    },
                    expired_at,
                })
            }
        }

        deserializer.deserialize_map(StatisticsVisitor)
    }
}

/// Part of [`Statistics`]
#[derive(Debug)]
#[non_exhaustive]
pub struct Downloads {
    pub total: u32,
    pub today: u32,
    pub daily_average: u32,
}

/// See the [Game Tag Option Object](https://docs.mod.io/#game-tag-option-object) docs for more
/// information.
#[derive(Debug, Deserialize)]
#[non_exhaustive]
pub struct TagOption {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: TagType,
    #[serde(rename = "tag_count_map")]
    pub tag_count: HashMap<String, u32>,
    pub hidden: bool,
    pub locked: bool,
    pub tags: Vec<String>,
}

/// Defines the type of a tag. See [`TagOption`].
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
#[non_exhaustive]
pub enum TagType {
    Checkboxes,
    Dropdown,
}

impl fmt::Display for TagType {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> Result<(), fmt::Error> {
        match self {
            Self::Checkboxes => fmt.write_str("checkboxes"),
            Self::Dropdown => fmt.write_str("dropdown"),
        }
    }
}

/// See the [Theme Object](https://docs.mod.io/#theme-object) docs for more information.
#[derive(Debug, Deserialize)]
pub struct Theme {
    pub primary: String,
    pub dark: String,
    pub light: String,
    pub success: String,
    pub warning: String,
    pub danger: String,
}

/// See the [Game OtherUrls Object](https://docs.mod.io/#game-otherurls-object) docs for more information.
#[derive(Deserialize)]
pub struct OtherUrl {
    pub label: String,
    pub url: Url,
}

impl fmt::Debug for OtherUrl {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("OtherUrl")
            .field("label", &self.label)
            .field("url", &self.url.as_str())
            .finish()
    }
}

/// See the [Game Platforms Object](https://docs.mod.io/#game-platforms-object) docs for more information.
#[derive(Debug, Deserialize)]
#[non_exhaustive]
pub struct Platform {
    #[serde(rename = "platform")]
    pub target: TargetPlatform,
    pub moderated: bool,
}
