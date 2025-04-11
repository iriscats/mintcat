# MINTCAT
![Logo](.public/icon.ico)

# Introduction
MintCat is a Deep Rock Galactic mod loader and integration tool. It is built with Rust and Tauri, and the frontend is built with React and Typescript.


# Features
1. Mod Management
2. Mod Search
3. Mod Download
4. Mod Upload


# Architecture
1. Frontend: React + Typescript + Vite + AntDesign
2. Backend: Rust + Tauri 


## Tuari 2.0
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
macOS:
~/Library/Caches/com.mint.cat
```