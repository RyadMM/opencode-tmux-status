// opencode-tmux-status plugin
// Maps opencode agent events to a tmux window option (@opencode-state) so the
// status bar can show what every window's agent is doing:
//   busy | wait (needs your input) | done | error
// Zero dependencies. No-ops outside tmux. Never throws into the event bus.
import fs from "node:fs"

const LOG = "/tmp/oc-tmux-status.log"
const LOG_MAX = 262144
const DEBUG = process.env.OPENCODE_TMUX_STATUS_DEBUG === "1"

export const TmuxStatusPlugin = async ({ $ }) => {
  const pane = process.env.TMUX_PANE
  const pid = String(process.pid)
  if (!pane || !process.env.TMUX) return {}

  let last = null
  let session = null

  const note = (line) => {
    try {
      if (fs.existsSync(LOG) && fs.statSync(LOG).size > LOG_MAX) fs.writeFileSync(LOG, "")
      fs.appendFileSync(LOG, `${new Date().toISOString().slice(11, 19)} ${pane} ${line}\n`)
    } catch {}
  }

  // Spawns tmux only on state CHANGES: streaming fires message.part.delta per
  // token and session.status busy per loop step, but the dedup cache means a
  // full turn costs ~2-6 tiny tmux invocations total.
  const setState = async (state, why) => {
    if (state === last) return
    note(`${state} <- ${why}`)
    try {
      const r = await $`tmux set-option -w -t ${pane} @opencode-state ${state} \; set-option -w -t ${pane} @opencode-pane ${pane} \; set-option -w -t ${pane} @opencode-pid ${pid}`.quiet()
      if (r.exitCode !== 0) throw new Error(`tmux rc=${r.exitCode}`)
      last = state // commit only after confirmed write
    } catch (e) {
      last = null  // reset so the next event retries
      note(`write FAILED: ${e}`)
    }
  }

  return {
    event: async ({ event }) => {
      const p = event.properties ?? {}
      // permission.asked / session.error from ANY session in the process
      // (including subagents) affect this window's turn — bypass the lock.
      if (event.type === "permission.asked") return setState("wait", "permission.asked")
      if (event.type === "permission.replied") return setState("busy", "permission.replied")
      if (event.type === "session.error") return setState("error", "session.error")
      // Arm on the first user message: hidden sessions (title generation,
      // summaries, subagents) also emit events in-process, so track only the
      // session the user is actually talking to.
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
