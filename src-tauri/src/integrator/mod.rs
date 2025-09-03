use std::io::{Read, Seek};
use serde::{Deserialize, Serialize};

pub mod drg;
pub mod drgrc;
mod ue4ss;

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ModInfo {
    pub modio_id: Option<u32>,
    pub name: String,
    pub pak_path: String,
}

pub trait ReadSeek: Read + Seek + Send {}

impl<T: Seek + Read + Send> ReadSeek for T {}
