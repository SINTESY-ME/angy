#!/usr/bin/env bash
set -euo pipefail

# ── Usage ──────────────────────────────────────────────────────────────────────
# ./scripts/release.sh 0.2.6
# ./scripts/release.sh 0.2.6 --skip-build   # if you already built the binary
# ───────────────────────────────────────────────────────────────────────────────

VERSION="${1:-}"
SKIP_BUILD=false
[[ "${2:-}" == "--skip-build" ]] && SKIP_BUILD=true

if [[ -z "$VERSION" ]]; then
  echo "Usage: ./scripts/release.sh <version> [--skip-build]"
  echo "Example: ./scripts/release.sh 0.3.0"
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be semver (e.g. 0.3.0), got: $VERSION"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "── Updating version to $VERSION ──"

# package.json
sed -i '' "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"$VERSION\"/" package.json
echo "  updated package.json"

# src-tauri/tauri.conf.json
sed -i '' "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
echo "  updated src-tauri/tauri.conf.json"

# src-tauri/Cargo.toml (only the package version, line 3)
sed -i '' '3s/version = "[0-9]*\.[0-9]*\.[0-9]*"/version = "'"$VERSION"'"/' src-tauri/Cargo.toml
echo "  updated src-tauri/Cargo.toml"

# README.md
sed -i '' "s/version-v[0-9]*\.[0-9]*\.[0-9]*-blue/version-v${VERSION}-blue/" README.md
sed -i '' "s/\*\*v[0-9]*\.[0-9]*\.[0-9]*\*\*/**v${VERSION}**/" README.md
echo "  updated README.md"

# docs/index.html footer
sed -i '' "s/v[0-9]*\.[0-9]*\.[0-9]*/v${VERSION}/" docs/index.html
echo "  updated docs/index.html"

# ── Build ──────────────────────────────────────────────────────────────────────
DMG="src-tauri/target/release/bundle/dmg/angy_${VERSION}_aarch64.dmg"
ZIP="src-tauri/target/release/bundle/angy_${VERSION}_macos.zip"

if [[ "$SKIP_BUILD" == false ]]; then
  echo ""
  echo "── Building release binary ──"
  npm run tauri build
else
  echo ""
  echo "── Skipping build (--skip-build) ──"
fi

if [[ ! -f "$DMG" ]]; then
  echo "Error: DMG not found at $DMG"
  echo "Build the binary first, or check the version matches."
  exit 1
fi

# ── Zip .app ───────────────────────────────────────────────────────────────────
echo ""
echo "── Zipping .app bundle ──"
(cd src-tauri/target/release/bundle/macos && zip -r "$ROOT/$ZIP" angy.app)
echo "  created $ZIP"

# ── GitHub Release ─────────────────────────────────────────────────────────────
echo ""
echo "── Creating GitHub Release v${VERSION} ──"
gh release create "v${VERSION}" \
  "$DMG" \
  "$ZIP" \
  --title "Angy v${VERSION}" \
  --notes "macOS ARM (Apple Silicon) only. After downloading, run:
\`\`\`
xattr -cr ~/Downloads/angy_${VERSION}_aarch64.dmg
\`\`\`"

echo ""
echo "── Done! ──"
echo "Release: https://github.com/alice-viola/angy/releases/tag/v${VERSION}"
