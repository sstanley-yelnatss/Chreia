# Share viewer — implementation plan (step-by-step)

**Status:** ready to execute  
**Product lock:** PR body = structured receipt + link; full session trail (graph + logs) lives on an opt-in hosted viewer.  
**Visual lock:** match desktop aesthetic (cyan mark `#22d3ee`, dark theme tokens, real session graph — not markdown-only, not generic SaaS).  
**GTM note:** local-first for work; publish is explicit. Password optional for OSS “reviewers only.”

---

## 0. URL strategy (do this first — correct default)

**Yes — use [https://chreia.vercel.app](https://chreia.vercel.app) as the public base for now.**

| Why | Detail |
|-----|--------|
| Already live | Marketing site + export footer already point here |
| Custom domain later | e.g. `chreia.app` — change **one env**, not code |
| Share links | `{CHREIA_PUBLIC_URL}/s/{token}` |

**Do not scatter hardcodes.** Introduce a single public base URL config in each surface:

| Surface | Variable | Default |
|---------|----------|---------|
| `contextlayer-site` | `NEXT_PUBLIC_CHREIA_URL` | `https://chreia.vercel.app` |
| Desktop (Tauri) | `CHREIA_PUBLIC_URL` (build-time env or runtime prefs with same default) | `https://chreia.vercel.app` |
| Export crate footer | read from same desktop config / env; fallback default only | `https://chreia.vercel.app` |
| Publish API (server) | `CHREIA_PUBLIC_URL` (canonical links in responses) | same |

Helpers:

- Site: `src/lib/site.ts` → `export function publicUrl(path = "")`  
- Desktop: `getChreiaPublicUrl()` used when building clipboard + publish response display  
- Replace `const SITE_URL` in `crates/export/src/lib.rs` with injected/option URL (see Phase A)

When custom domain cuts over: set env on Vercel + desktop release CI; redeploy. No string hunt.

---

## 1. Goals / non-goals

### Goals (v1)

1. Desktop: **Publish trail & copy PR summary** (one primary action after confirm).
2. Hosted page `/s/[token]`: password gate (optional) + **session graph** + detail panel + receipt/blocks.
3. PR clipboard: structured receipt **without** inline raw/branch dumps; includes `Session trail: {url}`.
4. Optional password; unlisted long token; revoke later OK as v1.1.
5. Look like Chreia desktop (mark, accent, theme).

### Non-goals (v1)

- Git write / commit / push of trail files  
- Silent upload / telemetry of workspaces  
- Editing the share on the web  
- Accounts / SSO (Door B later)  
- Public index of shares  

---

## 2. Architecture (target)

```
Desktop (local SQLite + capture)
    │  POST /api/shares  (snapshot JSON + optional password)
    ▼
contextlayer-site (Vercel)
    │  store blob + metadata (token, password hash, created_at, expires_at?)
    ▼
GET /s/[token]  →  unlock if needed  →  SessionGraph viewer (app aesthetic)
```

**Snapshot payload (versioned):**

```json
{
  "schema_version": 1,
  "published_at": "ISO-8601",
  "workspace": { "name": "...", "goal": "..." },
  "receipt_markdown": "...",
  "blocks": [ /* export-selected block summaries */ ],
  "session_graph": { /* same shape as desktop SessionGraph */ },
  "message_slices": {
    "<lane>:<from>-<to>": [ /* CaptureLogMessage[] lazy or inline */ ]
  },
  "trace_options": {
    "checkpoints": true,
    "raw_log": true,
    "branch_logs": true,
    "log_slice": "past_50"
  }
}
```

Prefer **inline graph + on-demand message fetch** if payload is huge; for v1, embedding slices referenced by graph rows is OK if capped (reuse existing log slice limits).

**Storage pick for v1 (recommended):**

| Option | Pros | Cons |
|--------|------|------|
| **Vercel Blob + KV/Redis or Vercel Postgres for metadata** | Fits current site host | Blob size limits; wire-up |
| **Supabase Storage + table** | Simple auth/hash later | Extra vendor |
| **Turso/libSQL row with JSON** | One DB | Large JSON rows |

**Default recommendation:** Supabase (or Vercel Postgres) table `shares` (`token`, `password_hash`, `payload jsonb` or blob URL, `created_at`, `expires_at`) — one place for metadata + payload if under size cap; else payload in Blob, metadata in DB.

Record the final choice in Phase B before coding UI.

---

## 3. Phased execution (follow in order)

### Phase A — Config & URL hygiene (½ day)

**A1.** Add `NEXT_PUBLIC_CHREIA_URL` to `contextlayer-site` (`.env.example`, Vercel project env).  
**A2.** Add `src/lib/site.ts` with `getPublicUrl()` / `absoluteUrl(path)`.  
**A3.** Replace hardcodes in site (`layout.tsx` `metadataBase`, README note).  
**A4.** Desktop: `CHREIA_PUBLIC_URL` defaulting to same; expose via Tauri command or Vite `import.meta.env`.  
**A5.** Export crate: pass `site_url: &str` into PR footer (from desktop); keep default constant as **fallback only**.  
**A6.** Document in README: “Public URL is env-driven; production default is chreia.vercel.app.”

**Exit:** no new feature yet; all public links resolve from env.

---

### Phase B — Backend: create + fetch share (1–2 days)

**B1.** Choose storage; provision; add server env (`SHARE_STORE_*`, `CHREIA_PUBLIC_URL`).  
**B2.** `POST /api/shares`

- Body: snapshot JSON + optional `password` (plaintext once)  
- Generate `token` = URL-safe 128+ bits  
- Store `password_hash` (argon2id) or null  
- Return `{ url, token, password_set }` where `url = ${CHREIA_PUBLIC_URL}/s/${token}`  

**B3.** Auth for publish (v1 pragmatic):

- Shared **publish secret** header `Authorization: Bearer ${CHREIA_SHARE_PUBLISH_KEY}` that desktop ships via env/CI for alpha, **or**  
- Unsigned alpha with rate limits + abuse caps (document risk)  

Prefer publish key for alpha so random internet can’t fill the store.

**B4.** `GET /api/shares/[token]`

- If password required and no valid unlock cookie → `401 { needs_password: true }`  
- Else return snapshot (or graph metadata + signed URLs for slices)  

**B5.** `POST /api/shares/[token]/unlock` — verify password; set httpOnly cookie (short TTL, SameSite=Lax).  

**B6.** Redaction: desktop must apply existing capture redaction **before** upload; API rejects oversized payloads (e.g. 2–5 MB soft cap).  

**Exit:** curl can create a share and fetch it; password gate works.

---

### Phase C — Viewer UI shell (aesthetic first) (1–2 days)

**C1.** Route `app/s/[token]/page.tsx` (and unlock client component).  
**C2.** Port desktop theme tokens into site viewer layout (copy CSS variables from `apps/desktop/src/styles/theme.css` into a viewer-scoped stylesheet — don’t break marketing page light/brand sections if different).  
**C3.** Chrome: cyan mark + “Chreia” wordmark + “Session trail” label; link home via `getPublicUrl()`.  
**C4.** Password gate screen: same chrome; single field; no generic auth kit look.  
**C5.** Empty/error states: invalid token, expired, payload too old schema.  

**Exit:** `/s/demo` or fixture renders branded shell without graph data.

---

### Phase D — Session graph on web (2–3 days) — UX bar critical path

**D1.** Extract or duplicate `SessionGraphView` + `SessionGraphDetailPanel` for web:

- Prefer **shared package** later; for speed, carefully port into `contextlayer-site/src/components/share/` with same geometry/colors (`#22d3ee`, fork palette, reject `#f87171`).  
- Types: copy `SessionGraph`, `SessionGraphLane`, `SessionGraphRow`, `CaptureLogMessage` from desktop `types.ts`.  

**D2.** Wire selection → detail panel (message list) from snapshot `message_slices`.  
**D3.** Layout: graph primary; detail panel; optional tab/section for receipt markdown / blocks.  
**D4.** Keyboard/focus basics; don’t trap scroll.  
**D5.** Visual QA against desktop screenshot of same workspace.  

**Exit:** reviewer can navigate merged/rejected lanes and read agent messages like in-app.

---

### Phase E — Desktop publish + clipboard (1–2 days)

**E1.** Split export compiler paths:

- `receipt_markdown` — blocks only (+ short “Session trail: {url}” placeholder or appended after publish)  
- `trail_snapshot` — graph + slices per checkboxes (checkpoints / raw / branch)  

**E2.** Export UI (Timeline PR mode):

- Keep block selection + trace checkboxes (apply to **snapshot**, not PR body).  
- Primary: **Publish trail & copy PR summary**  
- Secondary: **Copy receipt only** (no publish)  
- Optional: password toggle + generate/copy password  
- Confirm dialog: what will be uploaded (workspace name, options, size estimate) — explicit opt-in  

**E3.** Tauri command `publish_share_trail` → HTTPS POST with publish key + snapshot.  
**E4.** On success: clipboard = receipt + `Session trail: {url}`; toast with URL; if password, show once + copy.  
**E5.** Failure: clear error (network, 413, 401); never pretend published.  
**E6.** Help page: update “PR export” section — trail is link to viewer; raw not inlined by default.  

**Exit:** end-to-end from desktop → open link in browser → graph works.

---

### Phase F — Site copy + marketing alignment (½ day)

**F1.** Soft-update homepage Export blurb: appendix in PR + optional link to full session trail (don’t block launch video).  
**F2.** Footer still “data stays local” — add “unless you publish a share link.” Honesty.  

---

### Phase G — Hardening (ongoing / v1.1)

- Expiry default (e.g. 30–90 days) + revoke endpoint  
- Size quotas per publish key  
- Schema migrations for `schema_version`  
- Optional “also download .md”  
- Git-file export as power user path (deferred)  

---

## 4. Step checklist (execute top to bottom)

Copy this into the PR description or a tracking issue; check off as you go.

- [x] **A1–A6** Public URL env + helpers; remove hardcode sprawl  
- [x] **B1** Storage provisioned (local `.data/shares` + Vercel Blob when token set)  
- [x] **B2–B3** `POST /api/shares` + publish key  
- [x] **B4–B5** GET + unlock  
- [x] **B6** Size + redaction rules (size cap; desktop applies existing redaction before upload)  
- [x] **C1–C5** `/s/[token]` shell + password UI (desktop aesthetic)  
- [x] **D1–D5** Session graph + detail panel port  
- [x] **E1–E6** Desktop publish + clipboard + help  
- [x] **F1–F2** Site honesty copy  
- [ ] Manual QA: password on/off, merged+rejected graph, mobile skim, custom URL via env  
- [ ] **Your input:** set `BLOB_READ_WRITE_TOKEN` + `CHREIA_SHARE_PUBLISH_KEY` on Vercel; mirror publish key in desktop `VITE_CHREIA_SHARE_PUBLISH_KEY`
---

## 5. File touch map (expected)

| Area | Files (approx.) |
|------|------------------|
| Site config | `contextlayer-site/.env.example`, `src/lib/site.ts`, `src/app/layout.tsx` |
| Site API | `src/app/api/shares/route.ts`, `src/app/api/shares/[token]/route.ts`, `.../unlock/route.ts` |
| Site viewer | `src/app/s/[token]/page.tsx`, `src/components/share/*` |
| Desktop UI | `TimelinePage.tsx`, HelpPage, api.ts |
| Desktop Rust | `apps/desktop/src-tauri/src/lib.rs` (publish command) |
| Export | `crates/export/src/lib.rs` (injectable site URL; receipt vs trail split) |
| Trace | reuse `compile_pr_trace_appendix_*` + session graph builders already used by desktop |

---

## 6. Testing plan

1. **Unit:** password hash verify; token entropy; receipt markdown excludes raw log section.  
2. **API:** create → fetch 401 → unlock → fetch 200; wrong password; missing token.  
3. **UI:** visual diff vs desktop graph on fixture JSON.  
4. **E2E manual:** real workspace with 1 merged + 1 rejected branch → publish → paste into empty PR → open link.  
5. **Config:** set `NEXT_PUBLIC_CHREIA_URL` to `http://localhost:3000` for local; confirm links don’t still say vercel.app.

---

## 7. Demo / Cut A impact

Until ship: demo continues **structured paste only** (or temp inline) per prior lock.  
After ship: Shot 9–10 become publish → show URL in clipboard → PR paste shows link → cut to branded viewer graph (password optional beat). Update Obsidian Cut A script when E exits.

---

## 8. Open decisions (resolve in Phase B before coding)

1. **Storage vendor:** Supabase vs Vercel Blob+Postgres — pick one, don’t abstract prematurely.  
2. **Publish auth:** shared publish key for alpha (recommended) vs open+rate-limit.  
3. **Message payload:** embed all selected slices vs fetch-by-row (embed first if under cap).  
4. **Default expiry:** none vs 90 days for v1.

---

## 9. Definition of done

- [ ] Export publishes opt-in share; PR clipboard has receipt + link only  
- [ ] `/s/[token]` matches desktop aesthetic (cyan mark, theme, graph navigable)  
- [ ] Optional password works; password never stored plaintext  
- [ ] All public URLs from `CHREIA_PUBLIC_URL` / `NEXT_PUBLIC_CHREIA_URL`  
- [ ] Help + site copy don’t claim “never leaves machine” without the publish caveat  
- [ ] This plan’s checklist A→F complete  

---

*Last updated: 2026-08-01 — web viewer primary; git-file deferred.*
