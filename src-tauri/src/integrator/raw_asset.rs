
use unreal_asset::{Asset, AssetBuilder};
use unreal_asset::engine_version::EngineVersion;
use crate::integrator::error::IntegrationError;



#[derive(Debug, Default)]
pub struct RawAsset {
    pub uasset: Option<Vec<u8>>,
    pub uexp: Option<Vec<u8>>,
}

impl RawAsset {
    pub fn parse(&self) -> Result<Asset<std::io::Cursor<&Vec<u8>>>, IntegrationError> {
        Ok(AssetBuilder::new(
            std::io::Cursor::new(self.uasset.as_ref().unwrap()),
            EngineVersion::VER_UE4_27,
        )
        .bulk(std::io::Cursor::new(self.uexp.as_ref().unwrap()))
        .build()?)
    }

}
