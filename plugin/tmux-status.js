// opencode-tmux-status plugin
// Maps opencode agent events to a tmux window option (@opencode-state) so the
// status bar can show what every window's agent is doing:
//   busy | wait (needs your input) | done | error
// Zero dependencies. No-ops outside tmux. Never throws into the event bus.
import fs from "node:fs"
import { spawn } from "node:child_process"

const LOG = "/tmp/oc-tmux-status.log"
const LOG_MAX = 262144
const DEBUG = process.env.OPENCODE_TMUX_STATUS_DEBUG === "1"

export const TmuxStatusPlugin = async ({ $ }) => {
  const pane = process.env.TMUX_PANE
  const pid = String(process.pid)
  if (!pane || !process.env.TMUX) return {}

  let last = null
  let session = null
  let soundEnabled = null

  const note = (line) => {
    try {
      if (fs.existsSync(LOG) && fs.statSync(LOG).size > LOG_MAX) fs.writeFileSync(LOG, "")
      fs.appendFileSync(LOG, `${new Date().toISOString().slice(11, 19)} ${pane} ${line}\n`)
    } catch {}
  }

  const bell = async (state) => {
    if (process.env.OPENCODE_TMUX_STATUS_NO_BELL === "1") return
    if (process.platform !== "darwin") return
    if (soundEnabled === null) {
      try {
        const r = await $`tmux show-option -wv -t ${pane} @oc-sound`.quiet()
        soundEnabled = r.stdout.toString().trim() !== "0"
      } catch {
        soundEnabled = true
      }
    }
    if (!soundEnabled) return
    try {
      if (state === "wait") {
        spawn("osascript", ["-e", "beep 2"], { detached: true, stdio: "ignore" }).unref()
      } else if (state === "error") {
        spawn("osascript", ["-e", "beep 3"], { detached: true, stdio: "ignore" }).unref()
      } else if (state === "done") {
        spawn("osascript", ["-e", "beep 1"], { detached: true, stdio: "ignore" }).unref()
      }
    } catch {}
  }

  const setState = async (state, why) => {
    if (state === last) return
    note(`${state} <- ${why}`)
    try {
      const r = await $`tmux set-option -w -t ${pane} @opencode-state ${state} \; set-option -w -t ${pane} @opencode-pane ${pane} \; set-option -w -t ${pane} @opencode-pid ${pid}`.quiet()
      if (r.exitCode !== 0) throw new Error(`tmux rc=${r.exitCode}`)
      last = state
      bell(state)
    } catch (e) {
      last = null
      note(`write FAILED: ${e}`)
    }
  }

  return {
    event: async ({ event }) => {
      const p = event.properties ?? {}
      if (event.type === "permission.asked") return setState("wait", "permission.asked")
      if (event.type === "permission.replied") return setState("busy", "permission.replied")
      if (event.type === "session.error") return setState("error", "session.error")
      if (event.type === "message.updated" && p.info?.role === "user") {
        session = p.sessionID
        return
      }
      if (!session) return
      if (p.sessionID !== session) {
        if (DEBUG) note(`skip ${event.type} ${p.sessionID ?? "?"}`)
        return
      }
      if (DEBUG) note(`evt ${event.type}`)
      switch (event.type) {
        case "session.idle":
          return setState("done", "session.idle")
        case "session.status": {
          const t = p.status?.type
          if (t === "busy") return setState("busy", "status.busy")
          if (t === "waiting") return setState("wait", "status.waiting")
          if (t === "idle") return setState("done", "status.idle")
          break
        }
      }
    },
  }
}
