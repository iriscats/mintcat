//! Games interface
use std::ffi::OsStr;
use std::path::Path;

use mime::IMAGE_STAR;

use crate::mods::{ModRef, Mods};
use crate::multipart::FileSource;
use crate::prelude::*;

pub use crate::types::games::{
    ApiAccessOptions, CommunityOptions, CurationOption, Downloads, Game, HeaderImage, Icon,
    MaturityOptions, OtherUrl, Platform, PresentationOption, RevenueOptions, Statistics,
    SubmissionOption, TagOption, TagType, Theme,
};
pub use crate::types::Logo;
pub use crate::types::Status;

/// Interface for games.
#[derive(Clone)]
pub struct Games {
    modio: Modio,
}

impl Games {
    pub(crate) fn new(modio: Modio) -> Self {
        Self { modio }
    }

    /// Returns a `Query` interface to retrieve games.
    ///
    /// See [Filters and sorting](filters).
    pub fn search(&self, filter: Filter) -> Query<Game> {
        Query::new(self.modio.clone(), Route::GetGames, filter)
    }

    /// Return a reference to a game.
    pub fn get(&self, id: u32) -> GameRef {
        GameRef::new(self.modio.clone(), id)
    }
}

/// Reference interface of a game.
#[derive(Clone)]
pub struct GameRef {
    modio: Modio,
    id: u32,
}

impl GameRef {
    pub(crate) fn new(modio: Modio, id: u32) -> Self {
        Self { modio, id }
    }

    /// Get a reference to the Modio game object that this `GameRef` refers to.
    pub async fn get(self) -> Result<Game> {
        let route = Route::GetGame { game_id: self.id };
        self.modio.request(route).send().await
    }

    /// Return a reference to a mod of a game.
    pub fn mod_(&self, mod_id: u32) -> ModRef {
        ModRef::new(self.modio.clone(), self.id, mod_id)
    }

    /// Return a reference to an interface that provides access to the mods of a game.
    pub fn mods(&self) -> Mods {
        Mods::new(self.modio.clone(), self.id)
    }

    /// Return the statistics for a game.
    pub async fn statistics(self) -> Result<Statistics> {
        let route = Route::GetGameStats { game_id: self.id };
        self.modio.request(route).send().await
    }

    /// Return a reference to an interface that provides access to the tags of a game.
    pub fn tags(&self) -> Tags {
        Tags::new(self.modio.clone(), self.id)
    }

    /// Add new media to a game. [required: token]
    pub async fn edit_media(self, media: EditMediaOptions) -> Result<()> {
        let route = Route::AddGameMedia { game_id: self.id };
        self.modio
            .request(route)
            .multipart(Form::from(media))
            .send::<Message>()
            .await?;
        Ok(())
    }
}

/// Interface for tag options.
#[derive(Clone)]
pub struct Tags {
    modio: Modio,
    game_id: u32,
}

impl Tags {
    fn new(modio: Modio, game_id: u32) -> Self {
        Self { modio, game_id }
    }

    /// List tag options.
    pub async fn list(self) -> Result<Vec<TagOption>> {
        let route = Route::GetGameTags {
            game_id: self.game_id,
        };
        Query::new(self.modio, route, Filter::default())
            .collect()
            .await
    }

    /// Provides a stream over all tag options.
    #[allow(clippy::iter_not_returning_iterator)]
    pub async fn iter(self) -> Result<impl Stream<Item = Result<TagOption>>> {
        let route = Route::GetGameTags {
            game_id: self.game_id,
        };
        let filter = Filter::default();
        Query::new(self.modio, route, filter).iter().await
    }

    /// Add tag options. [required: token]
    #[allow(clippy::should_implement_trait)]
    pub async fn add(self, options: AddTagsOptions) -> Result<()> {
        let route = Route::AddGameTags {
            game_id: self.game_id,
        };
        self.modio
            .request(route)
            .form(&options)
            .send::<Message>()
            .await?;
        Ok(())
    }

    /// Delete tag options. [required: token]
    pub async fn delete(self, options: DeleteTagsOptions) -> Result<Deletion> {
        let route = Route::DeleteGameTags {
            game_id: self.game_id,
        };
        self.modio.request(route).form(&options).send().await
    }
}

/// Game filters and sorting.
///
/// # Filters
/// - `Fulltext`
/// - `Id`
/// - `Status`
/// - `SubmittedBy`
/// - `DateAdded`
/// - `DateUpdated`
/// - `DateLive`
/// - `Name`
/// - `NameId`
/// - `Summary`
/// - `InstructionsUrl`
/// - `UgcName`
/// - `PresentationOption`
/// - `SubmissionOption`
/// - `CurationOption`
/// - `CommunityOptions`
/// - `RevenueOptions`
/// - `ApiAccessOptions`
/// - `MaturityOptions`
///
/// # Sorting
/// - `Id`
/// - `Status`
/// - `Name`
/// - `NameId`
/// - `DateUpdated`
///
/// See [modio docs](https://docs.mod.io/#get-games) for more information.
///
/// By default this returns up to `100` items. You can limit the result by using `limit` and
/// `offset`.
///
/// # Example
/// ```
/// use modio::filter::prelude::*;
/// use modio::games::filters::Id;
///
/// let filter = Id::_in(vec![1, 2]).order_by(Id::desc());
/// ```
#[rustfmt::skip]
pub mod filters {
    #[doc(inline)]
    pub use crate::filter::prelude::Fulltext;
    #[doc(inline)]
    pub use crate::filter::prelude::Id;
    #[doc(inline)]
    pub use crate::filter::prelude::Name;
    #[doc(inline)]
    pub use crate::filter::prelude::NameId;
    #[doc(inline)]
    pub use crate::filter::prelude::Status;
    #[doc(inline)]
    pub use crate::filter::prelude::DateAdded;
    #[doc(inline)]
    pub use crate::filter::prelude::DateUpdated;
    #[doc(inline)]
    pub use crate::filter::prelude::DateLive;
    #[doc(inline)]
    pub use crate::filter::prelude::SubmittedBy;

