<p align="center">
  <img src="public/angylogo.png" width="96" alt="Angy logo" />
</p>

<h1 align="center">Angy</h1>

<p align="center">A desktop app for managing fleets of Claude AI agents.</p>

---

Angy gives you a unified interface to spawn, orchestrate, and converse with multiple Claude agent instances. Each agent gets its own chat panel, a Monaco code editor, and a live terminal — all backed by a local SQLite store for persistent session history.

**Key features**

- Orchestrator engine for delegating tasks between agents
- Fleet management — add, rename, favorite, and remove agents
- Real-time chat with streaming Claude responses
- Integrated Monaco code editor and Xterm.js terminal
- Git-aware diff tracking
- Everything stored locally (SQLite, no cloud account needed)

## Dev

```bash
npm install
npm run tauri dev
```

Requires Node.js and the [Rust toolchain](https://rustup.rs).

## Build

```bash
npm run build      # type-checks, bundles frontend, packages desktop app
```

Output: platform-native binary produced by Tauri in `src-tauri/target/release/`.
