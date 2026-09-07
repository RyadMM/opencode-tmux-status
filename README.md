# opencode-tmux-status

Live [opencode](https://opencode.ai) agent state, in your tmux status bar.

Every window running opencode gets a colored icon next to its name, so a single glance tells you which agents are working, which finished, and which are blocked waiting for your answer — no window-switching required.

```
[1] 0:zsh  [󰐋] 1:api  [󰁨] 2:frontend  [󰄬] 3:docs
        │         │          │             │
       idle    working   NEEDS INPUT     done
```

## States

| Icon | State | Meaning |
|:----:|-------|---------|
| 󰐋 | `busy` | Agent is working |
| 󰁨 | `wait` | Agent is blocked on your input (permission prompt, question) |
| 󰄬 | `done` | Turn finished |
| 󰅛 | `error` | Session error |
| | | No icon — no opencode activity in that window |

Windows with several opencode panes show the state of the last-active one.

## Install

```sh
git clone https://github.com/RyadMM/opencode-tmux-status.git
cd opencode-tmux-status && ./install.sh
tmux source-file ~/.config/tmux/tmux.conf
```

Then restart your opencode sessions — plugins load at startup.

**Requirements:** tmux ≥ 3.2 · opencode ≥ 1.18 · [Nerd Font](https://www.nerdfonts.com)

The installer drops the plugin in `~/.config/opencode/plugins/`, the tmux files in `~/.config/tmux/`, and appends one `source-file` line to your `tmux.conf`. No other changes; `git rm`-grade uninstall.

## How it works

```
opencode plugin                tmux                          tmux status line
──────────────► set-option -w @opencode-state  ◄────────────  window-status-format
  permission.asked → wait      (+ @opencode-pane,              pure tmux formats,
  session.status   → busy       @opencode-pid)                 zero shell calls
  session.idle     → done
  session.error    → error
```

Three deliberate design choices:

- **State changes only.** A single turn emits 180+ bus events (per-token deltas, per-step status updates). The plugin dedupes, so that turn costs ~4 `tmux set-option` calls. Unmapped events cost one string comparison.
- **Window options + pure formats.** The status bar reads `@opencode-state` with built-in tmux format conditionals — no polling, no shell command per window, updates redraw instantly.
- **PID-based staleness sweep.** A `pane-focus-in` hook clears a window's icon when its opencode process is gone. It checks the recorded PID, not `pane_current_command` — during bash tool calls the pane's foreground process is the tool itself, and a command-based check would wipe live state mid-turn.

The plugin also locks onto the session that last received a user message, so hidden in-process sessions (title generation, summaries, subagents) never flicker your icons.

## Customize

Edit `~/.config/tmux/opencode-status.tmux`:

```tmux
set -g @oc-busy  "󰐋"            # any Nerd Font glyph
set -g @oc-c-busy  "colour231"  # any tmux color (name or colourNNN)
```

Defaults are tuned for tmux's stock green status bar.

## Troubleshooting

```sh
~/.config/tmux/scripts/opencode-status-doctor.sh
```

Prints every window's state, whether its opencode process is alive, and the last transitions.

- **No icon** — the session predates the plugin (restart opencode), or you haven't sent a message yet.
- **Icon stuck** — focus that window; the sweep clears it if the agent is gone.
- **Nothing anywhere** — check the plugin loaded: state transitions are logged to `/tmp/oc-tmux-status.log`.

## Limitations

- Icons appear only for windows of the tmux session you're attached to (standard window-list behavior).
- An opencode pane moved to another window leaves a stale icon on the old one until you focus it.
- Requires tmux with Nerd Font glyphs; plain-terminal users can swap in ASCII characters.

## License

[MIT](LICENSE) © Ryad Meftahi
