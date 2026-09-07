#!/bin/sh
# opencode-tmux-status installer
# Copies the plugin into opencode's config dir and the tmux bits into
# ~/.config/tmux/, then appends one source-file line to your tmux.conf.
set -e
REPO="$(cd "$(dirname "$0")" && pwd)"
OC_DIR="$HOME/.config/opencode"
PLUG_DIR="$OC_DIR/plugin"
[ -d "$PLUG_DIR" ] || PLUG_DIR="$OC_DIR/plugins"
TMUX_DIR="$HOME/.config/tmux"

mkdir -p "$PLUG_DIR" "$TMUX_DIR/scripts"
cp "$REPO/plugin/tmux-status.js" "$PLUG_DIR/tmux-status.js"
cp "$REPO/tmux/scripts/opencode-clear.sh" "$TMUX_DIR/scripts/opencode-clear.sh"
chmod +x "$TMUX_DIR/scripts/opencode-clear.sh"
cp "$REPO/tmux/scripts/opencode-status-doctor.sh" "$TMUX_DIR/scripts/opencode-status-doctor.sh"
chmod +x "$TMUX_DIR/scripts/opencode-status-doctor.sh"
cp "$REPO/tmux/opencode-status.tmux" "$TMUX_DIR/opencode-status.tmux"

CONF="$HOME/.config/tmux/tmux.conf"
[ -f "$CONF" ] || CONF="$HOME/.tmux.conf"
touch "$CONF"
LINE='source-file ~/.config/tmux/opencode-status.tmux'
if ! grep -qxF "$LINE" "$CONF"; then
  printf '\n# opencode-tmux-status agent state icons\n%s\n' "$LINE" >> "$CONF"
fi

echo "Installed:"
echo "  $PLUG_DIR/tmux-status.js"
echo "  $TMUX_DIR/opencode-status.tmux (+ scripts/)"
echo "  $CONF -> $LINE"
echo
echo "Next: restart tmux (or: tmux source-file \"$CONF\") and restart your"
echo "opencode sessions so the plugin loads. Requires a Nerd Font for icons."
