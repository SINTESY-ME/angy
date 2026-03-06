<p align="center">
  <img src="public/angylogo.png" width="96" alt="Angy logo" />
</p>

<h1 align="center">Angy</h1>

<p align="center">A desktop app for managing fleets of Claude AI agents.</p>

---

Angy gives you a unified interface to spawn, orchestrate, and converse with multiple Claude Code agent instances. Each agent gets its own chat panel, a Monaco code editor, and a live terminal — all backed by a local SQLite store for persistent session history.

<p align="center">
  <img src="public/angy.png" alt="Angy building itself" width="700">
</p>

## Features

- **Agent fleet** — spawn, rename, favorite, and remove agents; each has an independent session
- **Orchestrator mode** — give a high-level goal and watch Claude delegate to specialist sub-agents (architect → implementer → reviewer → tester), validate with shell commands, and iterate to completion
- **Parallel delegation** — the orchestrator can fan out to multiple specialist agents simultaneously and aggregate their results
- **Agent messaging** — agents on the same team can send and receive messages via a shared inbox (used for peer coordination during orchestration)
- **Four interaction modes** — `agent` (full tool access), `ask` (read-only), `plan` (plan mode), `orchestrator` (high-level goal delegation)
- **Streaming responses** — real-time token streaming with thinking blocks and tool call visualization
- **Image support** — attach images to messages
- **File checkpointing** — rewind file changes to any prior checkpoint in a session
- **Integrated editor** — Monaco-based code viewer with syntax highlighting, diff view, inline edit bar, and breadcrumb navigation
- **Integrated terminal** — Xterm.js terminal panel per agent
- **Git integration** — diff tracking and a Git panel in the sidebar
- **Profiles** — configure custom system prompts and tool sets per-profile; stack multiple profiles on an agent
- **Local-first** — everything stored in SQLite on disk; no cloud account required beyond your Claude subscription

## Prerequisites

- **Node.js** (LTS recommended)
- **Rust toolchain** — install via [rustup.rs](https://rustup.rs)
- **Claude Code CLI** — must be installed and authenticated (`claude` binary in your PATH)

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run build
```

Type-checks, bundles the frontend, and packages a native desktop binary via Tauri. Output is in `src-tauri/target/release/`.

## Architecture

Angy wraps the `claude` CLI using Tauri's shell plugin. Each chat session spawns a new `claude` process with `--input-format stream-json` / `--output-format stream-json`, writes a JSON message envelope to stdin, and streams structured JSON events back on stdout.

The **Orchestrator** coordinates multi-agent workflows via an MCP server (`c3p2-orchestrator`) bundled with the app. The orchestrator Claude instance is restricted to four MCP tools — `delegate`, `validate`, `done`, and `fail` — and has no direct file access. Specialist agents (architect, implementer, reviewer, tester) run as normal agent sessions with full tool access.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri 2](https://tauri.app) (Rust) |
| Frontend | [Vue 3](https://vuejs.org) + TypeScript |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| State | [Pinia](https://pinia.vuejs.org) |
| Code editor | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| Terminal | [Xterm.js](https://xtermjs.org) |
| Syntax highlighting | [Shiki](https://shiki.style) |
| Persistence | SQLite via `@tauri-apps/plugin-sql` |
