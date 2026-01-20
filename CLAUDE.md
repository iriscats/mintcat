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
pnpm build              # Build frontend assets
pnpm tauri build        # Build Tauri application for production
./release.sh            # Publish the application (uses cargo-xwin for Windows cross-compilation)
```

#### Cross-Platform Builds
```bash
pnpm tauri build --target x86_64-pc-windows-gnu    # Windows build
pnpm tauri build --target x86_64-unknown-linux-gnu  # Linux build
pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-gnu  # Windows build with cargo-xwin
```

#### Signed Builds (Production)
```bash
TAURI_SIGNING_PRIVATE_KEY="/path/to/key" pnpm tauri build
```

### Database Operations
```bash
pnpm gen-sql  # Generate SQLite migrations using Drizzle Kit
```

### Testing
```bash
# Frontend TypeScript type checking
npx tsc --noEmit       # Check types without emitting files

# Rust backend testing (run from src-tauri directory)
cd src-tauri && cargo test              # Run all Rust tests
cd src-tauri && cargo test -- --nocapture  # Run tests with stdout output
cd src-tauri && cargo test test_name    # Run specific test by name

# Build verification
pnpm preview           # Preview built application
```

## Architecture Overview

### Frontend Structure
- **App.tsx**: Main application component with page routing and layout
- **Core** (`src/core/`): Application initialization and dependency injection
  - `AppInitializer`: Handles database and core ViewModel initialization
  - `IoCRegistration`: Dependency injection container registration
- **ViewModels** (`src/`): MVVM pattern with singleton ViewModels at root level
  - `AppViewModel.ts`: Core app initialization, authentication, settings
  - Other ViewModels may be in subdirectories or pages
- **Pages** (`src/pages/`): Main application pages (Home, Modio, Settings, Chat)
- **Dialogs** (`src/dialogs/`): Modal dialogs for user interactions
- **Components** (`src/components/`): Reusable UI components
- **Services** (`src/services/`): Business logic and service layer
- **Events** (`src/events/`): Event-driven communication system

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

### Task System Architecture
- **ITask Interface**: Defines asynchronous operations with progress tracking
- **Task Queue Plugin**: Custom Tauri plugin for managing long-running operations
- **Progress Reporting**: Real-time progress updates for UI feedback
- **Error Handling**: Comprehensive error propagation and retry mechanisms
- **Task Types**: Download, install, update, and game launch operations

## Key Files to Understand

### Core Application Flow
- `src/App.tsx`: Main application component, registers ViewModels and initializes core
- `src/core/AppInitializer.ts`: Core initialization sequence (database + AppViewModel)
- `src/core/IoCRegistration.ts`: Dependency injection container setup
- `src/AppViewModel.ts`: Main app ViewModel for initialization, authentication, settings
- `src/storage/db/Schema.ts`: Complete database schema with documentation

### Mod Management
- `src/apis/modio/`: mod.io API integration
- `src/tasks/`: Asynchronous task system (install, update, launch, check updates)
  - `ModInstallTask.ts`, `ModUpdateTask.ts`, `LaunchTask.ts`, etc.
- `src/apis/IntegrateApi.ts`: Game integration and mod installation

### Storage and Configuration
- `src/storage/`: Database layer with DAOs and migrations
- `src/storage/dao/`: Data access objects for each entity (Game, Mod, User, Profile, etc.)
- `src/storage/migration/`: Versioned configuration migrations (V2, V3, V4, V5)
- `src/storage/index.ts`: Main storage API entry point

## Configuration Files

### TypeScript Configuration (`tsconfig.json`)
- **React Compiler**: Experimental support with decorators
- **Decorators**: Enabled (`experimentalDecorators: true`, `emitDecoratorMetadata: true`)
- **Strict Mode**: Disabled (`strict: false`)
- **Path Aliases**: `@/*` mapped to `src/*`
- **Target**: ESNext for modern JavaScript features

### Vite Configuration (`vite.config.ts`)
- **Port**: Fixed at 1420 for Tauri integration (HMR on 1421)
- **React Compiler**: Enabled with babel-plugin-react-compiler
- **Target**: ESNext for top-level await support
- **Build Output**: Optimized for Tauri frontend
- **Path Aliases**:
  - `@/*` mapped to `src/*`
  - `tauri-plugin-task-queue-api` mapped to `../tauri-plugin-task-queue/guest-js`

### Tauri Configuration (`src-tauri/Cargo.toml`)
- **Cross-compilation**: Windows (MSVC) and Linux targets supported
- **Custom Plugins**:
  - `tauri-plugin-task-queue` (from local path: `../../tauri-plugin-task-queue`)
  - `tauri-plugin-sentry` for error tracking
  - `tauri-plugin-deep-link` for OAuth deep linking
- **Game Integration**:
  - `repak` (with oodle compression) - Unreal Engine pak file handling
  - `unreal_asset`, `uasset_utils` - Unreal asset manipulation
  - `steamlocate` - Steam game detection
- **HTTP Client**: `reqwest` with rustls-tls
- **Archive Handling**: `zip` with AES encryption support

## Code Quality Tools

**Current Status**: No automated code quality tools are configured
- No ESLint setup for JavaScript/TypeScript
- No Prettier formatter
- No TypeScript testing framework (Jest/Vitest)
- No Rust formatting tools configured in CI

**Recommended additions**:
```bash
pnpm add -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
```

## Important Development Notes

- **React Compiler**: Experimental feature enabled (React 19), may cause build warnings
- **Decorators Pattern**: Used extensively in ViewModels for reactive programming
  - Requires `experimentalDecorators: true` and `useDefineForClassFields: false` in tsconfig
- **Lock Mechanism**: `ILock` abstract class ensures sequential operation execution in ViewModels
- **Cross-compilation**:
  - Uses `cargo-xwin` for Windows builds from non-Windows platforms
  - Requires proper Rust toolchain setup for target platforms
- **SQLite Database**:
  - Follows 3NF design principles with proper indexing
  - Uses Drizzle ORM for type-safe queries
  - Versioned migrations in `src/storage/migration/`
- **Mod Integration**:
  - Supports both local files and mod.io downloads
  - Unreal Engine pak file processing with compression support
  - Steam game auto-detection
- **Configuration Profiles**: Users can manage multiple mod setups independently
- **Task Queue System**:
  - Custom Tauri plugin for long-running operations
  - Progress tracking and real-time UI updates
  - Task types: Download, Install, Update, Launch, Check Updates
- **Error Tracking**: Sentry integration for production error monitoring
- **Auto-updater**: Configured with GitHub releases for seamless updates
- **Deep Linking**: OAuth authentication flow via deep links

## Application Paths

### Config Path
- **Windows**: `C:\Users\<Username>\AppData\Roaming\com.mint.cat`
- **macOS**: `~/Library/Application Support/com.mint.cat`

### Log Path
- **Windows**: `C:\Users\<Username>\AppData\Local\com.mint.cat\logs`
- **macOS**: `~/Library/Logs/com.mint.cat/mintcat.log`

### Cache Path
- **Windows**: `C:\Users\<Username>\AppData\Local\com.mint.cat\`
- **macOS**: `~/Library/Caches/com.mint.cat`