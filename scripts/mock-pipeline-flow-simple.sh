#!/bin/bash
# Mock Pipeline Flow — validates the new scope-aware hybrid architecture
# Calls Claude CLI through the full planning phase, stops before builders start.
# Usage: bash scripts/mock-pipeline-flow.sh

set -euo pipefail

OUTDIR=$(mktemp -d)
echo "Output directory: $OUTDIR"
echo ""

# ─── Toy spec (small but exercises all 3 scopes) ─────────────────────────────

cat > "$OUTDIR/spec.md" << 'SPEC'
# TaskPulse — Collaborative Task Manager

A full-stack task management app with real-time updates.

## Tech Stack
- Backend: Fastify + Drizzle ORM + PostgreSQL + Redis
- Frontend: Vue 3 + Pinia + Tailwind CSS
- Monorepo with npm workspaces: packages/backend, packages/frontend, packages/shared
- Docker Compose for local development

## Requirements

### Auth
- JWT (RS256) access + refresh tokens
- Login, register, logout endpoints
- Protected routes on frontend with auth guard

### Tasks
- CRUD: create, read (list + detail), update, delete
- Fields: title, description, status (todo/in_progress/done), priority (low/medium/high), assignee_id, due_date
- Filter by status, priority, assignee
- Pagination with cursor-based approach

### Real-time
- WebSocket channel per project: task created/updated/deleted events
- Optimistic updates on frontend

### Dashboard
- Task count by status (3 cards)
- Tasks due this week (list)
- Live-updating via WebSocket

### API Response Envelope
All responses: { success: boolean, data: T, meta?: { cursor, hasMore } }
Errors: { success: false, error: { code: string, message: string } }

### Docker
- docker-compose.yml with postgres, redis, backend, frontend
- Health checks on all services
- Seed script: 1 org, 2 users, 20 tasks

### Testing
- Backend: unit tests for auth middleware and task service
- Frontend: component test for TaskCard
- E2E: login → create task → verify in list
SPEC

echo "=== SPEC ($(wc -l < "$OUTDIR/spec.md") lines) ==="
echo ""

# ─── Prompts ──────────────────────────────────────────────────────────────────

# Architect Turn 1: System Architecture + Integration Contracts
cat > "$OUTDIR/prompt-arch-1.md" << 'PROMPT'
Analyze the specification below and design the system architecture.

IMPORTANT: Assess whether this is a new project or a change to an existing project.
Your plan will be executed by three types of specialized builders:
- **Scaffold builder**: sets up project structure, containerization, configs, and produces an integration test script. Does not write application logic.
- **Backend builder**: implements services, routes, data layer, jobs, realtime handlers. Reads your Integration Contracts section to get response shapes exactly right.
- **Frontend builder**: implements views, components, state management, routing, styles. Reads your Design System section for visual cohesion, and reads the actual backend code to match response shapes.

Structure your plan accordingly. In THIS turn, produce ONLY these sections:

## EXECUTION PLAN
Ordered steps grouped by scope (scaffold, backend, frontend). Note dependencies.

## FILE OWNERSHIP MATRIX
Which scope owns which files. No overlaps between scopes.

## CONVENTIONS DISCOVERED
Patterns that all builders must follow (naming, imports, error handling, etc.).

## TRAPS
Things builders must NOT do. Common mistakes to avoid.

## INTEGRATION CONTRACTS
For each API endpoint, specify:
- HTTP method, path, and purpose
- Request body schema with required/optional fields and types
- Response shape for success and error cases (status codes + EXACT body structure including nesting)
- WebSocket events emitted (event name + payload shape)

The response envelope structure must be UNAMBIGUOUS — a frontend builder reading this must be able to write stores that destructure correctly without reading backend code.

Be specific and actionable. A fresh builder with no prior context must be able to implement their scope from this plan alone.

# Specification

PROMPT

cat "$OUTDIR/spec.md" >> "$OUTDIR/prompt-arch-1.md"

