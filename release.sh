export TAURI_SIGNING_PRIVATE_KEY="~/.tauri/mintcat.key"
pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
