#!/usr/bin/env bash
# Installs one Linux package of the desktop app on a clean distribution and checks that it works:
# the package manager accepts it and pulls its dependencies, no shared library is missing, the menu
# entry and icons are in place, and the app starts and opens its window.
#
# Runs inside a clean container; started by scripts/linux-packages/test.sh.
# Usage (as root):  in-container.sh <arch|fedora|debian|ubuntu> <file>
set -euo pipefail

DISTRO="$1"
FILE="$(readlink -f "$2")"
APP_ID="vispar-desktop"
LOG=/tmp/vispar-run.log
fail() { echo "FAIL: $*"; exit 1; }
step() { echo; echo "== $*"; }
end() { :; }

step "Install $(basename "$FILE") on $DISTRO"
case "$DISTRO" in
  arch)
    pacman -Syu --noconfirm --needed >/dev/null
    pacman -U --noconfirm "$FILE"
    ;;
  fedora)
    dnf install -y "$FILE"
    ;;
  debian | ubuntu)
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y "$FILE"
    ;;
  *) fail "unknown distro: $DISTRO" ;;
esac
end

DESKTOP="/usr/share/applications/${APP_ID}.desktop"
step "Menu entry and icons"
[ -f "$DESKTOP" ] || fail "missing $DESKTOP"
cat "$DESKTOP"
grep -qx "Icon=${APP_ID}" "$DESKTOP" || fail "Icon= is not ${APP_ID}"
grep -qx "StartupWMClass=${APP_ID}" "$DESKTOP" || fail "StartupWMClass= is not ${APP_ID}"
for n in 16 24 32 48 64 128 256 512; do
  icon="/usr/share/icons/hicolor/${n}x${n}/apps/${APP_ID}.png"
  [ -f "$icon" ] || fail "missing icon $icon"
done
echo "all 8 icon sizes present"
BIN="$(sed -n 's/^Exec="\{0,1\}\([^" ]*\)"\{0,1\}.*/\1/p' "$DESKTOP" | head -1)"
[ -x "$BIN" ] || fail "Exec target is not executable: $BIN"
echo "binary: $BIN"
end

# Before anything else is installed, so the test tools cannot hide a missing dependency.
step "Shared libraries (only what the package pulled in)"
missing="$(find "$(dirname "$BIN")" -maxdepth 1 \( -name '*.so*' -o -path "$BIN" \) -type f -exec ldd {} + 2>/dev/null | grep 'not found' | sort -u || true)"
[ -z "$missing" ] || fail "missing libraries: $missing"
echo "no missing libraries"
end

step "Install the test tools (a virtual display and xwininfo)"
case "$DISTRO" in
  arch) pacman -S --noconfirm --needed xorg-server-xvfb xorg-xwininfo >/dev/null ;;
  fedora) dnf install -y -q xorg-x11-server-Xvfb xwininfo >/dev/null ;;
  debian | ubuntu) apt-get install -y -qq xvfb x11-utils >/dev/null ;;
esac
end

step "Start the app and wait for its window"
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp 2>/dev/null &
XVFB=$!
export DISPLAY=:99
sleep 2
# Root in a container: Chromium's sandbox needs --no-sandbox there (it is used normally on a desktop).
"$BIN" --no-sandbox --disable-gpu >"$LOG" 2>&1 &
APP=$!
ok=""
for _ in $(seq 1 45); do
  kill -0 "$APP" 2>/dev/null || break
  # The window is created hidden and shown on ready-to-show, so a viewable one means the page loaded.
  for id in $(xwininfo -root -tree | awk "/\"${APP_ID}\" \"${APP_ID}\"/ {print \$1}"); do
    if xwininfo -id "$id" | grep -q 'Map State: IsViewable'; then ok="$id"; break 2; fi
  done
  sleep 1
done
xwininfo -root -tree | grep -i "$APP_ID" || true
kill "$APP" 2>/dev/null || true
kill "$XVFB" 2>/dev/null || true
end
if [ -z "$ok" ]; then
  echo "--- app output"; cat "$LOG"
  fail "the app did not open its window (WM_CLASS ${APP_ID})"
fi
if grep -E "error while loading shared libraries|cannot open shared object" "$LOG"; then
  fail "the app reported a missing library"
fi
echo "window $ok is viewable, WM_CLASS ${APP_ID}: OK"
