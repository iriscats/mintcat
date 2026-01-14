extern crate zip;

use std::error::Error;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use zip::read::ZipArchive;

pub fn read_files_from_zip_by_extension(
    zip_path: &str,
    extension: &str,
) -> Result<Vec<(String, Vec<u8>)>, Box<dyn Error>> {
    // 规范化扩展名格式（自动补全开头的点）
    let normalized_ext = if extension.starts_with('.') {
        extension.to_string()
    } else {
        format!(".{}", extension)
    };

    let file =
        File::open(zip_path).expect(format!("Failed to open ZIP file: {}", zip_path).as_str());

    let mut archive = ZipArchive::new(file).expect("Failed to parse ZIP archive");

    let mut result = Vec::new();
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .expect(format!("Failed to access entry at index {}", i).as_str());

        // 使用 Path 类型处理文件名扩展
        let path = Path::new(entry.name());
        if let Some(ext) = path.extension() {
            if ext == normalized_ext.trim_start_matches('.') {
                let mut contents = Vec::new();
                entry
                    .read_to_end(&mut contents)
                    .expect(format!("Failed to read: {}", entry.name()).as_str());
                result.push((entry.name().to_owned(), contents));
            }
        }
    }

    Ok(result)
}

/// Extracts all files from a ZIP archive to a specified directory
/// preserving the directory structure.
pub fn extract_zip_to_directory(zip_path: &str, output_dir: &str) -> Result<(), Box<dyn Error>> {
    let file = File::open(zip_path)?;
    let mut archive = ZipArchive::new(file)?;
    let output_path = Path::new(output_dir);

    // Create output directory if it doesn't exist
    if !output_path.exists() {
        fs::create_dir_all(output_path)?;
    }

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let entry_path = match entry.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let full_path = output_path.join(&entry_path);

        if entry.is_dir() {
            fs::create_dir_all(&full_path)?;
        } else {
            // Create parent directories if needed
            if let Some(parent) = full_path.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)?;
                }
            }

            // Extract file
            let mut outfile = File::create(&full_path)?;
            let mut contents = Vec::new();
            entry.read_to_end(&mut contents)?;
            outfile.write_all(&contents)?;
        }
    }

    Ok(())
}
