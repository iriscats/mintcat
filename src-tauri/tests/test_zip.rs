use mintcat_lib::capability::zip::read_files_from_zip_by_extension;

#[test]
fn test_read_files_from_zip_by_extension() {
    // 测试 zip 文件路径
    let zip_path = "/Users/Desktop/data/test.zip";

    // 测试要查找的扩展名
    let extension = "pak";

    // 调用函数并断言结果非空
    let file_paths = read_files_from_zip_by_extension(zip_path, extension);
    assert!(!file_paths.is_ok());
}