# Architect Turn 2: Design System
cat > "$OUTDIR/prompt-arch-2.md" << 'PROMPT'
You previously designed the system architecture for TaskPulse. Now produce ONLY the DESIGN SYSTEM section.

This section is consumed directly by the frontend builder. Be specific enough that every page looks like it belongs to the same app.

## DESIGN SYSTEM

Include ALL of the following:
- Color palette: primary, secondary, accent, background, surface, text colors (as Tailwind classes or CSS custom properties)
- Typography: font family, heading scale, body size, weight conventions
- Component patterns: card style, form layout, table/list style, button variants, badge/chip style
- Layout structure: sidebar vs topbar, responsive breakpoints, page structure
- Visual tone: describe the overall aesthetic (e.g., "clean corporate dashboard", "playful minimal", "dark data-dense")
- Loading states: skeleton style, spinner placement
- Empty states: illustration style or text pattern
- Error states: inline vs toast, color/icon conventions

The frontend builder will use this as a design brief. If you are vague ("use a nice color"), the builder will default to unstyled HTML.

Here is the system architecture plan you produced (for context):

PROMPT

# Architect Turn 3: Verification Protocol
cat > "$OUTDIR/prompt-arch-3.md" << 'PROMPT'
You previously designed the system architecture and design system for TaskPulse. Now produce ONLY the VERIFICATION PROTOCOL section.

This section is consumed by tester agents. It must be specific enough that a tester with no project knowledge can start the app, seed data, and verify it works.

## VERIFICATION PROTOCOL

Include ALL of the following:

### Start
Exact commands to build and start all services from a clean state.

### Health Checks
For each service: the endpoint or command to verify it is healthy, and the expected response.

### Data Setup
Exact commands to run migrations and seed data. What seed data is created (counts, credentials).

### Test Credentials
Email and password for a test user that can log in after seeding.

### Smoke Steps
Numbered list of manual verification steps. For each:
- What to do (e.g., "Open http://localhost:5173")
- What to verify (e.g., "Login page renders with styled card, email/password fields, submit button")
- Expected data (e.g., "Dashboard shows 20 tasks, 3 status cards")

Include at least: login flow, main data list, create flow, real-time update verification.

### Teardown
Exact commands to stop and clean up all services and volumes.

Here is the full plan so far (for context):

PROMPT

# Counterpart Review
cat > "$OUTDIR/prompt-counterpart.md" << 'PROMPT'
You are an adversarial technical reviewer. Review the architect's plan below.

Verify ALL of the following:
1. Plan covers ALL spec requirements
2. No spec deviations — the plan implements exactly what is specified
3. File ownership has no overlaps between scopes (scaffold/backend/frontend)
4. Integration contracts specify EXACT response envelope structure (nesting depth, field names, status codes)
5. A frontend builder reading the integration contracts can write stores that destructure correctly WITHOUT reading backend code
6. Design system is specific enough — no vague instructions like "use a nice color"
7. Verification protocol has concrete commands, not placeholders
8. Test credentials are specified
9. Smoke steps cover: login, main data view, create flow, real-time update

End with:
- VERDICT: APPROVED — if the plan passes all checks
- VERDICT: CHALLENGED — followed by numbered issues with severity (CRITICAL/MAJOR/NIT)

# Architect's Full Plan

PROMPT

# Splitter
SPLITTER_SCHEMA='{"type":"object","properties":{"increments":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"scope":{"type":"string","enum":["scaffold","backend","frontend"]},"description":{"type":"string"},"files":{"type":"array","items":{"type":"string"}},"task":{"type":"string"},"verification":{"type":"string"}},"required":["name","scope","description","files","task","verification"]}}},"required":["increments"]}'

cat > "$OUTDIR/prompt-splitter.md" << 'PROMPT'
Split this architect plan into SEQUENTIAL build increments.

# Rules

