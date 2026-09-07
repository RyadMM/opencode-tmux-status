#!/bin/sh
# Resolves the @oc-* icon + color options from the icon set in @oc-icons.
# Sets: "auto" (default) | "nerd" | "unicode" | "ascii" | "dot"
#
# auto is best-effort: it looks for Nerd fonts installed on the system
# (fc-list, then font directories), which usually — but not always — matches
# the font your terminal is actually using. Set @oc-icons explicitly to pin
# a set. Called asynchronously by opencode-status.tmux at startup/reload.
mode=$(tmux show-options -gv @oc-icons 2>/dev/null)
[ -n "$mode" ] || mode=auto

if [ "$mode" = auto ]; then
  if fc-list 2>/dev/null | grep -qiE 'nerd'; then
    mode=nerd
  elif ls /Library/Fonts "$HOME/Library/Fonts" /System/Library/Fonts \
       /usr/share/fonts "$HOME/.fonts" 2>/dev/null | grep -qiE 'nerd'; then
    mode=nerd
  else
    mode=unicode
  fi
  tmux set -g @oc-icons "$mode"
fi

# Colors per theme (tuned to stand out against tmux's stock green bar).
# The dot theme uses a single filled circle; the color IS the state.
case "$mode" in
  nerd)  b="󰐋"; w="󰁨"; d="󰄬"; e="󰅛"; cb="colour231"; cw="colour201"; cd="colour16";  ce="colour196" ;;
  dot)   b="●";  w="●";  d="●";  e="●";  cb="colour51";  cw="colour201"; cd="colour226"; ce="colour196" ;;
  ascii) b="~";  w="?";  d=".";  e="!";  cb="colour231"; cw="colour201"; cd="colour16";  ce="colour196" ;;
  *)     b="⚡"; w="⚑"; d="✓"; e="✗";  cb="colour231"; cw="colour201"; cd="colour16";  ce="colour196" ;;
esac

tmux set -g @oc-busy  "$b"
tmux set -g @oc-wait  "$w"
tmux set -g @oc-done  "$d"
tmux set -g @oc-error "$e"
tmux set -g @oc-c-busy  "$cb"
tmux set -g @oc-c-wait  "$cw"
tmux set -g @oc-c-done  "$cd"
tmux set -g @oc-c-error "$ce"