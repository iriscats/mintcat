# MintCat

MintCat is a desktop mod management application whose update system separates the stable application shell from independently updated feature and resource components.

## Language

**Control Plane**:
The stable application shell that owns update orchestration, network and proxy configuration, downloads, resource activation, and recovery.
_Avoid_: Tauri backend, host shell

**Control Plane API**:
The versioned capability surface exposed by the Control Plane to the frontend and Backend Runtime.
_Avoid_: App version, shell version

**Backend Runtime**:
The trusted native runtime that provides hot-updatable business capabilities behind the Control Plane.
_Avoid_: Integrator Runtime, plugin DLL

**Release Set**:
A coordinated update unit that describes which frontend, Backend Runtime, and resource components are compatible and active together.
_Avoid_: Update batch, version bundle

**Hot Update Store**:
The managed local store for verified hot-update components and their activation state.
_Avoid_: Cache, download folder

**Internal Asset**:
A MintCat-managed resource required by core workflows, such as game integration support archives.
_Avoid_: Cache file, dependency zip

**Optional Asset Pack**:
A user-installed resource pack for an optional capability, such as dynamic wallpaper assets.
_Avoid_: Plugin, cache pack

**Release Channel**:
The selected update lane used to resolve compatible release sets and components.
_Avoid_: Environment, branch

**Safe Mode**:
The recovery state that disables the active hot update and loads bundled assets so the user can repair the installation.
_Avoid_: Rollback, fallback mode
