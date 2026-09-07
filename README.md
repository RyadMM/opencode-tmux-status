# opencode-tmux-status

<img width="460" height="30" alt="image" src="https://github.com/user-attachments/assets/c8285559-6576-4c03-b8b9-2a1d45fc0425" />


**[Français](README.fr.md)**

**One glance at your tmux status bar tells you what every [opencode](https://opencode.ai) agent is doing: working, blocked waiting for your input, or finished — no window-switching, no polling, no dependencies.**

## Prerequisites

- tmux ≥ 3.2
- [opencode](https://opencode.ai) ≥ 1.18
- A Nerd Font is *not* required — icons fall back automatically (see [Usage](#usage))

## Install

```sh
git clone https://github.com/RyadMM/opencode-tmux-status.git
cd opencode-tmux-status && ./install.sh
tmux source-file ~/.config/tmux/tmux.conf   # or ~/.tmux.conf
```

Restart your opencode sessions afterward — plugins load at startup.

The installer copies the plugin to `~/.config/opencode/plugins/`, the tmux files to `~/.config/tmux/`, and appends one `source-file` line to your `tmux.conf`. Nothing else is touched; removing it is a `git rm` and one deleted line.

## Usage

Start opencode in any window and send it a message. Its window gets a live icon in the status bar:

| State | Meaning | Unicode | ASCII |
|-------|---------|:-------:|:-----:|
| `busy` | Agent is working | ⚡ | `~` |
| `wait` | Agent needs your input | ⚑ | `?` |
| `done` | Turn finished | ✓ | `.` |
| `error` | Session error | ✗ | `!` |

With a Nerd Font installed, the unicode glyphs are upgraded to matching Nerd Font icons automatically.

The icon set is chosen at startup: Nerd Font glyphs if one is installed, plain unicode otherwise. Pin a set in your `tmux.conf` if detection guesses wrong:

```tmux
set -g @oc-icons "unicode"   # or "nerd" / "ascii"
```

Colors and glyphs live in `~/.config/tmux/opencode-status.tmux` — defaults are tuned for tmux's stock green bar.

### Notifications

State changes play a short macOS system beep (two for `wait`, three for `error`). Tune per window:

```sh
tmux set-option -w @oc-sound 0        # silence a window (default: on)
tmux set-option -w @oc-sound-done 1   # also beep once when a turn finishes (default: off)
```

### Environment variables

| Variable | Effect |
|----------|--------|
| `OPENCODE_TMUX_STATUS_NO_BELL=1` | Disable all beep notifications |
| `OPENCODE_TMUX_STATUS_DEBUG=1` | Verbose event logging to `/tmp/oc-tmux-status.log` |

### Diagnostics

```sh
~/.config/tmux/scripts/opencode-status-doctor.sh   # per-window states, liveness, log tail
```

## How it works

A three-step pipeline — opencode emits an event, the plugin writes a window option, tmux renders the icon.

**1. Events → states**

| opencode event | State | When |
|----------------|:-----:|------|
| `permission.asked` | `wait` | tool needs your approval |
| `question` tool *(running)* | `wait` | plan-mode / clarifying question |
| `session.status busy` | `busy` | agent is working |
| `session.status idle` | `done` | turn finished |
| `session.error` | `error` | something went wrong |

**2. Plugin → tmux.** On a state change the plugin writes `@opencode-state`, `@opencode-pane` and `@opencode-pid` as window options.

**3. tmux → status bar.** `window-status-format` renders those options as a colored icon next to each window name. Pure tmux formats — zero shell calls, instant redraw.

**Design notes**

- **State changes only.** One agent turn emits 180+ bus events; the plugin dedupes, costing ~4 `tmux set-option` calls per turn. Everything else is a string comparison.
- **PID-based staleness sweep.** A `pane-focus-in` hook clears a window's icon once its opencode process is gone — checking the PID rather than `pane_current_command`, which reads as the running bash tool mid-turn and would wipe live state.
- The plugin tracks only the session you're talking to; hidden sessions (title generation, summaries, subagents) never flicker the icons. `wait` also triggers on the blocking `question` tool, so "agent needs your input" is detected even though it's a tool call, not a permission.

## Troubleshooting

- **No icon** — the session predates the plugin (restart opencode), or no message sent yet.
- **Icon stuck** — focus that window; the sweep clears it if the agent is gone.
- **Wrong glyphs** — pin `@oc-icons` as above.
- **Nothing anywhere** — transitions are logged to `/tmp/oc-tmux-status.log`; run the doctor.

## Limitations

- Icons show for windows of the tmux session you're attached to (standard window-list behavior).
- Several opencode panes in one window: last-active wins.
- A pane moved to another window leaves a stale icon on the old one until you focus it.

## License

[MIT](LICENSE) © Ryad Meftahi
