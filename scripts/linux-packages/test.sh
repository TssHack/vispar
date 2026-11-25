#!/usr/bin/env bash
# Tests the built Linux packages on clean distributions, on your own machine, with Docker or Podman:
#   .pacman on Arch, .rpm on Fedora, .deb on Debian and Ubuntu, each in a fresh container.
# Each package must install with its package manager (which pulls its dependencies), have no
# missing library, put its menu entry and all icon sizes in place, and open its window.
# The AppImage is checked for its icons and menu entry.
#
# Usage:
#   npm run test:linux-packages                      all distributions, files from release/
#   npm run test:linux-packages -- arch fedora       only some
#   RELEASE_DIR=path/to/files npm run test:linux-packages
#   CONTAINER_ENGINE=podman npm run test:linux-packages
#
# Build the packages first (needs rpm-tools/rpmbuild for the .rpm and bsdtar for the .pacman):
#   npm run build:web && (cd desktop && npm ci && npx electron-builder --linux AppImage deb rpm pacman)
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/scripts/linux-packages"
RELEASE_DIR="$(cd "${RELEASE_DIR:-$ROOT/release}" 2>/dev/null && pwd)" || { echo "No release folder. Build the packages first (see the top of this file)."; exit 2; }
ENGINE="${CONTAINER_ENGINE:-$(command -v podman >/dev/null && echo podman || echo docker)}"
command -v "$ENGINE" >/dev/null || { echo "Neither podman nor docker is installed."; exit 2; }

declare -A IMAGE=([arch]=archlinux:latest [fedora]=fedora:latest [debian]=debian:stable [ubuntu]=ubuntu:24.04)
declare -A EXT=([arch]=pacman [fedora]=rpm [debian]=deb [ubuntu]=deb)
DISTROS=("$@")
[ ${#DISTROS[@]} -eq 0 ] && DISTROS=(arch fedora debian ubuntu appimage)
# Check every name before anything runs, so a typo does not stop the run halfway.
for d in "${DISTROS[@]}"; do
  [ "$d" = appimage ] || [ -n "${IMAGE[$d]:-}" ] || { echo "Unknown distribution: $d (arch, fedora, debian, ubuntu, appimage)"; exit 2; }
done

check_appimage() {  # file, scratch dir
  local root="$2/squashfs-root" n
  (cd "$2" && chmod +x "$1" && "$1" --appimage-extract >/dev/null) || { echo "  cannot extract"; return 1; }
  for n in 16 24 32 48 64 128 256 512; do
    [ -f "$root/usr/share/icons/hicolor/${n}x${n}/apps/vispar-desktop.png" ] || { echo "  missing ${n}px icon"; return 1; }
  done
  grep -qx 'Icon=vispar-desktop' "$root/vispar-desktop.desktop" || { echo "  Icon= is not vispar-desktop"; return 1; }
  grep -qx 'StartupWMClass=vispar-desktop' "$root/vispar-desktop.desktop" || { echo "  StartupWMClass= is not vispar-desktop"; return 1; }
  [ -s "$root/.DirIcon" ] || { echo "  no .DirIcon"; return 1; }
  echo "  all 8 icon sizes, Icon= and StartupWMClass= are vispar-desktop"
}

newest() { ls -t "$RELEASE_DIR"/*."$1" 2>/dev/null | head -1; }
LOGS="$(mktemp -d)"
declare -A RESULT

for d in "${DISTROS[@]}"; do
  if [ "$d" = appimage ]; then
    file="$(newest AppImage)"
    [ -n "$file" ] || { RESULT[$d]="SKIP (no .AppImage)"; continue; }
    echo "### appimage: $(basename "$file")"
    tmp="$(mktemp -d)"
    if check_appimage "$file" "$tmp"; then RESULT[$d]="PASS (icons and menu entry)"; else RESULT[$d]="FAIL"; fi
    chmod -R u+w "$tmp" 2>/dev/null; rm -rf "$tmp"
    continue
  fi
  file="$(newest "${EXT[$d]}")"
  [ -n "$file" ] || { RESULT[$d]="SKIP (no .${EXT[$d]})"; continue; }
  echo "### $d (${IMAGE[$d]}): $(basename "$file")"
  # :Z relabels the mounts for SELinux hosts (Fedora); other hosts ignore it.
  if "$ENGINE" run --rm --pull=always \
    -v "$RELEASE_DIR:/pkgs:ro,Z" -v "$HERE/in-container.sh:/in-container.sh:ro,Z" \
    "${IMAGE[$d]}" bash /in-container.sh "$d" "/pkgs/$(basename "$file")" >"$LOGS/$d.log" 2>&1; then
    RESULT[$d]="PASS"
  else
    RESULT[$d]="FAIL"
  fi
  grep -E '^(== |FAIL|binary:|all 8|no missing|window )' "$LOGS/$d.log" | sed 's/^/  /'
done

echo
echo "Result"
failed=0
ran=0
for d in "${DISTROS[@]}"; do
  printf '  %-9s %s\n' "$d" "${RESULT[$d]}"
  case "${RESULT[$d]}" in
    PASS*) ran=1 ;;
    FAIL*) ran=1; failed=1; [ -f "$LOGS/$d.log" ] && echo "            full log: $LOGS/$d.log" ;;
  esac
done
# Nothing tested is not a pass: usually the packages were not built, or RELEASE_DIR is wrong.
if [ $ran -eq 0 ]; then echo; echo "Nothing was tested: no packages in $RELEASE_DIR"; exit 2; fi
exit $failed
