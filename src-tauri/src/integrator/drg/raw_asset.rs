use std::error::Error;
use unreal_asset::engine_version::EngineVersion;
use unreal_asset::{Asset, AssetBuilder};

#[derive(Debug, Default)]
pub struct RawAsset {
    pub uasset: Option<Vec<u8>>,
    pub uexp: Option<Vec<u8>>,
}

impl RawAsset {
    pub fn parse(&self) -> Result<Asset<std::io::Cursor<&Vec<u8>>>, Box<dyn Error>> {
        let asset = AssetBuilder::new(
            std::io::Cursor::new(self.uasset.as_ref().unwrap()),
            EngineVersion::VER_UE4_27,
        )
        .bulk(std::io::Cursor::new(self.uexp.as_ref().unwrap()))
        .build()?;

        Ok(asset)
    }
}
