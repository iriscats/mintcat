//! Unpacked mod directory handling
//!
//! This module provides functionality to process unpacked mod directories
//! that contain Content folder with uasset/uexp files, converting them
//! into a format that can be processed like regular pak files.

use anyhow::{Context, Result};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Represents an unpacked mod directory structure
pub struct UnpackedMod {
    /// Root path of the unpacked mod
    root_path: PathBuf,
    /// Collected files with their pak-relative paths
    files: HashMap<String, Vec<u8>>,
}

impl UnpackedMod {
    /// Create a new UnpackedMod from a directory path
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let root_path = path.as_ref().to_path_buf();

        if !root_path.is_dir() {
            anyhow::bail!("Path is not a directory: {:?}", root_path);
        }

        Ok(Self {
            root_path,
            files: HashMap::new(),
        })
    }

    /// Check if a directory is a valid unpacked mod directory
    /// A valid unpacked mod directory should contain a Content folder with uasset/uexp files
    pub fn is_valid_unpacked_mod<P: AsRef<Path>>(path: P) -> bool {
        let path = path.as_ref();

        if !path.is_dir() {
            return false;
        }

        // Look for Content directory
        let content_path = path.join("Content");
        if !content_path.is_dir() {
            return false;
        }

        // Check if there are any .uasset or .uexp files in the Content directory (recursively)
        Self::has_asset_files(&content_path)
    }

    /// Check if a directory contains any .uasset or .uexp files recursively
    fn has_asset_files(dir: &Path) -> bool {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if Self::has_asset_files(&path) {
                        return true;
                    }
                } else if let Some(ext) = path.extension() {
                    let ext_lower = ext.to_string_lossy().to_lowercase();
                    if ext_lower == "uasset" || ext_lower == "uexp" {
                        return true;
                    }
                }
            }
        }
        false
    }

    /// Load all files from the unpacked mod directory
    pub fn load_files(&mut self) -> Result<()> {
        self.files.clear();

        // Find the Content directory
        let content_path = self.root_path.join("Content");
        if !content_path.is_dir() {
            anyhow::bail!(
                "Content directory not found in unpacked mod: {:?}",
                self.root_path
            );
        }

        // Walk through all files in the Content directory
        for entry in WalkDir::new(&content_path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            // Skip directories
            if path.is_dir() {
                continue;
            }

            // Get the relative path from Content directory
            let relative_path = path
                .strip_prefix(&content_path)
                .with_context(|| format!("Failed to get relative path for: {:?}", path))?;

            // Construct the pak-style path: FSD/Content/...
            let pak_path = format!("FSD/Content/{}", relative_path.to_string_lossy().replace('\\', "/"));

            // Read the file content
            let content = fs::read(path)
                .with_context(|| format!("Failed to read file: {:?}", path))?;

            self.files.insert(pak_path, content);
        }

        if self.files.is_empty() {
            anyhow::bail!("No files found in unpacked mod: {:?}", self.root_path);
        }

        Ok(())
    }

    /// Get the loaded files
    pub fn files(&self) -> &HashMap<String, Vec<u8>> {
        &self.files
    }

    /// Get the root path
    pub fn root_path(&self) -> &Path {
        &self.root_path
    }

    /// Get file count
    pub fn file_count(&self) -> usize {
        self.files.len()
    }

    /// Get an iterator over the files with their pak paths
    pub fn iter(&self) -> impl Iterator<Item = (&String, &Vec<u8>)> {
        self.files.iter()
    }

    /// Get the names of uasset files (without extension)
    pub fn get_asset_names(&self) -> Vec<String> {
        self.files
            .keys()
            .filter(|p| p.ends_with(".uasset"))
            .map(|p| p.strip_suffix(".uasset").unwrap().to_string())
            .collect()
    }

    /// Get both uasset and uexp data for an asset path
    pub fn get_asset_pair(&self, base_path: &str) -> Option<(Vec<u8>, Vec<u8>)> {
        let uasset_path = format!("{}.uasset", base_path);
        let uexp_path = format!("{}.uexp", base_path);

        let uasset = self.files.get(&uasset_path)?;
        let uexp = self.files.get(&uexp_path)?;

        Some((uasset.clone(), uexp.clone()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_is_valid_unpacked_mod_with_content() {
        let dir = tempdir().unwrap();
        let content_dir = dir.path().join("Content");
        fs::create_dir(&content_dir).unwrap();

        // Create a dummy .uasset file
        let mut file = File::create(content_dir.join("test.uasset")).unwrap();
        file.write_all(b"dummy content").unwrap();

        assert!(UnpackedMod::is_valid_unpacked_mod(dir.path()));
    }

    #[test]
    fn test_is_valid_unpacked_mod_without_content() {
        let dir = tempdir().unwrap();
        assert!(!UnpackedMod::is_valid_unpacked_mod(dir.path()));
    }

    #[test]
    fn test_is_valid_unpacked_mod_empty_content() {
        let dir = tempdir().unwrap();
        let content_dir = dir.path().join("Content");
        fs::create_dir(&content_dir).unwrap();

        // Content directory exists but no asset files
        assert!(!UnpackedMod::is_valid_unpacked_mod(dir.path()));
    }
}
