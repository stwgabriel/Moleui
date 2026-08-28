# Exposing the Mole engine to AI agents

Research and design for making Mole's engine callable by AI agents when the user
has only the installed desktop app. Written 2026-08-27.

## What already exists

Three layers, from bottom to top:

1. **The engine.** `lib/` (8 directories) and `bin/*.sh`, plus the Go binaries
   `analyze-go`, `status-go`, `repos-go`. All of it is bundled into
   `Moleui.app/Contents/Resources/mole-runtime/` by
   `apps/desktop/scripts/prepare-runtime.mjs`.
2. **The desktop IPC surface.** 79 `ipcMain.handle` channels in `main.mjs`,
   including a partial unified `mole:operations:plan|execute|status|cancel`.
   Reachable only from the app's own renderer.
3. **Machine-readable output that already ships.** `analyze --json`,
   `status --json`, `repos --json`, `repos --gate`, `uninstall --list`,
   `optimize --plan-json`, and `--dry-run` on the destructive flows.

Point 3 matters more than it looks. A large part of what an agent would want is
already structured JSON behind a stable flag. The work is not inventing an API,
it is packaging one and deciding what an agent is allowed to call.

## Protocol: MCP

MCP is the answer. Current spec is **2026-07-28**, which changed things worth
knowing:

- **The protocol core is now stateless.** No `initialize`/`initialized`
  handshake, no `Mcp-Session-Id`. Each request carries its protocol version,
  client identity and capabilities in `_meta`.
- **Server state is passed explicitly.** The spec's own guidance: "if your server
  needs to carry state across calls, mint an explicit handle from a tool and have
  the model pass it back as an argument." That is exactly the shape a
  plan-then-apply flow needs, so the safety design below follows the spec rather
  than working around it.
- **Two transports.** stdio for local integrations, Streamable HTTP for remote.
  The legacy HTTP+SSE transport is deprecated with a year-long offramp.
- **`server/discover` exists but is optional**, and it only tells a client what a
  server can do *after* it has connected. It does not help a client find the
  server.

**Use stdio.** An agent spawns a process and speaks over its pipes. That works
with the app closed, needs no port, no localhost listener, and no authentication
story. Putting the server inside the Electron main process over HTTP would tie
every agent call to the GUI being open and would open a local port.

## Discovery: there is no automatic mechanism

Checked directly against the Claude Code docs, which state it plainly: "No
automatic discovery. MCP servers must always be explicitly registered in a
configuration file."

