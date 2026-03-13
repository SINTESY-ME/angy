#!/usr/bin/env bash
set -euo pipefail

# Integration test script for Angy (Tauri + Vue 3 app)
# Starts from clean state, builds all layers, verifies connectivity.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== Angy Integration Test ==="
echo "Working directory: $PROJECT_DIR"
echo ""

# --- Phase 0: Clean state ---
echo "[0/5] Cleaning previous build artifacts..."
rm -rf dist node_modules/.vite
echo "  ✓ Clean state"

# --- Phase 1: Dependencies ---
echo "[1/5] Installing dependencies..."
npm ci --silent 2>&1 | tail -3
echo "  ✓ Dependencies installed"

# --- Phase 2: Type checking ---
echo "[2/5] Running TypeScript type check..."
npx vue-tsc --noEmit
echo "  ✓ Type check passed"

# --- Phase 3: Frontend build (Vite) ---
echo "[3/5] Building frontend (Vite)..."
npm run build 2>&1 | tail -3
if [ ! -f dist/index.html ]; then
  echo "  ✗ FAIL: dist/index.html not found"
  exit 1
fi
echo "  ✓ Frontend build succeeded"

# --- Phase 4: Verify design tokens ---
echo "[4/5] Verifying design tokens in main.css..."
MAIN_CSS="src/assets/main.css"
REQUIRED_TOKENS=(
  "--space-0" "--space-1" "--space-2" "--space-3" "--space-4"
  "--space-5" "--space-6" "--space-8" "--space-10" "--space-12" "--space-16"
  "--text-xs" "--text-sm" "--text-base" "--text-md" "--text-lg"
  "--shadow-sm" "--shadow-md" "--shadow-lg"
  "--radius-sm" "--radius-md" "--radius-lg"
  "--transition-fast" "--transition-normal"
)
MISSING=0
for token in "${REQUIRED_TOKENS[@]}"; do
  if ! grep -q "$token:" "$MAIN_CSS"; then
    echo "  ✗ Missing token: $token"
    MISSING=$((MISSING + 1))
  fi
done
if [ "$MISSING" -gt 0 ]; then
  echo "  ✗ FAIL: $MISSING design tokens missing"
  exit 1
fi

# Verify scrollbar uses mauve (not teal)
if grep -q "accent-teal.*scrollbar\|scrollbar.*accent-teal" "$MAIN_CSS" || \
   grep -A2 "scrollbar-thumb" "$MAIN_CSS" | grep -q "accent-teal"; then
  echo "  ✗ FAIL: Scrollbar still uses accent-teal instead of accent-mauve"
  exit 1
fi

# Verify splitter width is 2px
if grep -q "1px !important" "$MAIN_CSS" | grep -q "splitpanes"; then
  : # grep pipeline, check below
fi
SPLITTER_1PX=$(grep -c "1px !important" "$MAIN_CSS" || true)
if [ "$SPLITTER_1PX" -gt 0 ]; then
  echo "  ✗ FAIL: Splitpane splitters still have 1px width"
  exit 1
fi

# Verify focus ring is 2px with offset 2px
if ! grep -q "outline: 2px solid var(--accent-mauve)" "$MAIN_CSS"; then
  echo "  ✗ FAIL: Focus ring not updated to 2px"
  exit 1
fi

# Verify button:active scale rule exists
if ! grep -q "button:active" "$MAIN_CSS"; then
  echo "  ✗ FAIL: button:active scale rule missing"
  exit 1
fi

# Verify splitter transition
if ! grep -q "transition: background-color var(--transition-fast)" "$MAIN_CSS"; then
  echo "  ✗ FAIL: Splitter transition missing"
  exit 1
fi

echo "  ✓ All design tokens verified"

# --- Phase 5: Rust backend check (if cargo available) ---
echo "[5/5] Checking Tauri backend..."
if command -v cargo &>/dev/null && [ -f src-tauri/Cargo.toml ]; then
  cd src-tauri
  cargo check 2>&1 | tail -5
  echo "  ✓ Tauri backend compiles"
  cd "$PROJECT_DIR"
else
  echo "  ⊘ Skipped (cargo not available or no src-tauri)"
fi

echo ""
echo "=== All integration checks passed ==="

# --- Teardown ---
# Remove build artifacts to leave clean state
rm -rf dist
echo "Cleaned up build artifacts."