1. Each increment MUST have a `scope`: `scaffold`, `backend`, or `frontend`.
2. `scaffold` = infrastructure (containerization, configs, build files, integration test script). Always FIRST. Only include if the task requires infrastructure changes.
3. `backend` = server-side (routes, services, data layer, jobs, realtime). No UI files.
4. `frontend` = client-side (views, components, state, routing, styles). No server files.
5. Do NOT mix backend and frontend files in the same increment.
6. Ordering: scaffold first, then all backend increments, then all frontend increments.
7. The frontend builder can read the completed backend code, so frontend increments come AFTER backend.
8. Number of increments: 1 for a small change, 2-3 for a medium feature, 3-6 for a large build.
9. Each increment's `verification` field describes the specific check for its scope:
   - scaffold: "all services start from clean state, healthchecks pass"
   - backend: "compilation clean, unit tests pass, specific endpoint returns expected shape"
   - frontend: "compilation clean, dev server renders styled content, specific page shows data"
10. Use the DESIGN SYSTEM section to inform frontend increment tasks.
11. Use the VERIFICATION PROTOCOL section to inform verification criteria.

# Plan to split

PROMPT

# ─── Execute flow ─────────────────────────────────────────────────────────────

CLAUDE="${HOME}/.local/bin/claude"
if [ ! -x "$CLAUDE" ]; then
  echo "Error: claude binary not found at $CLAUDE"
  exit 1
fi
MODEL_FLAG="--model sonnet"

echo "================================================================"
echo "  STEP 1: Architect Turn 1 — System Architecture"
echo "================================================================"
echo ""

ARCH1=$($CLAUDE -p $MODEL_FLAG < "$OUTDIR/prompt-arch-1.md")
echo "$ARCH1" > "$OUTDIR/01-architecture.md"
echo "$ARCH1"
echo ""
echo "--- [Saved to $OUTDIR/01-architecture.md] ---"
echo ""

echo "================================================================"
echo "  STEP 2: Architect Turn 2 — Design System"
echo "================================================================"
echo ""

cat "$OUTDIR/prompt-arch-2.md" > "$OUTDIR/prompt-arch-2-full.md"
echo "" >> "$OUTDIR/prompt-arch-2-full.md"
cat "$OUTDIR/01-architecture.md" >> "$OUTDIR/prompt-arch-2-full.md"

ARCH2=$($CLAUDE -p $MODEL_FLAG < "$OUTDIR/prompt-arch-2-full.md")
echo "$ARCH2" > "$OUTDIR/02-design-system.md"
echo "$ARCH2"
echo ""
echo "--- [Saved to $OUTDIR/02-design-system.md] ---"
echo ""

echo "================================================================"
echo "  STEP 3: Architect Turn 3 — Verification Protocol"
echo "================================================================"
echo ""

cat "$OUTDIR/prompt-arch-3.md" > "$OUTDIR/prompt-arch-3-full.md"
echo "" >> "$OUTDIR/prompt-arch-3-full.md"
cat "$OUTDIR/01-architecture.md" >> "$OUTDIR/prompt-arch-3-full.md"
echo -e "\n\n---\n\n" >> "$OUTDIR/prompt-arch-3-full.md"
cat "$OUTDIR/02-design-system.md" >> "$OUTDIR/prompt-arch-3-full.md"

ARCH3=$($CLAUDE -p $MODEL_FLAG < "$OUTDIR/prompt-arch-3-full.md")
echo "$ARCH3" > "$OUTDIR/03-verification-protocol.md"
echo "$ARCH3"
echo ""
echo "--- [Saved to $OUTDIR/03-verification-protocol.md] ---"
echo ""

# Assemble full plan
cat > "$OUTDIR/04-full-plan.md" << EOF
# SYSTEM ARCHITECTURE

$(cat "$OUTDIR/01-architecture.md")

---

# DESIGN SYSTEM

$(cat "$OUTDIR/02-design-system.md")

---

# VERIFICATION PROTOCOL

$(cat "$OUTDIR/03-verification-protocol.md")
EOF

echo "================================================================"
echo "  STEP 4: Counterpart Review"
echo "================================================================"
echo ""