`.well-known/mcp` server discovery is **only a proposal** (SEP issues #1960 and
#1649, discussion #1147). It is also domain-oriented, so it would not help a
local app even if it shipped.

That leaves four real options.

| Mechanism | Covers | Cost |
| --- | --- | --- |
| Write into `~/.claude.json` / `claude_desktop_config.json` | registration only | editing another tool's config file behind the user's back |
| `claude mcp add --transport stdio ...` | registration only | one visible command, user-initiated |
| **Claude Code plugin** | registration **and** instructions | a directory in the app bundle |
| **MCP Bundle (`.mcpb`)** | registration in Claude Desktop | a zip, one-click install |

### Why the plugin is the right primary answer

A Claude Code plugin is a directory that can carry both halves of what we need:

```
mole-ai/
├── .claude-plugin/
│   └── plugin.json        # identity and version
├── .mcp.json              # points at the bundled mole-mcp binary
└── skills/
    └── mole/
        └── SKILL.md       # tells the agent what Mole does and when to use it
```

`.mcp.json` at the plugin root registers the server. `skills/mole/SKILL.md`
answers the second half of the request: it is the file that tells an agent the
capability exists, with a `description` the model matches against task context.
One artifact, both asks.

It can be loaded from a local directory, which an app bundle is:

- `claude --plugin-dir /Applications/Moleui.app/Contents/Resources/mole-ai`
  loads it for one session. Good for us to test with.
- A directory containing `.claude-plugin/marketplace.json` can be registered as a
  marketplace, then installed at user, project or local scope.
- `~/.claude/skills/<name>/` containing `.claude-plugin/plugin.json` **auto-loads
  on the next session** with no marketplace and no install step. This is the
  closest thing to auto-discovery that exists.

`.mcpb` is the equivalent for Claude Desktop: a zip holding the server and a
`manifest.json`, one-click install, and compiled binaries are supported as entry
points. Worth shipping as a second artifact, not as the primary.

### The app must not silently edit agent config

Registration is a change to another tool's configuration on the user's machine.
It gets an explicit control in Settings, an explanation of exactly which file
changed, and a way to undo it. Not an install-time side effect.

## Safety: the part that decides the shape

An MCP server is a new entry point into `mole_delete`, `remove_file_list` and
`find_app_files`. CLAUDE.md flags those as the highest-risk code in the repo and
cites PR #874 and #875, both merged and then reverted for widening what a
matcher reached. The same bar applies to what we build, and an agent driving it
is a weaker safeguard than a human clicking a button.

Three rules.

**Read-only and mutating tools are separate populations.** The read-only set is
already JSON, already non-destructive, and is most of the value to an agent:
disk analysis, system status, installed-app inventory, repo inventory, optimize
plans, purge discovery. Shipping only that set adds close to no new risk.

**Mutating tools split into plan and apply, joined by a server-minted handle.**
`mole_clean_plan` returns the plan plus an opaque token. `mole_clean_apply`
accepts that token and nothing else. The model cannot name a target directly, so
it cannot invent one, and the plan the user saw is the plan that runs. This is
the spec's own recommendation for state.

**No tool takes a path and deletes it.** Earlier in this same work we found
`mole:delete-path` guarding only `/` and `$HOME` while a root scan had made
`/private/var/log` reachable. A path-taking delete tool is that hole with an
agent holding the keys. If deletion is exposed at all, its only argument is a
handle from a prior plan.

Reuse the repo's existing gates rather than inventing new ones: `MOLE_DRY_RUN=1`
and `MOLE_TEST_NO_AUTH=1` already mean what we need, and `should_protect_path`
already exists.

## Where the server lives

`cmd/mcp/` in Go, next to `cmd/analyze`. It inherits `validatePath`, the existing
JSON structs, and the safety helpers instead of re-deriving them in Node. It is
built by `prepare-runtime.mjs` alongside the other binaries and lands at
`Moleui.app/Contents/Resources/mole-runtime/bin/mole-mcp`.

The server shells into the same bundled runtime the app uses. That means one
engine, one set of safety checks, and one bats suite covering both callers.

## Consequence for removing the CLI

The approved plan was to retire the CLI as a product and keep `lib/` and
`bin/*.sh` as the app's **private** runtime. An MCP server changes that: the
engine becomes a **published** interface with a stability contract, just a
machine-facing one instead of a human-facing one. The story stays coherent, the
`mo` command and its installer still go, but the engine's JSON output and exit
codes are now something we cannot casually change.

The 49 bats files stay either way. They are the only coverage of the deletion
sinks that both callers reach.

## Proposed order

**Slice 1, read-only access.** `cmd/mcp/` with the non-destructive tools, the
plugin directory in the app bundle, the SKILL.md, and a Settings control that
registers it. Contained, and useful on its own.

**Slice 2, mutating access.** Plan/apply handles, the token store, per-tool
confirmation policy, and a `.mcpb` bundle for Claude Desktop. Larger, and needs
a security review against the CLAUDE.md checklist before it ships.

## Sources

- [MCP 2026-07-28 specification announcement](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
- [MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [Claude Code MCP configuration](https://code.claude.com/docs/en/mcp)
- [Claude Code plugins](https://code.claude.com/docs/en/plugins)
- [Claude Code plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [MCP Bundle format](https://github.com/modelcontextprotocol/mcpb/blob/main/README.md)
- [Adopting the MCP Bundle format](https://blog.modelcontextprotocol.io/posts/2025-11-20-adopting-mcpb/)
- [Claude Desktop Extensions](https://www.anthropic.com/engineering/desktop-extensions)
- [SEP: .well-known/mcp discovery endpoint (proposal)](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1960)
- [SEP-1649: MCP Server Cards (proposal)](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649)