    filter!(Summary, SUMMARY, "summary", Eq, NotEq, Like);
    filter!(InstructionsUrl, INSTRUCTIONS_URL, "instructions_url", Eq, NotEq, In, Like);
    filter!(UgcName, UGC_NAME, "ugc_name", Eq, NotEq, In, Like);
    filter!(PresentationOption, PRESENTATION_OPTION, "presentation_option", Eq, NotEq, In, Cmp, Bit);
    filter!(SubmissionOption, SUBMISSION_OPTION, "submission_option", Eq, NotEq, In, Cmp, Bit);
    filter!(CurationOption, CURATION_OPTION, "curation_option", Eq, NotEq, In, Cmp, Bit);
    filter!(CommunityOptions, COMMUNITY_OPTIONS, "community_options", Eq, NotEq, In, Cmp, Bit);
    filter!(RevenueOptions, REVENUE_OPTIONS, "revenue_options", Eq, NotEq, In, Cmp, Bit);
    filter!(ApiAccessOptions, API_ACCESS_OPTIONS, "api_access_options", Eq, NotEq, In, Cmp, Bit);
    filter!(MaturityOptions, MATURITY_OPTIONS, "maturity_options", Eq, NotEq, In, Cmp, Bit);
}

pub struct AddTagsOptions {
    name: String,
    kind: TagType,
    hidden: bool,
    locked: bool,
    tags: Vec<String>,
}

impl AddTagsOptions {
    pub fn new<S: Into<String>>(name: S, kind: TagType, tags: &[String]) -> Self {
        Self {
            name: name.into(),
            kind,
            hidden: false,
            locked: false,
            tags: tags.to_vec(),
        }
    }

    pub fn hidden(self, value: bool) -> Self {
        Self {
            hidden: value,
            ..self
        }
    }

    pub fn locked(self, value: bool) -> Self {
        Self {
            locked: value,
            ..self
        }
    }
}

#[doc(hidden)]
impl serde::ser::Serialize for AddTagsOptions {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        use serde::ser::SerializeMap;

        let len = 2 + usize::from(self.hidden) + usize::from(self.locked) + self.tags.len();
        let mut map = serializer.serialize_map(Some(len))?;
        map.serialize_entry("name", &self.name)?;
        map.serialize_entry("type", &self.kind)?;
        if self.hidden {
            map.serialize_entry("hidden", &self.hidden)?;
        }
        if self.locked {
            map.serialize_entry("locked", &self.locked)?;
        }
        for t in &self.tags {
            map.serialize_entry("tags[]", t)?;
        }
        map.end()
    }
}

pub struct DeleteTagsOptions {
    name: String,
    tags: Option<Vec<String>>,
}

impl DeleteTagsOptions {
    pub fn all<S: Into<String>>(name: S) -> Self {
        Self {
            name: name.into(),
            tags: None,
        }
    }

    pub fn some<S: Into<String>>(name: S, tags: &[String]) -> Self {
        Self {
            name: name.into(),
            tags: if tags.is_empty() {
                None
            } else {
                Some(tags.to_vec())
            },
        }
    }
}

#[doc(hidden)]
impl serde::ser::Serialize for DeleteTagsOptions {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        use serde::ser::SerializeMap;

        let len = self.tags.as_ref().map_or(1, Vec::len);
        let mut map = serializer.serialize_map(Some(len + 1))?;
        map.serialize_entry("name", &self.name)?;
        if let Some(ref tags) = self.tags {
            for t in tags {
                map.serialize_entry("tags[]", t)?;
            }
        } else {
            map.serialize_entry("tags[]", "")?;
        }
        map.end()
    }
}

#[derive(Default)]
pub struct EditMediaOptions {
    logo: Option<FileSource>,
    icon: Option<FileSource>,
    header: Option<FileSource>,
}

impl EditMediaOptions {
    #[must_use]
    pub fn logo<P: AsRef<Path>>(self, logo: P) -> Self {
        let logo = logo.as_ref();
        let filename = logo
            .file_name()
            .and_then(OsStr::to_str)
            .map_or_else(String::new, ToString::to_string);

        Self {
            logo: Some(FileSource::new_from_file(logo, filename, IMAGE_STAR)),
            ..self
        }
    }

    #[must_use]
    pub fn icon<P: AsRef<Path>>(self, icon: P) -> Self {
        let icon = icon.as_ref();
        let filename = icon
            .file_name()
            .and_then(OsStr::to_str)
            .map_or_else(String::new, ToString::to_string);

        Self {
            icon: Some(FileSource::new_from_file(icon, filename, IMAGE_STAR)),
            ..self
        }
    }

    #[must_use]
    pub fn header<P: AsRef<Path>>(self, header: P) -> Self {
        let header = header.as_ref();
        let filename = header
            .file_name()
            .and_then(OsStr::to_str)
            .map_or_else(String::new, ToString::to_string);

        Self {
            header: Some(FileSource::new_from_file(header, filename, IMAGE_STAR)),
            ..self
        }
    }
}

#[doc(hidden)]
impl From<EditMediaOptions> for Form {
    fn from(opts: EditMediaOptions) -> Form {
        let mut form = Form::new();
        if let Some(logo) = opts.logo {
            form = form.part("logo", logo.into());
        }
        if let Some(icon) = opts.icon {
            form = form.part("icon", icon.into());
        }
        if let Some(header) = opts.header {
            form = form.part("header", header.into());
        }
        form
    }
}
