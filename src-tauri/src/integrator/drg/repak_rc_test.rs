//! 阶段 3.1：repak 对 RC (UE 5.6) pak 的读写实测
//!
//! 运行：REPAK_RC_TEST_PAK="/path/to/RCMod-Hazard Stage6_P.pak" cargo test repak_rc -- --nocapture

#[cfg(test)]
mod tests {
    use anyhow::Context;
    use std::fs;
    use std::io::{BufReader, BufWriter, Cursor, Write};

    const DEFAULT_RC_MOD_PAK: &str = "/Users/bytedance/Desktop/RCMod-Hazard Stage6_P.pak";

    fn rc_mod_pak_path() -> Option<String> {
        std::env::var("REPAK_RC_TEST_PAK").ok().or_else(|| {
            if std::path::Path::new(DEFAULT_RC_MOD_PAK).exists() {
                Some(DEFAULT_RC_MOD_PAK.to_string())
            } else {
                None
            }
        })
    }

    /// 1) 读取 RC mod pak：解析、列出 mount_point 与文件列表、读一个文件
    #[test]
    fn repak_rc_read() {
        let path = rc_mod_pak_path().expect(
            "Set REPAK_RC_TEST_PAK to RC mod pak path, or place pak at DEFAULT_RC_MOD_PAK",
        );
        println!("[repak_rc] Reading: {}", path);

        let file = fs::File::open(&path).expect("open pak file");
        let mut reader = BufReader::new(file);

        let pak = repak::PakBuilder::new()
            .reader(&mut reader)
            .context("parse RC mod pak")
            .expect("repak should parse RC pak");

        let mount = pak.mount_point();
        let files = pak.files();
        println!("[repak_rc] mount_point: {:?}", mount);
        println!("[repak_rc] file count: {}", files.len());

        let sample: Vec<_> = files.iter().take(10).map(|p| p.as_str().to_string()).collect();
        println!("[repak_rc] first 10 paths: {:?}", sample);

        if let Some(first) = files.first() {
            let mut cursor = Cursor::new(fs::read(&path).expect("re-read file"));
            let data = pak
                .get(first, &mut cursor)
                .context("get first file")
                .expect("read first entry");
            println!("[repak_rc] first entry size: {} bytes", data.len());
        }

        println!("[repak_rc] READ OK: repak can parse and read this RC mod pak.");
    }

    /// 2) 写一个最小的 mod pak (V11)，再读回，确认写兼容
    #[test]
    fn repak_rc_write_then_read() {
        let path = rc_mod_pak_path().expect(
            "Set REPAK_RC_TEST_PAK to RC mod pak path, or place pak at DEFAULT_RC_MOD_PAK",
        );

        let file = fs::File::open(&path).expect("open pak file");
        let mut reader = BufReader::new(file);
        let pak = repak::PakBuilder::new()
            .reader(&mut reader)
            .expect("parse pak");
        let mount = pak.mount_point();
        let file_list: Vec<String> = pak.files().iter().map(|p| p.as_str().to_string()).collect();

        let out_path = std::env::temp_dir().join("mintcat_repak_rc_test_out.pak");
        let out_file = fs::File::create(&out_path).expect("create temp pak");
        let mut writer = BufWriter::new(out_file);

        let mut pak_writer = repak::PakBuilder::new()
            .compression([repak::Compression::Zlib])
            .writer(&mut writer, repak::Version::V11, mount.to_string(), None);

        let test_content = b"repak_rc_write_test";
        let test_path = if file_list.is_empty() {
            "RogueCore/Content/Test/repak_test.txt".to_string()
        } else {
            file_list.first().cloned().unwrap()
        };
        pak_writer
            .write_file(&test_path, true, test_content)
            .expect("write one file");
        pak_writer.write_index().expect("write index");
        writer.flush().expect("flush");

        let written = fs::read(&out_path).expect("read back written pak");
        let mut read_cursor = Cursor::new(&written);
        let pak2 = repak::PakBuilder::new()
            .reader(&mut read_cursor)
            .expect("parse written pak");
        let files2 = pak2.files();
        assert!(!files2.is_empty(), "written pak should have entries");
        let mount2 = pak2.mount_point();
        println!("[repak_rc] written pak mount_point: {:?}, file count: {}", mount2, files2.len());

        let mut read_cursor2 = Cursor::new(&written);
        let data = pak2.get(files2.first().unwrap(), &mut read_cursor2).expect("get from written");
        println!("[repak_rc] read back size: {} bytes", data.len());

        let _ = fs::remove_file(&out_path);
        println!("[repak_rc] WRITE+READ OK: V11 mod pak is compatible.");
    }
}
