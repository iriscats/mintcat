# mintcat-proxy

跨平台命令行 Steam 网络加速工具：从 Watt Toolkit 云端拉取加速规则，在本地通过 **Hosts 劫持 + HTTPS MITM 反向代理** 将 Steam 相关流量导向指定上游。

> **免责声明**：本工具仅供学习与研究网络代理原理。使用前请确保符合当地法律法规及服务条款。MITM 会解密 HTTPS，请仅在可信环境、自有设备上使用。

## 功能概览

- 从 `api.steampp.net` 获取加速项目列表（与 Watt Toolkit 同源规则），并缓存到本地
- 修改系统 `hosts`，将规则中的监听域名指向本机代理
- 本地监听 HTTPS（默认 443），使用自签 CA 为各域名动态签发证书（需将 CA 安装为系统信任）
- 按规则中的 `ProxyType` 将请求转发到：直连 IP、DoH 解析后的域名、或完整目标 URL（含服务端加速模式）
- 上游 DNS 使用 **DNS-over-HTTPS**，避免在 Hosts 模式下走系统 DNS 造成解析环回

## 环境要求

- **Rust**：1.74+（建议当前 stable）
- **操作系统**：macOS / Linux / Windows
- **权限**：监听 443、写入 `hosts`、安装系统 CA 通常需要管理员/root 权限

## 构建

```bash
cd mintcat-proxy
cargo build --release
# 二进制位于 target/release/mintcat-proxy
```

## 快速开始

```bash
# 1. 安装 CA 到系统信任（需 sudo / 管理员）
sudo ./target/release/mintcat-proxy cert install

# 2. 拉取规则并启动代理（需 sudo：写 hosts + 绑定 443）
sudo ./target/release/mintcat-proxy start

# 3. 查看已缓存/拉取的规则
./target/release/mintcat-proxy rules

# 4. 停止并清理 hosts 中的标记段
sudo ./target/release/mintcat-proxy stop

# 5. 卸载 CA（可选）
sudo ./target/release/mintcat-proxy cert uninstall
```

### 常用参数

```bash
# 仅使用本地缓存规则，不访问 API
sudo mintcat-proxy start --offline

# 指定监听地址与端口
sudo mintcat-proxy start --bind 0.0.0.0 -p 443

# 强制从云端刷新规则后打印
mintcat-proxy rules --refresh
```

### 日志级别

```bash
RUST_LOG=debug sudo mintcat-proxy start
```

## 数据目录

默认位于用户主目录下：

| 路径 | 说明 |
|------|------|
| `~/.mintcat-proxy/ca.pem` | CA 根证书（PEM） |
| `~/.mintcat-proxy/ca.key` | CA 私钥 |
| `~/.mintcat-proxy/accelerate_cache.json` | Watt API 加速规则缓存 |

## 与 [Watt Toolkit](https://github.com/BeyondDimension/SteamTools) 的关系

本工具为独立实现的轻量 CLI，**加速规则数据源**与官方客户端一致（`api.steampp.net`），但**不包含** GUI、脚本注入、WinDivert DNS 拦截、系统代理/PAC 等完整功能。详细架构见 [docs/TECHNICAL.md](docs/TECHNICAL.md)。

## 许可证

请根据项目需要自行补充 LICENSE 文件（若与上游仓库一致，请遵循原项目条款）。

## 文档

- [技术说明（架构与模块）](docs/TECHNICAL.md)
