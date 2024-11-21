//! Mod metadata KVP interface
use futures_util::TryStreamExt;
use serde::Deserialize;

use crate::prelude::*;
pub use crate::types::mods::MetadataMap;

#[derive(Clone)]
pub struct Metadata {
    modio: Modio,
    game: u32,
    mod_id: u32,
}

impl Metadata {
    pub(crate) fn new(modio: Modio, game: u32, mod_id: u32) -> Self {
        Self {
            modio,
            game,
            mod_id,
        }
    }

    /// Return the metadata key value pairs for a mod that this `Metadata` refers to.
    pub async fn get(self) -> Result<MetadataMap> {
        #[derive(Deserialize)]
        struct KV {
            metakey: String,
            metavalue: String,
        }

        let route = Route::GetModMetadata {
            game_id: self.game,
            mod_id: self.mod_id,
        };
        let filter = Filter::default();
        let mut it = Query::<KV>::new(self.modio, route, filter).iter().await?;

        let (size, _) = it.size_hint();
        let mut map = MetadataMap::with_capacity(size);

        while let Some(kv) = it.try_next().await? {
            map.entry(kv.metakey).or_default().push(kv.metavalue);
        }
        Ok(map)
    }

    /// Add metadata for a mod that this `Metadata` refers to.
    #[allow(clippy::should_implement_trait)]
    pub async fn add(self, metadata: MetadataMap) -> Result<()> {
        let route = Route::AddModMetadata {
            game_id: self.game,
            mod_id: self.mod_id,
        };
        self.modio
            .request(route)
            .form(&metadata)
            .send::<Message>()
            .await?;
        Ok(())
    }

    /// Delete metadata for a mod that this `Metadata` refers to.
    pub async fn delete(self, metadata: MetadataMap) -> Result<Deletion> {
        let route = Route::DeleteModMetadata {
            game_id: self.game,
            mod_id: self.mod_id,
        };
        self.modio.request(route).form(&metadata).send().await
    }
}

#[doc(hidden)]
impl serde::ser::Serialize for MetadataMap {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        use serde::ser::SerializeMap;

        let len = self.values().map(|v| std::cmp::max(1, v.len())).sum();
        let mut map = serializer.serialize_map(Some(len))?;
        for (k, vals) in self.iter() {
            if vals.is_empty() {
                map.serialize_entry("metadata[]", k)?;
            }
            for v in vals {
                map.serialize_entry("metadata[]", &format!("{}:{}", k, v))?;
            }
        }
        map.end()
    }
}
