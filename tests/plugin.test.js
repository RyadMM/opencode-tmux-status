import { describe, it, beforeEach, mock } from "node:test"
import assert from "node:assert/strict"

process.env.OPENCODE_TMUX_STATUS_NO_BELL = "1"
process.env.TMUX = "1"
process.env.TMUX_PANE = "%42"

const { TmuxStatusPlugin } = await import("../plugin/tmux-status.js")

function mock$() {
  const calls = []
  return {
    calls,
    fn: (strings, ...values) => {
      calls.push({ strings: [...strings], values })
      // Mimic Bun's $.quiet() — returns thenable with exitCode
      const result = { exitCode: 0, stdout: Buffer.from(""), stderr: Buffer.from("") }
      return { quiet: async () => result }
    },
  }
}

function failing$() {
  const calls = []
  let n = 0
  return {
    calls,
    fn: (strings, ...values) => {
      n++
      calls.push({ strings: [...strings], values })
      const result = n === 1
        ? { exitCode: 1, stdout: Buffer.from(""), stderr: Buffer.from("fail") }
        : { exitCode: 0, stdout: Buffer.from(""), stderr: Buffer.from("") }
      return { quiet: async () => result }
    },
  }
}

function ev(type, props = {}) {
  return { event: { type, properties: props } }
}

function getState(call) {
  // In $`... @opencode-state ${state} ...`, state is values[1]
  return call.values[1]
}

