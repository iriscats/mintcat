use serde::{Deserialize, Serialize};
use std::io::{Read, Seek};

pub mod drg;
pub mod drgrc;
mod ue4ss;

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ModInfo {
    pub modio_id: Option<u32>,
    pub name: String,
    pub pak_path: String,
    /// Whether this mod is an unpacked directory (contains Content folder with uasset/uexp files)
    #[serde(default)]
    pub is_unpacked: bool,
}

pub trait ReadSeek: Read + Seek + Send {}

impl<T: Seek + Read + Send> ReadSeek for T {}
