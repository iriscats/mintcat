extern crate zip;

use std::error::Error;
use std::fs::File;
use std::io::Read;
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
