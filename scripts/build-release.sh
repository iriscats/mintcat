# TAURI_SIGNING_PRIVATE_KEY 需要的是私钥的 base64 内容，不是路径。从文件读取：
KEY_FILE="${TAURI_KEY_FILE:-$HOME/.tauri/mintcat.key}"
if [ -f "$KEY_FILE" ]; then
  export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_FILE")"
fi
pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-gnu
