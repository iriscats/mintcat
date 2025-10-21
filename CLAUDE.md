# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MintCat is a Deep Rock Galactic mod loader and integration tool built with:
- **Frontend**: React + TypeScript + Vite + AntDesign
- **Backend**: Rust + Tauri 2.0
- **Database**: SQLite with Drizzle ORM
- **Mod Integration**: mod.io API, local file support, Unreal Engine pak integration

## Development Commands

### Setup and Development
```bash
pnpm install
pnpm tauri dev
```

### Build and Release
```bash
pnpm build
./release.sh  # Publish the application
```

### Database Operations
```bash
pnpm gen-sql  # Generate SQLite migrations using Drizzle Kit
```

## Architecture Overview

### Frontend Structure
- **App.tsx**: Main application component with page routing and layout
- **ViewModels** (`src/vm/`): MVVM pattern with singleton ViewModels
  - `AppViewModel`: Core app initialization, authentication, settings
  - `HomeViewModel`: Mod management and UI state
  - `ProfileViewModel`: Configuration profile management
- **Pages** (`src/pages/`): Main application pages (Home, Modio, Settings, Chat)
- **Dialogs** (`src/dialogs/`): Modal dialogs for user interactions
- **Components** (`src/components/`): Reusable UI components

### Backend Structure (Rust/Tauri)
- **Tauri 2.0** plugins for system integration:
  - File system operations (`tauri-plugin-fs`)
  - SQLite database (`tauri-plugin-sql`)
  - Process management (`tauri-plugin-process`)
  - Task queue system (custom `tauri-plugin-task-queue`)
- **Mod Integration**:
  - Unreal Engine pak file processing (`repak`, `unreal_asset`)
  - Steam game detection (`steamlocate`)
  - ZIP archive handling

### Database Schema (`src/storage/db/Schema.ts`)
- **Games**: Supported games with installation paths
- **Users**: User accounts and OAuth tokens
- **Mods**: Mod metadata, versions, download info
- **Profiles**: User mod configurations with folder structure
- **Settings**: Application-wide settings

### Key Patterns
- **Singleton ViewModels**: Centralized state management with locking mechanism (`ILock`)
- **Event-driven**: Tauri events for component communication
- **DAO Pattern**: Data access objects for database operations
- **Migration System**: Versioned config migrations in `src/storage/migration/`
- **Task Queue**: Asynchronous task management for downloads, updates, installations

## Key Files to Understand

### Core Application Flow
- `src/App.tsx:80`: AppViewModel initialization on component mount
- `src/vm/AppViewModel.ts:93`: Main app initialization sequence
- `src/storage/db/Schema.ts`: Complete database schema with documentation

### Mod Management
- `src/apis/modio/`: mod.io API integration
- `src/tasks/`: Asynchronous task system (install, update, launch)
- `src/apis/IntegrateApi.ts`: Game integration and mod installation

### Storage and Configuration
- `src/storage/`: Database layer with DAOs and migrations
- `src/storage/index.ts`: Main storage API entry point

## Important Development Notes

- The app uses Tauri 2.0 with extensive plugin ecosystem
- SQLite database follows 3NF design principles with proper indexing
- Mod integration supports both local files and mod.io downloads
- Configuration profiles allow users to manage multiple mod setups
- Task queue system handles long-running operations asynchronously