cat "$OUTDIR/prompt-counterpart.md" > "$OUTDIR/prompt-counterpart-full.md"
echo "" >> "$OUTDIR/prompt-counterpart-full.md"
cat "$OUTDIR/04-full-plan.md" >> "$OUTDIR/prompt-counterpart-full.md"

REVIEW=$($CLAUDE -p $MODEL_FLAG < "$OUTDIR/prompt-counterpart-full.md")
echo "$REVIEW" > "$OUTDIR/05-counterpart-review.md"
echo "$REVIEW"
echo ""
echo "--- [Saved to $OUTDIR/05-counterpart-review.md] ---"
echo ""

echo "================================================================"
echo "  STEP 5: Splitter — Scope-Tagged Increments"
echo "================================================================"
echo ""

cat "$OUTDIR/prompt-splitter.md" > "$OUTDIR/prompt-splitter-full.md"
echo "" >> "$OUTDIR/prompt-splitter-full.md"
cat "$OUTDIR/04-full-plan.md" >> "$OUTDIR/prompt-splitter-full.md"

INCREMENTS=$($CLAUDE -p $MODEL_FLAG --output-format json --json-schema "$SPLITTER_SCHEMA" --tools '' < "$OUTDIR/prompt-splitter-full.md")
echo "$INCREMENTS" > "$OUTDIR/06-increments.json"

echo "================================================================"
echo "  FINAL: Scoped Build Phases"
echo "================================================================"
echo ""

# Pretty-print the increments using node since jq might not format as nicely
node -e "
const data = JSON.parse(require('fs').readFileSync('$OUTDIR/06-increments.json', 'utf8'));
const incs = data.structured_output?.increments || data.increments || [];
console.log('Total increments:', incs.length);
console.log('');
for (const [i, inc] of incs.entries()) {
  const scope = (inc.scope || 'unknown').toUpperCase().padEnd(10);
  console.log('┌─────────────────────────────────────────────────────────');
  console.log('│ Increment ' + (i+1) + ': ' + inc.name);
  console.log('│ Scope:       ' + scope);
  console.log('│ Description: ' + inc.description);
  console.log('│ Files:       ' + (inc.files || []).length + ' files');
  for (const f of (inc.files || [])) {
    console.log('│   - ' + f);
  }
  console.log('│ Verification: ' + (inc.verification || '').substring(0, 120));
  console.log('│ Builder:      builder-' + (inc.scope || 'unknown'));
  console.log('│ Tester:       tester-' + (inc.scope || 'unknown'));
  console.log('└─────────────────────────────────────────────────────────');
  console.log('');
}

const scopes = incs.map(i => i.scope);
const order = ['scaffold', 'backend', 'frontend'];
const sorted = [...scopes].sort((a, b) => order.indexOf(a) - order.indexOf(b));
const orderCorrect = JSON.stringify(scopes) === JSON.stringify(sorted);
console.log('Scope ordering correct (scaffold → backend → frontend):', orderCorrect ? 'YES' : 'NO — got: ' + scopes.join(' → '));
console.log('');
console.log('No mixed scopes:', scopes.every(s => ['scaffold','backend','frontend'].includes(s)) ? 'YES' : 'NO');
" 2>/dev/null || {
  echo "Raw JSON output:"
  cat "$OUTDIR/06-increments.json"
}

echo ""
echo "================================================================"
echo "  All outputs saved to: $OUTDIR"
echo "================================================================"
echo ""
echo "  01-architecture.md        — System arch + integration contracts"
echo "  02-design-system.md       — Design system"
echo "  03-verification-protocol.md — Verification protocol"
echo "  04-full-plan.md           — Concatenated full plan"
echo "  05-counterpart-review.md  — Counterpart verdict"
echo "  06-increments.json        — Scope-tagged increment plan"
echo ""
echo "  Pipeline would now dispatch:"
echo "    scaffold increments → builder-scaffold + tester-scaffold"
echo "    backend increments  → builder-backend  + tester-backend"
echo "    frontend increments → builder-frontend + tester-frontend"
echo ""
echo "  [STOPPED — builders would start here]"
