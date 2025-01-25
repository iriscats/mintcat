use std::io::{Read, Seek};

mod mod_bundle_writer;
mod raw_asset;
mod error;
mod ue4ss;

pub trait ReadSeek: Read + Seek + Send {}

impl<T: Seek + Read + Send> ReadSeek for T {}