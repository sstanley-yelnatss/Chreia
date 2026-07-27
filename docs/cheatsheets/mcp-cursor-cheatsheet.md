# ContextLayer — Cursor MCP cheat sheet

Same database as the desktop app: `%USERPROFILE%\.contextlayer\graph.db`

**Rules:** Text stored verbatim. Only write when you ask. **Tier 1:** `get_workspace_index` before full reads.

**Cursor skill:** `.cursor/skills/contextlayer/SKILL.md` in repo — enable in Cursor for logging conventions.

**Commands (CLI + capture gate):** [COMMANDS-CHEATSHEET.md](./COMMANDS-CHEATSHEET.md)

---

## Setup (build MCP + configure client)

Full steps: **[MCP-SETUP.md](./MCP-SETUP.md)** (Cursor, Claude Desktop, other stdio clients).

Quick build:

```powershell
cd path\to\ContextLayer
cargo build -p contextlayer-mcp --release
```

Copy `.cursor/mcp.json.example` → `.cursor/mcp.json` and set an absolute path to `target\release\contextlayer-mcp.exe` (or a copied binary). Refresh MCP in Cursor.

Desktop app (separate terminal):

```powershell
cd path\to\ContextLayer\apps\desktop
npm run tauri dev
```

Use the **Tauri window**, not the browser tab.

---

## Tools (27) — tiered reads

### Read first (tier 0–1)

| Tool | When to use |
|------|-------------|
| `list_workspaces` | Get workspace IDs/names |
| **`get_workspace_index`** | **Tier 1** — titles, belief, hygiene flags; **no body text** |
| `get_workspace_hygiene` | Orphans, stale, dead ends, still-open, decisions |
| `get_block` | **Tier 2** — one full block |
| `list_blocks` | Lightweight id + title list |

### Export / import

| Tool | When to use |
|------|-------------|
| `compile_agent_context` | Full agent packet (bodies + IDs); omit block ids for whole workspace |
| `export_blocks` | PR markdown for selected blocks |
| `import_session` | Paste transcript → new workspace (draft blocks) |
| `get_workspace_summary` | Full dump — high token cost; rare use |

### Capture (opt-in session log)

See [COMMANDS-CHEATSHEET.md](./COMMANDS-CHEATSHEET.md) for full recorder CLI.

| Tool | When to use |
|------|-------------|
| `bind_capture_project` | Map Cursor project → workspace (**no recording**) |
| **`start_capture`** | Begin live capture — `workspace` = name or UUID |
| **`stop_capture`** | End live capture |
| **`capture_status`** | Active sessions |
| `get_context_log` | Session log window |
| `get_context_commits` | Decision commits |
| `commit_checkpoint` | Decision moment — slices log (not every prompt) |
| `import_session` | Paste transcript → new workspace + log |
| `append_trace_event` | Optional session note |
| `list_checkpoints` / `get_trace_summary` | Review checkpoints |

Trace CI on PRs: `.contextlayer/rules.yml` + `cargo run -p contextlayer-trace-cli -- check`.

### Write (prefer blocks)

| Tool | When to use |
|------|-------------|
| **`save_block`** | **Primary.** One row with title + any of: hypothesis, action, evidence, conclusion + belief state + tags + block links |
| `create_workspace` | New bounty / CTF / research workspace |

### Node links (legacy rows only)

Prefer block links via `save_block` → `link_to_block_ids`. These remain for older node-graph rows:

| Tool | When to use |
|------|-------------|
| `add_link` | Link nodes: hypothesis→action, action→evidence, conclusion→hypothesis/evidence |
| `list_links` / `remove_link` | Inspect or delete node links |

Standalone `create_hypothesis` / `create_action` / `create_evidence` / `save_conclusion` were removed from MCP — use **`save_block`**.

---

## `save_block` — partial updates (important)

When **updating** a block (`block_id` or `block_title` set), **only send fields you want to change**. Omitted fields are **preserved** — hypothesis/action/evidence/conclusion are not wiped.

To target by name: call `list_blocks`, then use `block_title: "IDOR test"` (case-insensitive, must be unique in workspace).

To clear a field explicitly, send an empty string for that field.

---

## `save_block` fields

| Field | Example |
|-------|---------|
| `workspace_id` | UUID from `list_workspaces` (or use workspace **name** on capture start/stop) |
| `block_id` | UUID when editing (or use `block_title`) |
| `block_title` | `"IDOR test"` — resolves block within workspace |
| `title` | Short name (unique per workspace). Required on create; optional on update |
| `hypothesis_text` | "gonna test IDOR at /api/users/{id}" |
| `action_text` | "curl -H Authorization: Bearer …" |
| `evidence_text` | "HTTP 403, body: …" |
| `evidence_source` | Optional URL |
| `conclusion_text` | "IDOR not possible here" |
| `conclusion_outcome` | confirmed / rejected / uncertain / refined |
| `conclusion_tag` | none / pivot / act / ignore / defer |
| `confidence_level` | low / medium / high |
| `belief_state` | open / leaning_true / leaning_false / confirmed / rejected |
| `system_tag` | none / needs_review / ruled_out / reportable / reasoning_debt / stale |
| `user_tag` | Free text, e.g. "idor" |
| `link_to_block_ids` | UUIDs of other blocks to link to |

On **create**, need ≥1 text field (hypothesis/action/evidence/conclusion). Title auto-derived from first field if omitted.

---

## Example chat prompts

- *"List my ContextLayer workspaces"*
- *"List blocks in workspace X"*
- *"Add evidence to the IDOR block: HTTP 200 with other user's data"*
- *"Get hygiene report for workspace X"*
- *"Save a block titled Auth bypass: hypothesis … action … in workspace Y"*
- *"What's already been ruled out in this workspace?"* → summary + hygiene
- *"Log this as rejected, ruled_out: …"*

---

## Workspace templates

`blank` | `agent_devops` | `security_hunt` | `product_research` | `decision_strategy` (default: `agent_devops`)
