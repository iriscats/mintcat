use std::io::{Read, Seek};

mod game_pak_patch;
mod mod_bundle_writer;
mod modio_patch;
pub mod pak_integrator;
mod raw_asset;
mod ue4ss_integrate;
pub(crate) mod installation;
pub mod mod_info;

pub trait ReadSeek: Read + Seek + Send {}

impl<T: Seek + Read + Send> ReadSeek for T {}
