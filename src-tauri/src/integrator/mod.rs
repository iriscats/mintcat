use std::io::{Read, Seek};

mod mod_bundle_writer;
mod raw_asset;
mod error;
mod ue4ss_integrate;
mod game_pak_patch;
mod modio_patch;
pub mod pak_integrator;

pub trait ReadSeek: Read + Seek + Send {}

impl<T: Seek + Read + Send> ReadSeek for T {}

