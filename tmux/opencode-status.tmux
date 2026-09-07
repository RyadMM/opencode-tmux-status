# ==============================================================================
# OPENCODE AGENT STATE (status bar icons) — github.com/RyadMM/opencode-tmux-status
# ==============================================================================
# Requires the opencode plugin at ~/.config/opencode/plugin(s)/tmux-status.js
# It writes @opencode-state (busy | wait | done | error) to the window of the
# last-active opencode pane; these formats render it as a colored icon before
# each window name. No icon = no opencode activity in that window.
# Requires a Nerd Font for the default glyphs.

# --- customize here ------------------------------------------------------------
# Icon set: auto-detected at startup (Nerd Font if installed, unicode otherwise).
# Pin one manually if detection guesses wrong for your terminal:
#   set -g @oc-icons "nerd"     # 󰐋 󰁨 󰄬 󰅛  (Nerd Font)
#   set -g @oc-icons "unicode"  # ⚡ ⚑ ✓ ✗  (any modern terminal)
#   set -g @oc-icons "ascii"    # ~ ? . !  (maximum compatibility)
#   set -g @oc-icons "dot"      # ● ● ● ●  (minimal: colored circles)
set -g @oc-busy  "󰐋"        # agent working
set -g @oc-wait  "󰁨"        # needs your input
set -g @oc-done  "󰄬"        # turn finished
set -g @oc-error "󰅛"        # session error
# Colors; defaults contrast against tmux's green status bar.
set -g @oc-c-busy  "colour231"   # white
set -g @oc-c-wait  "colour201"   # bright magenta
set -g @oc-c-done  "colour16"    # black
set -g @oc-c-error "colour196"   # bright red

# --- rendering (no shell, no polling: pure format + instant redraw) -----------
set -g window-status-format "#{?#{==:#{@opencode-state},busy},#[fg=#{@oc-c-busy}]#{@oc-busy}#[fg=default] ,#{?#{==:#{@opencode-state},wait},#[fg=#{@oc-c-wait}]#{@oc-wait}#[fg=default] ,#{?#{==:#{@opencode-state},error},#[fg=#{@oc-c-error}]#{@oc-error}#[fg=default] ,#{?#{==:#{@opencode-state},done},#[fg=#{@oc-c-done}]#{@oc-done}#[fg=default] ,}}}}#I:#W"
set -g window-status-current-format "#{?#{==:#{@opencode-state},busy},#[fg=#{@oc-c-busy}]#{@oc-busy}#[fg=default] ,#{?#{==:#{@opencode-state},wait},#[fg=#{@oc-c-wait}]#{@oc-wait}#[fg=default] ,#{?#{==:#{@opencode-state},error},#[fg=#{@oc-c-error}]#{@oc-error}#[fg=default] ,#{?#{==:#{@opencode-state},done},#[fg=#{@oc-c-done}]#{@oc-done}#[fg=default] ,}}}}#I:#W#{?window_flags,#{window_flags}, }"

# --- stale-state sweep ---------------------------------------------------------
# When you focus a window whose recorded opencode process is gone (agent quit
# back to the shell, pane closed), clear its state. The script checks the
# recorded PID — NOT pane_current_command, which reads as the running bash tool
# while an agent works, and would falsely clear live state.
set -g @oc-clear-script "~/.config/tmux/scripts/opencode-clear.sh"
set-hook -gw pane-focus-in 'run -b "#{@oc-clear-script} #{@opencode-pane} #{@opencode-pid} #{hook_pane}"'

# Resolve icon set (auto-detect Nerd Font / fallback) and refine the @oc-* glyphs
run -b '~/.config/tmux/scripts/opencode-icons.sh'

# Fallback refresh; state changes also redraw the status line instantly
set -g status-interval 5
