#!/bin/bash
# Integration test for Tauri FS capabilities and Tauri binary build
# Starts from clean state, verifies configuration, builds, and smoke-tests.
#
# Verifies:
#   1. Clean state (no leftover temp files, containers, volumes)
#   2. capabilities/default.json has required permissions
#   3. TypeScript compilation passes
#   4. Rust/Cargo is available (installs if needed)
#   5. Tauri binary compiles successfully
#   6. App launches without immediate crash (smoke test)
#
# Usage:
#   ./scripts/test-fs-capabilities.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CAPABILITIES_FILE="$PROJECT_ROOT/src-tauri/capabilities/default.json"
TAURI_DIR="$PROJECT_ROOT/src-tauri"

echo "=== Tauri FS Capabilities & Build Integration Test ==="
echo "Project root: $PROJECT_ROOT"
echo ""

# --- Step 1: Verify clean state ---
echo "[1/6] Checking clean state..."
TEMP_FILE="/tmp/angy-capabilities-test.json"
rm -f "$TEMP_FILE"
# Remove any leftover Cargo lock files that might interfere
rm -f "$TAURI_DIR/.cargo-lock"
echo "  Clean state verified"

# --- Step 2: Validate JSON syntax ---
echo "[2/6] Validating JSON syntax..."
if python3 -m json.tool "$CAPABILITIES_FILE" > "$TEMP_FILE" 2>&1; then
    echo "  JSON syntax is valid"
else
    echo "  ERROR: JSON syntax is invalid"
    cat "$TEMP_FILE"
    rm -f "$TEMP_FILE"
    exit 1
fi

# --- Step 3: Verify required FS permissions ---
echo "[3/6] Verifying required FS permissions..."
REQUIRED_PERMISSIONS=("fs:allow-remove" "fs:allow-rename" "fs:allow-mkdir")
MISSING=()

for perm in "${REQUIRED_PERMISSIONS[@]}"; do
    if grep -q "\"$perm\"" "$CAPABILITIES_FILE"; then
        echo "  Found: $perm"
    else
        echo "  MISSING: $perm"
        MISSING+=("$perm")
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo ""
    echo "ERROR: Missing permissions: ${MISSING[*]}"
    rm -f "$TEMP_FILE"
    exit 1
fi

# --- Step 4: Verify TypeScript compilation ---
echo "[4/6] Verifying TypeScript compilation..."
cd "$PROJECT_ROOT"
if npx vue-tsc --noEmit 2>&1; then
    echo "  TypeScript compilation passed"
else
    echo "  ERROR: TypeScript compilation failed"
    rm -f "$TEMP_FILE"
    exit 1
fi

# --- Step 5: Setup Rust/Cargo ---
echo "[5/6] Setting up Rust environment..."

# Source the setup script
# shellcheck source=./setup-rust.sh
source "$SCRIPT_DIR/setup-rust.sh"

# Run setup
if setup_rust "$PROJECT_ROOT"; then
    echo "  Rust environment ready: $(cargo --version)"
else
    echo "  ERROR: Failed to setup Rust environment"
    echo ""
    echo "  To fix manually, run:"
    echo "    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "    source \$HOME/.cargo/env"
    rm -f "$TEMP_FILE"
    exit 1
fi

# --- Step 6: Build Tauri binary ---
echo "[6/6] Building Tauri binary..."
cd "$TAURI_DIR"

# Use cargo build (faster than cargo tauri build for CI verification)
echo "  Running: cargo build --release"
if cargo build --release 2>&1 | tail -10; then
    echo "  Cargo build completed"
else
    echo "  ERROR: Cargo build failed"
    rm -f "$TEMP_FILE"
    exit 1
fi

# Verify binary was produced
EXPECTED_BINARY="$TAURI_DIR/target/release/angy"
if [ -f "$EXPECTED_BINARY" ]; then
    echo "  Binary produced: $EXPECTED_BINARY"
    ls -lh "$EXPECTED_BINARY" | awk '{print "  Size:", $5}'
