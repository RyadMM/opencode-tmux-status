#!/bin/sh
# Debug helper: shows every window's recorded opencode state, whether its
# opencode process is alive, and the last state transitions.
printf '%-10s %-7s %-7s %-7s %-4s %s\n' WINDOW STATE PANE PID ALIVE NAME
tmux list-windows -a -F '#{window_id}' | while IFS= read -r w; do
  s=$(tmux show-options -wv -t "$w" @opencode-state 2>/dev/null)
  [ -n "$s" ] || continue
  p=$(tmux show-options -wv -t "$w" @opencode-pane 2>/dev/null)
  pid=$(tmux show-options -wv -t "$w" @opencode-pid 2>/dev/null)
  name=$(tmux display -p -t "$w" '#W' 2>/dev/null)
  if [ -n "$pid" ] && ps -p "$pid" -o command= 2>/dev/null | grep -qE '(^|/)opencode( |$)'; then a=yes; else a=NO; fi
  printf '%-10s %-7s %-7s %-7s %-4s %s\n' "$w" "$s" "$p" "$pid" "$a" "$name"
done
echo
echo "--- last transitions (/tmp/oc-tmux-status.log) ---"
tail -10 /tmp/oc-tmux-status.log 2>/dev/null || echo "(no log yet — start an opencode session first)"
