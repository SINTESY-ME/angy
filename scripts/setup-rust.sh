#!/bin/bash
# Setup Rust/Cargo for Tauri development and CI
# This script ensures Rust is available and properly configured.
# Can be sourced by other scripts or run standalone.
#
# Usage:
#   ./scripts/setup-rust.sh           # Install Rust and print instructions
#   source scripts/setup-rust.sh      # Source for use in other scripts
#   setup_rust /path/to/project       # Call setup function directly

set -e

# Configuration
RUST_MIN_VERSION="1.70.0"
CARGO_ENV="$HOME/.cargo/env"

# Detect if being sourced or executed directly
(return 0 2>/dev/null) && SOURCED=1 || SOURCED=0

log() {
    echo "[setup-rust] $*"
}

ensure_rust_installed() {
    if command -v cargo &>/dev/null; then
        log "Cargo found: $(cargo --version)"
        return 0
    fi

    log "Cargo not found. Attempting to install Rust via rustup..."

    # Check if rustup is available
    if command -v rustup &>/dev/null; then
        log "rustup found but cargo missing. Running rustup update..."
        rustup update stable
    else
        log "Installing rustup..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
    fi

    # Source cargo environment
    if [ -f "$HOME/.cargo/env" ]; then
        # shellcheck source=/dev/null
        source "$HOME/.cargo/env"
    fi

    # Verify installation
    if ! command -v cargo &>/dev/null; then
        log "ERROR: Failed to install Rust. Please install manually: https://rustup.rs"
        return 1
    fi

    log "Rust installed successfully: $(cargo --version)"
}

verify_rust_version() {
    local version
    version=$(rustc --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')

    # Simple version comparison (works for semver with same major version)
    if [ "$(printf '%s\n' "$RUST_MIN_VERSION" "$version" | sort -V | head -n1)" = "$RUST_MIN_VERSION" ]; then
        log "Rust version $version meets minimum requirement ($RUST_MIN_VERSION)"
        return 0
    else
        log "WARNING: Rust version $version is below minimum $RUST_MIN_VERSION"
        return 1
    fi
}

add_cargo_to_path() {
    # Ensure cargo is in PATH for current session
    if [ -d "$HOME/.cargo/bin" ]; then
        export PATH="$HOME/.cargo/bin:$PATH"
    fi
    # Also source cargo env if available
    if [ -f "$CARGO_ENV" ]; then
        # shellcheck source=/dev/null
        source "$CARGO_ENV"
    fi
}

detect_shell_profile() {
    # Returns the path to the user's shell profile file
    local shell_name
    shell_name=$(basename "${SHELL:-/bin/bash}")

    case "$shell_name" in
        zsh)
            if [ -f "$HOME/.zshrc" ]; then
                echo "$HOME/.zshrc"
            else
                echo "$HOME/.zprofile"
            fi
            ;;
        bash)
            if [ -f "$HOME/.bashrc" ]; then
                echo "$HOME/.bashrc"
            elif [ -f "$HOME/.bash_profile" ]; then
                echo "$HOME/.bash_profile"
            else
                echo "$HOME/.profile"
            fi
            ;;
        *)
            echo "$HOME/.profile"
            ;;
    esac
}

check_profile_has_cargo() {
    local profile="$1"
    if [ -f "$profile" ] && grep -q "\.cargo/env" "$profile" 2>/dev/null; then
        return 0
    fi
    return 1
}

print_profile_instructions() {
    local profile
    profile=$(detect_shell_profile)

    if check_profile_has_cargo "$profile"; then
        log "Cargo env already in $profile"
    else
        log ""
        log "To make Rust available in new terminal sessions, add to $profile:"
        log "    source \"\$HOME/.cargo/env\""
        log ""
        log "Or run this command:"
        log "    echo 'source \"\$HOME/.cargo/env\"' >> $profile"
    fi
}

# Main setup function
setup_rust() {
    log "Setting up Rust environment..."

    # Add cargo to PATH first (may already be installed but not in PATH)
    add_cargo_to_path

    # Ensure Rust is installed
    if ! ensure_rust_installed; then
        return 1
    fi

    # Verify version
    verify_rust_version || true  # Warning only, don't fail

    # Check for rust-toolchain.toml and install specified toolchain
    local project_root="${1:-$(pwd)}"
    if [ -f "$project_root/src-tauri/rust-toolchain.toml" ]; then
        log "Found rust-toolchain.toml, ensuring correct toolchain..."
        (cd "$project_root/src-tauri" && rustup show)
    fi

    log "Rust setup complete"
    return 0
}

# Run setup if executed directly (not sourced)
if [ "$SOURCED" -eq 0 ]; then
    setup_rust "$@"

    # Print shell profile instructions for persistence
    if [ -f "$CARGO_ENV" ]; then
        print_profile_instructions
    fi

    log ""
    log "Verify installation with: rustc --version"
fi
