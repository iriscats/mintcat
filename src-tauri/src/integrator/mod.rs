use std::io::{Read, Seek};

mod game_pak_patch;
pub(crate) mod installation;
mod mod_bundle_writer;
pub mod mod_info;
mod modio_patch;
pub mod pak_integrator;
mod raw_asset;
mod ue4ss_integrate;

pub trait ReadSeek: Read + Seek + Send {}

impl<T: Seek + Read + Send> ReadSeek for T {}
