# MintCat Architecture Overview

## Project Overview

**MintCat** is a Deep Rock Galactic mod loader and integration tool built with a modern tech stack combining Rust backend (Tauri 2.0) and React frontend (TypeScript). The application provides comprehensive mod management capabilities including mod.io integration, local mod handling, and game integration features.

### Core Architecture
- **Frontend**: React 19 + TypeScript + Vite + Ant Design 5.x
- **Backend**: Rust + Tauri 2.0 with custom plugins
- **Database**: SQLite with Drizzle ORM for data persistence
- **Build System**: Vite for frontend, Cargo for Rust backend

### Key Features
- Mod.io API integration for search/download/update
- Local mod file management
- Game integration with UE4SS support
- Multi-profile mod configurations
- Real-time mod status tracking
- Auto-updater functionality

## Build & Commands

### Development Commands
```bash
# Install dependencies
pnpm install

# Start development server
pnpm tauri dev

# Run frontend only
pnpm dev

# Build for production
pnpm tauri build

# Run tests
pnpm test
pnpm test:run
pnpm test:ui
pnpm test:coverage
```

### Release Commands
```bash
# Build Windows release
./release.sh
```

### Environment Setup
- **Node.js**: Required for frontend development
- **Rust**: Required for Tauri backend
- **Tauri CLI**: `cargo install tauri-cli`
- **Signing**: Requires `TAURI_SIGNING_PRIVATE_KEY` environment variable for releases

## Code Style

### TypeScript/JavaScript
- **Target**: ES2020
- **Module**: ESNext with bundler resolution
- **Strict Mode**: Disabled (relaxed for migration)
- **Decorators**: Legacy decorators enabled for compatibility
- **React Compiler**: Enabled with React 19 target

### Naming Conventions
- **Files**: PascalCase for components, camelCase for utilities
- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Types**: PascalCase with `I` prefix for interfaces
- **Database**: snake_case for table/column names

### Import Organization
- Use `@/` alias for src directory imports
- Group imports: external → internal → relative
- React hooks and components use named imports

### Code Structure
- **Components**: Functional components with hooks
- **State Management**: React state + context for local state
- **Data Layer**: DAO pattern with Drizzle ORM
- **API Layer**: Tauri commands for backend communication

## Testing

### Testing Framework
- **Test Runner**: Vitest
- **Environment**: Node.js environment (supports sql.js)
- **Globals**: Enabled (describe/it/expect available globally)
- **Coverage**: Built-in coverage reporting

### Test Structure
- **Unit Tests**: Located in `tests/` directory
- **Database Tests**: `tests/storage/` for DAO testing
- **API Tests**: `tests/apis/` for backend integration
- **Test Timeout**: 10 seconds default

### Testing Commands
```bash
# Run all tests
pnpm test:run

# Run with UI
pnpm test:ui

# Generate coverage
pnpm test:coverage
```

## Security

### Application Security
- **Content Security Policy**: Currently null (development mode)
- **Asset Protocol**: Enabled for local file access
- **File System**: Restricted to app-specific directories
- **Network**: HTTPS only for mod.io API calls

### Data Protection
- **Local Storage**: Encrypted SQLite database
- **Credentials**: OAuth tokens stored securely
- **File Access**: Sandboxed to app directories
- **Updates**: Signed releases with public key verification

### Security Guidelines
- Never log sensitive data (tokens, paths)
- Validate all user inputs
- Use parameterized queries (Drizzle ORM handles this)
- Sanitize file paths before operations
- Implement proper error handling for file operations

## Configuration

### Application Paths
- **Windows Config**: `%APPDATA%\com.mint.cat`
- **macOS Config**: `~/Library/Application Support/com.mint.cat`
- **Windows Logs**: `%LOCALAPPDATA%\com.mint.cat\logs`
- **macOS Logs**: `~/Library/Logs/com.mint.cat`
- **Windows Cache**: `%LOCALAPPDATA%\com.mint.cat`
- **macOS Cache**: `~/Library/Caches/com.mint.cat`

### Database Schema
- **Core Tables**: games, users, mods, profiles
- **Relation Tables**: profile_mods, profile_folders
- **Version Tracking**: mod_versions, mod_status
- **Settings**: Single-row settings table

### Environment Variables
- `TAURI_SIGNING_PRIVATE_KEY`: Path to signing key for releases
- `TAURI_DEV_HOST`: Development host override
- `NODE_ENV`: Set to 'test' during testing

### Configuration Files
- **Tauri Config**: `src-tauri/tauri.conf.json`
- **Vite Config**: `vite.config.ts`
- **TypeScript**: `tsconfig.json`
- **Rust**: `src-tauri/Cargo.toml`

## Development Guidelines

### Code Review Checklist
- [ ] Follow naming conventions
- [ ] Include proper TypeScript types
- [ ] Add error handling for async operations
- [ ] Update tests for new features
- [ ] Check security implications
- [ ] Validate database migrations

### Migration Strategy
- Use Drizzle migrations for schema changes
- Maintain backward compatibility
- Test migrations with existing data
- Document breaking changes

### Performance Considerations
- Use database indexes for frequent queries
- Implement pagination for large mod lists
- Cache mod.io API responses appropriately
- Lazy load heavy components