describe("TmuxStatusPlugin", () => {
  describe("tmux gate", () => {
    it("returns empty object outside tmux", async () => {
      const origTmux = process.env.TMUX
      const origPane = process.env.TMUX_PANE
      delete process.env.TMUX
      delete process.env.TMUX_PANE
      const plugin = await TmuxStatusPlugin({ $: mock$().fn })
      assert.deepEqual(plugin, {})
      process.env.TMUX = origTmux
      process.env.TMUX_PANE = origPane
    })

    it("returns event handler inside tmux", async () => {
      const plugin = await TmuxStatusPlugin({ $: mock$().fn })
      assert.equal(typeof plugin.event, "function")
    })
  })

  describe("arming", () => {
    it("drops session events before first user message", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("session.status", { status: { type: "busy" } }))
      await p.event(ev("session.idle"))
      assert.equal(m$.calls.length, 0)
    })

    it("records sessionID on first user message without writing", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      assert.equal(m$.calls.length, 0)
    })
  })

  describe("session filter", () => {
    it("passes events from armed session", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(ev("session.status", { status: { type: "busy" }, sessionID: "s1" }))
      assert.equal(m$.calls.length, 1)
    })

    it("drops events from wrong session", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(ev("session.status", { status: { type: "busy" }, sessionID: "s2" }))
      assert.equal(m$.calls.length, 0)
    })
  })

  describe("permission bypass", () => {
    it("permission.asked writes wait without arming", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("permission.asked"))
      assert.equal(m$.calls.length, 1)
      assert.equal(getState(m$.calls[0]), "wait")
    })

    it("permission.replied writes busy", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("permission.asked"))
      await p.event(ev("permission.replied"))
      assert.equal(m$.calls.length, 2)
      assert.equal(getState(m$.calls[0]), "wait")
      assert.equal(getState(m$.calls[1]), "busy")
    })

    it("permission.asked ignores session filter", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(ev("permission.asked", { sessionID: "s2" }))
      assert.equal(m$.calls.length, 1)
      assert.equal(getState(m$.calls[0]), "wait")
    })

    it("session.error bypasses session filter", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(ev("session.error", { sessionID: "s2" }))
      assert.equal(getState(m$.calls[0]), "error")
    })
  })

  describe("state machine", () => {
    it("busy → done via session.idle", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(ev("session.status", { status: { type: "busy" }, sessionID: "s1" }))
      await p.event(ev("session.idle", { sessionID: "s1" }))
      assert.equal(m$.calls.length, 2)
      assert.equal(getState(m$.calls[0]), "busy")
      assert.equal(getState(m$.calls[1]), "done")
    })

    it("busy → wait → busy (permission cycle)", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(ev("session.status", { status: { type: "busy" }, sessionID: "s1" }))
      await p.event(ev("permission.asked"))
      await p.event(ev("permission.replied"))
      assert.equal(m$.calls.length, 3, "busy → wait → busy = 3 writes")
      assert.equal(getState(m$.calls[0]), "busy")
      assert.equal(getState(m$.calls[1]), "wait")
      assert.equal(getState(m$.calls[2]), "busy")
    })

    it("session.error → error", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("session.error"))
      assert.equal(getState(m$.calls[0]), "error")
    })

    it("status.waiting → wait", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(ev("session.status", { status: { type: "waiting" }, sessionID: "s1" }))
      assert.equal(getState(m$.calls[0]), "wait")
    })

    it("status.idle → done", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(ev("session.status", { status: { type: "idle" }, sessionID: "s1" }))
      assert.equal(getState(m$.calls[0]), "done")
    })
  })

  describe("question tool", () => {
    function qPart(status, extra = {}) {
      return ev("message.part.updated", { part: { type: "tool", tool: "question", state: { status }, ...extra } })
    }

    it("running → wait (needs input)", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(qPart("running"))
      assert.equal(getState(m$.calls[0]), "wait")
    })

    it("completed → busy (answered, agent resumes)", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(qPart("running"))
      await p.event(qPart("completed"))
      assert.equal(m$.calls.length, 2, "wait then busy")
      assert.equal(getState(m$.calls[0]), "wait")
      assert.equal(getState(m$.calls[1]), "busy")
    })

    it("bypasses session filter (subagent questions)", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(qPart("running", { sessionID: "s2" }))
      assert.equal(getState(m$.calls[0]), "wait")
    })

    it("ignores non-question tool parts", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(ev("message.part.updated", { part: { type: "tool", tool: "bash", state: { status: "running" } }, sessionID: "s1" }))
      assert.equal(m$.calls.length, 0, "bash tool running is not a wait state")
    })
  })

  describe("deduplication", () => {
    it("suppresses repeated same-state", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(ev("session.status", { status: { type: "busy" }, sessionID: "s1" }))
      assert.equal(m$.calls.length, 1)
      await p.event(ev("session.status", { status: { type: "busy" }, sessionID: "s1" }))
      assert.equal(m$.calls.length, 1, "should not write again")
    })

    it("emits on state change", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(ev("session.status", { status: { type: "busy" }, sessionID: "s1" }))
      await p.event(ev("session.idle", { sessionID: "s1" }))
      assert.equal(m$.calls.length, 2)
    })
  })

  describe("write failure resilience", () => {
    it("resets last so next same-state retries", async () => {
      const m$ = failing$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))

      await p.event(ev("session.status", { status: { type: "busy" }, sessionID: "s1" }))
      assert.equal(m$.calls.length, 1)

      // Same state fires again — should retry because last was reset to null
      await p.event(ev("session.status", { status: { type: "busy" }, sessionID: "s1" }))
      assert.equal(m$.calls.length, 2)
    })
  })

  describe("tmux command shape", () => {
    it("sets all three options atomically", async () => {
      const m$ = mock$()
      const p = await TmuxStatusPlugin({ $: m$.fn })
      await p.event(ev("message.updated", { info: { role: "user" }, sessionID: "s1" }))
      await p.event(ev("session.status", { status: { type: "busy" }, sessionID: "s1" }))

      const c = m$.calls[0]
      const cmd = c.strings.join("")
      assert.ok(cmd.includes("@opencode-state"), "should set @opencode-state")
      assert.ok(cmd.includes("@opencode-pane"), "should set @opencode-pane")
      assert.ok(cmd.includes("@opencode-pid"), "should set @opencode-pid")
      assert.ok(c.values.includes("%42"), "should use correct pane ID")
    })
  })
})
