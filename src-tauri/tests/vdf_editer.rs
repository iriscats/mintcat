use keyvalues_parser::{Vdf};
#[test]
fn test_vdf_edit() {
    let contents = std::fs::read_to_string("/Users/bytedance/Desktop/localconfig.vdf").unwrap();
    match Vdf::parse(&contents) {
        Ok(contents) => {
            println!("{:#?}", contents);
        }
        Err(err) => {
            eprintln!("Failed parsing with escaped characters: {:#?}", err);
        }
    }
}
