use repak::PakWriter;
use std::collections::HashMap;
use std::error::Error;
use std::io::{Cursor, Read, Seek, Write};
use uasset_utils::paths::{PakPath, PakPathBuf, PakPathComponentTrait};
use unreal_asset::Asset;

#[derive(Debug, Default)]
struct Dir {
    name: String,
    children: HashMap<String, Dir>,
}

pub struct ModBundleWriter<W: Write + Seek> {
    pak_writer: PakWriter<W>,
    directories: HashMap<String, Dir>,
}

impl<W: Write + Seek> ModBundleWriter<W> {
    pub fn new(writer: W, fsd_paths: &[String]) -> Result<Self, Box<dyn Error>> {
        let mut directories: HashMap<String, Dir> = HashMap::new();
        for f in fsd_paths {
            let mut dir = &mut directories;
            for c in PakPath::new(f).components() {
                dir = &mut dir
                    .entry(c.as_str().to_ascii_lowercase())
                    .or_insert(Dir {
                        name: c.to_string(),
                        children: Default::default(),
                    })
                    .children;
            }
        }

        Ok(Self {
            pak_writer: repak::PakBuilder::new()
                .compression([repak::Compression::Zlib])
                .writer(writer, repak::Version::V11, "../../../".to_string(), None),
            directories,
        })
    }
    /// Used to normalize match path case to existing files in the DRG pak.
    pub fn normalize_path(&self, path_str: &str) -> PakPathBuf {
        let mut dir = Some(&self.directories);
        let path = PakPath::new(path_str);
        let mut normalized_path = PakPathBuf::new();
        for c in path.components() {
            if let Some(entry) = dir.and_then(|d| d.get(&c.as_str().to_ascii_lowercase())) {
                normalized_path.push(&entry.name);
                dir = Some(&entry.children);
            } else {
                normalized_path.push(c);
            }
        }
        normalized_path
    }

    pub fn write_file(&mut self, data: &[u8], path: &str) -> Result<(), Box<dyn Error>> {
        let normalized_path = self.normalize_path(path);
        self.pak_writer
            .write_file(normalized_path.as_str(), true, data)?;
        Ok(())
    }

    pub fn write_asset<C: Read + Seek>(
        &mut self,
        asset: Asset<C>,
        path: &str,
    ) -> Result<(), Box<dyn Error>> {
        let mut data_out = (Cursor::new(vec![]), Cursor::new(vec![]));

        asset.write_data(&mut data_out.0, Some(&mut data_out.1))?;
        data_out.0.rewind()?;
        data_out.1.rewind()?;

        self.write_file(&data_out.0.into_inner(), &format!("{path}.uasset"))?;
        self.write_file(&data_out.1.into_inner(), &format!("{path}.uexp"))?;

        Ok(())
    }

    pub fn finish(self) -> Result<(), Box<dyn Error>> {
        self.pak_writer.write_index().unwrap();
        Ok(())
    }
}