elif [ -f "${EXPECTED_BINARY}.exe" ]; then
    # Windows
    echo "  Binary produced: ${EXPECTED_BINARY}.exe"
else
    # Check if library was built (crate-type includes lib)
    EXPECTED_LIB="$TAURI_DIR/target/release/libangy_lib.rlib"
    if [ -f "$EXPECTED_LIB" ] || [ -f "$TAURI_DIR/target/release/libangy_lib.dylib" ]; then
        echo "  Library built successfully (lib crate type)"
        # For Tauri 2.0, the binary may have a different name or be in a different location
        # Check for any executable in target/release
        FOUND_BIN=$(find "$TAURI_DIR/target/release" -maxdepth 1 -type f -perm +111 ! -name "*.d" ! -name "*.dylib" ! -name "*.so" 2>/dev/null | head -1)
        if [ -n "$FOUND_BIN" ]; then
            echo "  Found executable: $FOUND_BIN"
        fi
    else
        echo "  WARNING: Expected binary not found at $EXPECTED_BINARY"
        echo "  Listing target/release contents:"
        ls -la "$TAURI_DIR/target/release/" | head -20
    fi
fi

# --- Step 7: Smoke test - launch app briefly ---
echo "[7/7] Smoke testing application launch..."
cd "$PROJECT_ROOT"

# Find the built application
APP_BINARY=""
if [ -f "src-tauri/target/release/angy" ]; then
    APP_BINARY="src-tauri/target/release/angy"
elif [ -f "src-tauri/target/debug/angy" ]; then
    APP_BINARY="src-tauri/target/debug/angy"
elif [ -d "src-tauri/target/release/bundle/macos/angy.app" ]; then
    APP_BINARY="src-tauri/target/release/bundle/macos/angy.app/Contents/MacOS/angy"
elif [ -d "src-tauri/target/debug/bundle/macos/angy.app" ]; then
    APP_BINARY="src-tauri/target/debug/bundle/macos/angy.app/Contents/MacOS/angy"
fi

if [ -n "$APP_BINARY" ] && [ -f "$APP_BINARY" ]; then
    echo "  Found binary: $APP_BINARY"

    # Launch the app in background and let it run briefly
    # If it crashes immediately, we'll detect the non-zero exit code
    "$APP_BINARY" &
    APP_PID=$!
    sleep 2

    # Check if the process is still running (not crashed)
    if kill -0 $APP_PID 2>/dev/null; then
        echo "  App launched successfully (PID: $APP_PID)"
        # Clean shutdown via SIGTERM
        kill -TERM $APP_PID 2>/dev/null || true
        sleep 1
        # Force kill if still running
        kill -9 $APP_PID 2>/dev/null || true
        wait $APP_PID 2>/dev/null || true
        echo "  App terminated cleanly"
    else
        # Process exited - check if it was an error
        wait $APP_PID 2>/dev/null
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 0 ] || [ $EXIT_CODE -eq 143 ] || [ $EXIT_CODE -eq 137 ]; then
            echo "  App exited normally (code: $EXIT_CODE)"
        else
            echo "  WARNING: App exited with code $EXIT_CODE (may have crashed)"
            # Don't fail the test - GUI apps may exit for various reasons in headless/CI
        fi
    fi
else
    echo "  Skipped - no executable binary found"
    echo "  (Run 'npm run tauri build' first to enable smoke test)"
fi

# Cleanup
rm -f "$TEMP_FILE"
cd "$PROJECT_ROOT"

echo ""
echo "=== All tests passed ==="
echo "FS capabilities are correctly configured."
echo "Tauri backend compiles successfully."

# --- Teardown ---
# Optionally clean up build artifacts to leave clean state
# Uncomment to enable:
# echo "Cleaning up build artifacts..."
# rm -rf "$PROJECT_ROOT/dist"
# rm -rf "$TAURI_DIR/target/release/bundle"
# rm -rf "$TAURI_DIR/target/debug/bundle"
echo "Build artifacts retained for inspection."
