#!/bin/sh
# Clears @opencode-state on a window when its opencode process is gone.
# Args (from the pane-focus-in hook): $1 = recorded pane, $2 = recorded opencode pid, $3 = focused pane.
# Checks the PID, NOT pane_current_command: while an agent runs bash tools the
# pane's foreground process is the tool command, so command-based checks would
# wrongly clear live state.
r="${1:-}"
[ -n "$r" ] || exit 0
pid="${2:-}"
if [ -n "$pid" ] && ps -p "$pid" -o command= 2>/dev/null | grep -qE '(^|/)opencode( |$)'; then
  exit 0
fi
t="${3:-$r}"
tmux set-option -uw -t "$t" @opencode-state 2>/dev/null
tmux set-option -uw -t "$t" @opencode-pane 2>/dev/null
tmux set-option -uw -t "$t" @opencode-pid 2>/dev/null
printf '%s %s cleared (stale)\n' "$(date -u +%FT%TZ)" "$r" >> /tmp/oc-tmux-status.log 2>/dev/null
