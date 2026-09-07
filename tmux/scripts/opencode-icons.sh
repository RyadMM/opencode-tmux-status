#!/bin/sh
# Resolves the @oc-* icon options from the icon set in @oc-icons.
# Sets: "auto" (default) | "nerd" | "unicode" | "ascii"
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

case "$mode" in
  nerd)    b="󰐋"; w="󰁨"; d="󰄬"; e="󰅛" ;;
  ascii)   b="~";  w="?";  d=".";  e="!"  ;;
  *)       b="⚡"; w="⚑";  d="✓";  e="✗"  ;;
esac

tmux set -g @oc-busy  "$b"
tmux set -g @oc-wait  "$w"
tmux set -g @oc-done  "$d"
tmux set -g @oc-error "$e"
