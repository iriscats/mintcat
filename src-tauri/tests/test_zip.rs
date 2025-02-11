fn main() {
    if let Err(e) = run() {
        eprintln!("Error: {}", e);
    }
}

fn run() -> anyhow::Result<()> {
    // 示例：同时查询 .pak 和 .txt 文件
    let extensions = [".pak", ".txt"];
    for ext in extensions {
        let files = read_files_from_zip_by_extension("example.zip", ext)?;
        println!("\nFiles with extension '{}':", ext);
        for (filename, contents) in files {
            println!("- {} ({} bytes)", filename, contents.len());
        }
    }
    Ok(())
}
