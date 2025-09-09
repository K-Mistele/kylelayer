---
date: 2025-09-08T14:23:17-05:00
researcher: claude-opus-4-1
git_commit: 77070472ff1f8b0ca307e3787bdafb0dcb536c39
branch: master
repository: kylelayer
topic: "How to build and start the WUI at packages/humanlayer-wui"
tags: [research, codebase, humanlayer-wui, build-system, tauri, vite, bun]
status: complete
last_updated: 2025-09-08
last_updated_by: claude-opus-4-1
type: research
---

# Research: How to build and start the WUI at packages/humanlayer-wui

**Date**: 2025-09-08T14:23:17-05:00  
**Researcher**: claude-opus-4-1  
**Git Commit**: 77070472ff1f8b0ca307e3787bdafb0dcb536c39  
**Branch**: master  
**Repository**: kylelayer

## Research Question
How can I build and start the WUI at packages/humanlayer-wui?

## Summary
The HumanLayer WUI is a hybrid web/desktop application built with Vite + React for the frontend and Tauri v2 for native desktop integration, using Bun as the primary build tool. The application can be started in development mode using `bun run dev` or built for production using `bun run build`. The README mentions `make codelayer-dev` commands that don't appear to exist in the current codebase.

## Quick Start Commands

### Development Mode
```bash
cd packages/humanlayer-wui
bun install
bun run dev
```

### Production Build
```bash
cd packages/humanlayer-wui
bun install
bun run build
```

### Alternative Development (Tauri Desktop)
```bash
cd packages/humanlayer-wui
./run-instance.sh [port]  # Default port: 1420
```

## Detailed Findings

### Build System Architecture
- **Primary Tool**: Bun (as specified in CLAUDE.md instructions)
- **Frontend**: Vite + React with TypeScript
- **Desktop**: Tauri v2 for native desktop packaging
- **Development Server**: Port 1420 (configurable via VITE_PORT)
- **HMR**: Hot Module Reload on port 1421 (dev port + 1)

### Package Configuration (`packages/humanlayer-wui/package.json:6-16`)
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build", 
  "preview": "vite preview",
  "tauri": "tauri",
  "lint": "eslint . --ext .ts,.tsx",
  "format": "prettier --write .",
  "typecheck": "tsc --noEmit",
  "test": "bun test"
}
```

### Entry Points
- **Web Entry**: `index.html:33` → `src/main.tsx:13-21` → `src/router.tsx:10-41`
- **Desktop Entry**: `src-tauri/src/main.rs:4-6` → `src-tauri/src/lib.rs:332-518`
- **Development**: Vite dev server on port 1420
- **Production**: Static assets built to `dist/` directory

### Daemon Integration
The WUI includes automatic daemon management:
- **Development**: Spawns development daemon with branch-specific isolation
- **Production**: Manages bundled daemon lifecycle
- **Configuration**: Uses environment variables for daemon control
  - `HUMANLAYER_WUI_AUTOLAUNCH_DAEMON=false` to disable auto-launch
  - `HUMANLAYER_DAEMON_HTTP_PORT=7777` to use existing daemon

### Build Pipeline

#### Development Mode (`bun run dev`)
1. Vite dev server starts on port 1420 (`vite.config.ts:50-51`)
2. React DevTools injection available at localhost:8097 (`vite.config.ts:14-33`)
3. HMR enabled with WebSocket on port 1421 (`vite.config.ts:54-60`)
4. For Tauri desktop: daemon auto-launch spawns development daemon (`src-tauri/src/lib.rs:415-441`)

#### Production Build (`bun run build`)
1. TypeScript compilation via `tsc`
2. Vite build bundles to `dist/` directory
3. For desktop: Tauri packages app with native binaries
4. Resource bundling includes daemon executables (`src-tauri/tauri.conf.json:38`)

## Code References
- `packages/humanlayer-wui/package.json:7` - Development server command
- `packages/humanlayer-wui/package.json:8` - Production build command
- `packages/humanlayer-wui/vite.config.ts:36-66` - Vite configuration
- `packages/humanlayer-wui/src-tauri/tauri.conf.json:6-44` - Tauri configuration
- `packages/humanlayer-wui/run-instance.sh:1-18` - Custom port startup script
- `packages/humanlayer-wui/Makefile:12-16` - Make targets for development and building

## Architecture Insights
- **Hybrid Architecture**: Web frontend with optional native Tauri desktop wrapper
- **Daemon Management**: Automatic process spawning and lifecycle management
- **Branch Isolation**: Development configurations separated by git branch
- **Environment Detection**: Different behaviors for dev vs production builds
- **Resource Bundling**: External daemon binaries embedded in production builds

## Discrepancies Found
The README.md references `make codelayer-dev` and `make codelayer-bundle` commands that don't exist:
- `packages/humanlayer-wui/README.md:17` mentions `make codelayer-dev`
- `packages/humanlayer-wui/README.md:44` mentions `make codelayer-bundle`
- No corresponding Makefile targets found in `packages/humanlayer-wui/Makefile`
- No root-level Makefile found in the project

## Working Commands
Based on actual available scripts and configurations:

### Development
```bash
# Web development server
cd packages/humanlayer-wui
bun run dev

# Desktop development (Tauri)  
cd packages/humanlayer-wui
bun run tauri dev

# Custom port instance
cd packages/humanlayer-wui
./run-instance.sh 3000
```

### Production
```bash
# Build web assets
cd packages/humanlayer-wui  
bun run build

# Build desktop app (if Tauri is configured)
cd packages/humanlayer-wui
bun run tauri build
```

### Quality Checks
```bash
cd packages/humanlayer-wui
make check  # Run all quality checks (format, lint, typecheck, rust)
make test   # Run tests
```

## Environment Variables
- `VITE_PORT`: Development server port (default: 1420)
- `HUMANLAYER_WUI_AUTOLAUNCH_DAEMON`: Set to `false` to disable daemon auto-launch
- `HUMANLAYER_DAEMON_HTTP_PORT`: Use existing daemon on specified port

## Open Questions
1. Are the `make codelayer-dev` commands in the README outdated documentation?
2. Is there a separate build system or scripts that define these codelayer targets?
3. Should the documentation be updated to reflect the actual available commands?