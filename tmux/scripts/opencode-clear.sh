#!/bin/sh
# Clears @opencode-state on a window when its opencode process is gone.
# Args (from the pane-focus-in hook): $1 = recorded pane, $2 = recorded opencode pid, $3 = focused pane.
# Two-tier check:
#   1. Recorded pid alive and matches opencode command — fast path.
#   2. Pane's child processes include opencode — covers missing/stale pid
#      (e.g. plugin v2 sessions that never wrote @opencode-pid, or write failure).
r="${1:-}"
[ -n "$r" ] || exit 0
pid="${2:-}"
# Tier 1: recorded pid is alive and is opencode
if [ -n "$pid" ] && ps -p "$pid" -o command= 2>/dev/null | grep -qE '(^|/)opencode( |$)'; then
  exit 0
fi
# Tier 2: check pane's direct children for an opencode process
pane_pid=$(tmux display -pt "$r" '#{pane_pid}' 2>/dev/null)
if [ -n "$pane_pid" ] && pgrep -lP "$pane_pid" 2>/dev/null | grep -qE '(^|/)opencode( |$)'; then
  exit 0
fi
# Not opencode — clear
t="${3:-$r}"
tmux set-option -uw -t "$t" @opencode-state 2>/dev/null
tmux set-option -uw -t "$t" @opencode-pane 2>/dev/null
tmux set-option -uw -t "$t" @opencode-pid 2>/dev/null
printf '%s %s cleared (stale)\n' "$(date -u +%FT%TZ)" "$r" >> /tmp/oc-tmux-status.log 2>/dev/null
