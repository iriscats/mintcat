# MINTCAT
![Logo](https://raw.githubusercontent.com/iriscats/mintcat/refs/heads/main/public/icon.ico)

# Introduction
MintCat is a Deep Rock Galactic mod loader and integration tool. It is built with Rust and Tauri, and the frontend is built with React and Typescript.


# Features
## 1. Mod Management:
- Add mods from mod.io
- Add mods from local files
- Update mods
- Mod rename

2. mod.io Search, Download, Update


# Architecture
1. Frontend: React + Typescript + Vite + AntDesign
2. Backend: Rust + Tauri 


## Tauri 2.0
https://v2.tauri.app/start/


## AntDesign
https://ant-design.antgroup.com/index-cn


## Modio RESTful API
https://docs.mod.io/restapiref/#getting-started


# Build & Dev

```
pnpm install 
pnpm tauri dev
```

# Publish

```shell
./release.sh
```


# App Path

## Config Path
```
Windows: 
C:\Users\Alice\AppData\Roaming\com.mint.cat

macOS:
~/Library/Application Support/com.mint.cat
```

## Log Path
```
Windows: 
C:\Users\Alice\AppData\Local\com.mint.cat\logs

macOS:
~/Library/Logs/com.mint.cat
```

## Cache Path
```
Windows: 
C:\Users\Alice\AppData\Local\com.mint.cat\

macOS:
~/Library/Caches/com.mint.cat
```

# RoadMap

## 0.5.0-beta1
- [ ] Task Manager
- [ ] Sqlite and Tauri Store

## 0.5.0-beta2
- [ ] Multi Game
- [ ] Plugin System

## 0.5.0-beta3
- [ ] Multi Mod Provider
- [ ] Login / Register

## 0.5.0-beta4
- [ ] Mod Hot Patch

## 0.5.0-beta5
- [ ] Online Mod Browser

