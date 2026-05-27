# Professor Mari branch difference and merge plan

Compared on 2026-05-27.

- Current branch: `refactor` at `7eb42c13`
- Other branch: `origin/feat/prof-mari-optimizations` at `b14be863`
- Merge base: `e1a74452`
- Working tree note: `src-tauri/Cargo.toml` was already modified locally before this report was created.

## Executive summary

The two branches evolved Professor Mari in different directions and should not be merged wholesale.

Current `refactor` makes Professor Mari a codebase-research/workspace assistant:

- Rust backend is one large `src-tauri/src/commands/storage/mari.rs` file.
- Tools include `read_marinara_library`, `search_marinara_code`, `read_marinara_code_file`, `edit_marinara_code_file`, `create_marinara_extension`, and `create_marinara_custom_agent`.
- Frontend has persisted Professor Mari preferences, persisted conversation history, context compaction, and `/reset`.
- `AGENTS.md` contains the Professor Mari codebase-agent guidance and source map.

`feat/prof-mari-optimizations` makes Professor Mari a virtual creative-library editing agent:

- Rust backend is split into `src-tauri/src/commands/storage/mari/*.rs` modules.
- It adds a Bashkit virtual workspace seeded from the user's creative library.
- Tools are Pi-like `read`, `bash`, `edit`, and `write` over the virtual workspace.
- Mutating workspace tools produce staged file changes, stream approval requests, and apply mapped changes back to storage after approval.
- Frontend is redesigned around live tool traces, approval panels, staged diff review, and storage invalidation.
- It does not carry over current persisted history/compaction/preferences or the codebase/extension/custom-agent tools.

Recommended merge strategy: manually port the optimizations into `refactor`, not a raw branch merge. Use the optimized modular backend and approval UI as a base, but preserve `refactor`'s Professor Mari history/preferences/compaction, codebase-agent tools, `AGENTS.md` guidance, remote-runtime routing, and unrelated refactor fixes.

## Professor Mari file differences

| Area | Current `refactor` | `feat/prof-mari-optimizations` | Merge recommendation |
| --- | --- | --- | --- |
| `AGENTS.md` | Adds Professor Mari codebase-agent rules and current map. | Deletes the Professor Mari section relative to current branch. | Keep the current section and update the map for new modular Rust files if they are adopted. |
| `src/engine/mari/mari-entry.ts` | Defines request/response/action contract with `compactedSummary`, simple `none/create_record/edit_record` action normalization, and empty-response rejection. | Adds `MariTraceEvent`, `MariFileChange`, `MariStorageAction`, staged-change action types, approval request/outcome/result types, trace normalization, and staged-action helpers. Drops `compactedSummary` and empty-response guard. | Merge contracts: keep `compactedSummary`, keep empty-response guard, add trace/staged-change/approval types and normalizers. |
| `src/engine/mari/mari-entry.test.ts` | Tests empty response rejection. | File absent. | Keep and extend for trace/action normalization. |
| `src/engine/mari/mari-history.ts` | Adds persisted chat history helpers, token estimates, context compaction, `/reset`, and LLM-based summarization. | File absent. | Keep. Add trace-aware message persistence only if you want tool traces to survive reload. |
| `src/engine/mari/mari-history.test.ts` | Covers reset and compaction behavior. | File absent. | Keep. |
| `src/shared/api/mari-api.ts` | Wraps `professor_mari_prompt`; stores selected connection/persona and chat history/compaction in `app-settings`. | Uses Tauri `Channel` for stream events and adds `applyStagedChanges` / `resolveApproval`; no preferences/history storage. | Combine both. Keep preferences/history APIs, add streaming prompt, apply, and resolve wrappers. |
| `src/features/shell/mari/components/ProfessorMariSurface.tsx` | Persisted history loading/saving, preferences loading/saving, connection setup UX, `/reset`, compaction before prompt, current chat-message shell rendering. | New visual surface with stage sprites, live trace, pending approval, staged changes/diff panels, apply/reject handlers, query invalidation, richer error details. State is in-memory only. | Manual merge. Start from the optimized UI, then re-add current history/preferences/compaction/reset/connection-validation flows. |
| `src-tauri/src/commands/storage/commands/mari.rs` | Only exposes `professor_mari_prompt(request)`. | Changes prompt signature to include `on_event: tauri::ipc::Channel<Value>` and adds `professor_mari_apply_staged_changes` plus `professor_mari_resolve_approval`. | Add the new commands, but keep remote-runtime compatibility by splitting core logic from Tauri `Channel` or providing a no-op/collecting event sink for HTTP. |
| `src-tauri/src/commands/storage/mari.rs` | Single large module with current codebase/library/extension/custom-agent tools. Requires native tool support and returns `capability: workspace_agent`. | Thin root module with constants and delegation to `actions`, `agent`, `file_changes`, `prompt`, `shell`, `tools`, `types`, `util`, and `workspace`. Uses Bashkit virtual workspace and staged storage actions. | Adopt modularization, but port current codebase, extension, and custom-agent tools into modules rather than dropping them. |
| `src-tauri/src/commands/storage/mari/actions.rs` | Absent. | Maps virtual workspace diffs back to storage `create_record` / `edit_record` actions and applies them. | Port, but add tests for all entity/file mappings before trusting destructive writes. |
| `src-tauri/src/commands/storage/mari/agent.rs` | Absent; equivalent provider code is inside `mari.rs`. | Moves AutoAgents provider/agent hooks and trace summaries into a module. | Port and preserve current provider fixes as needed. |
| `src-tauri/src/commands/storage/mari/file_changes.rs` | Absent. | Computes full before/after file maps and previews. | Port. |
| `src-tauri/src/commands/storage/mari/prompt.rs` | Current prompt builder is inline and includes codebase-agent instructions plus `compactedSummary`. | Prompt builder focuses on virtual creative-library workspace and attachments. | Merge prompts: include codebase inspection rules, virtual workspace rules, persona context, history, compacted summary, and attachments. |
| `src-tauri/src/commands/storage/mari/shell.rs` | Absent. | Implements isolated Bashkit filesystem/session, virtual workspace reads/writes, tracing, and approval event streaming. | Port if Bashkit is accepted. Keep it isolated from real repo filesystem. |
| `src-tauri/src/commands/storage/mari/tools.rs` | Current tools are inline and named domain/codebase tools. | Implements Pi-like `read/bash/edit/write` virtual workspace tools and approval gate. | Port target tools and add current domain/codebase tools as additional tools, or deliberately rename/scope them to avoid ambiguity. |
| `src-tauri/src/commands/storage/mari/types.rs` | Current request/persona/message/attachment structs are inline and include `compacted_summary`. | Module structs omit `compacted_summary`; include optional `workspace_files`. | Merge structs; keep `compacted_summary`, keep `workspace_files` if useful. |
| `src-tauri/src/commands/storage/mari/workspace.rs` | Absent. | Seeds `/workspace` from characters, personas, lorebooks, prompts, groups, format guides, and bindings. | Port and review mappings against current storage schemas. |
| `src-tauri/src/state.rs` | No Mari approvals. Contains unrelated current refactor fixes/tests. | Adds `mari_approvals` registry but also reverts unrelated state/startup/test code. | Cherry-pick only the approval registry additions; do not take the whole file. |
| `src-tauri/src/lib.rs` | Registers current prompt plus other refactor commands. | Registers prompt/apply/resolve but removes unrelated commands relative to current branch. | Add only the two new Mari commands; preserve all current refactor registrations. |
| `src-tauri/src/http_dispatch.rs` | Exposes `professor_mari_prompt` in remote runtime. | Removes the prompt route in direct diff and does not add apply/resolve routes. | Rebuild remote pipeline: prompt needs an event-sink abstraction because HTTP cannot receive Tauri `Channel`. Add apply/resolve dispatch routes if remote Professor Mari remains supported. |
| `src-tauri/Cargo.toml` / `Cargo.lock` | Uses crates.io `autoagents = "0.3.7"`; package version/scripts are current refactor. | Adds `bashkit = "0.7.1"`, switches AutoAgents to a git revision, adds `marinara-integrations`, but also changes package version to `0.1.0`. | Manually add only required dependency changes. Do not take version/script regressions. Be careful: local `src-tauri/Cargo.toml` is already dirty. |
| `package.json` | Current refactor scripts use `scripts/run-vite.mjs` and version `1.6.1`. | Reverts scripts to raw `vite`/`tauri` and version `0.1.0`. | Do not take this diff for Professor Mari. |

## Behavioral changes in the optimization branch

### Added by `feat/prof-mari-optimizations`

1. **Virtual creative-library workspace**
   - Mari sees `/workspace/index.md`, entity folders, `FORMAT.md` guides, and descriptive record paths.
   - Storage IDs are hidden in workspace bindings.
   - Edits to bound workspace files can be translated into storage updates.

2. **Pi-like tool surface**
   - New tools are `read`, `bash`, `edit`, and `write`.
   - These run against Bashkit's isolated virtual filesystem, not the real repository.
   - `bash` is useful for workspace-local inspection and text operations.

3. **Approval and staged changes**
   - Mutating tool calls are diffed.
   - If changes map cleanly to storage actions, Mari pauses and streams an approval request.
   - On approval, actions are applied to storage and the agent continues.
   - On rejection, the virtual filesystem rolls back and the agent continues with the rejection outcome.
   - Unmapped changes are rejected before approval.

4. **Frontend trace/review UX**
   - Live tool trace events are shown while Mari is thinking.
   - Approval panels let the user approve/reject pending mutations.
   - Final staged-change panels show diff previews and allow applying staged storage actions.
   - React Query invalidates after applied changes.

### Lost relative to current `refactor`

1. **Persistent chat state**
   - No persisted messages, selected connection/persona, compaction state, or `/reset` support in the target UI/API.

2. **Context compaction**
   - `compactedSummary` is removed from the target request contract and prompt path.

3. **Codebase-agent behavior**
   - Target prompt/tools focus on creative-library workspace, not Marinara source-code research.
   - It drops `search_marinara_code`, `read_marinara_code_file`, `edit_marinara_code_file`, extension creation, and custom-agent creation unless manually ported.

4. **Remote runtime compatibility**
   - Target prompt command requires a Tauri `Channel`, but the current HTTP dispatch route passes only JSON.
   - Directly taking target `http_dispatch.rs` would remove the current `professor_mari_prompt` remote route.

5. **Guidance/tests**
   - Target removes the current Professor Mari map in `AGENTS.md` and the new `src/engine/mari` tests.

## Suggested merge sequence

1. **Create a safety branch from current `refactor`.**

   ```bash
   git switch refactor
   git switch -c merge/prof-mari-optimizations
   git status --short
   ```

   Resolve or stash the existing local `src-tauri/Cargo.toml` change before touching dependencies.

2. **Do not run a full merge yet.**

   A raw merge would bring unrelated reversions/deletions in `package.json`, `src-tauri/src/state.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/http_dispatch.rs`, tests, docs, Home Assistant files, and version metadata.

3. **Port TypeScript contracts first.**

   - Start from current `src/engine/mari/mari-entry.ts`.
   - Add target trace/staged-change/approval types and normalizers.
   - Keep `compactedSummary` in `MariEntryRequest`.
   - Keep empty-response rejection in `runProfessorMariEntry`.
   - Keep `src/engine/mari/mari-history.ts` and tests.

4. **Merge `src/shared/api/mari-api.ts`.**

   Keep current `preferences` and `history` namespaces, then add:

   - `prompt(request, onEvent)` using Tauri `Channel` for embedded runtime.
   - `applyStagedChanges(action)`.
   - `resolveApproval(approvalId, approved)`.

   If persisted assistant messages should retain traces after reload, update `appendMessage` / normalization to accept and store `trace`.

5. **Merge the UI manually.**

   Use target `ProfessorMariSurface.tsx` as the visual/review base, then reintroduce current branch logic:

   - load/save selected connection/persona preferences;
   - load/save/reset history;
   - run compaction before prompt;
   - pass `compactedSummary` to `runProfessorMariEntry`;
   - persist user/assistant messages instead of only keeping in-memory state;
   - preserve connection setup and no-connection UX;
   - keep approval/live trace/staged diff panels from target.

6. **Port Rust backend in modules.**

   Bring in target modules under `src-tauri/src/commands/storage/mari/`, but merge current functionality instead of replacing it:

   - Keep target `shell`, `workspace`, `actions`, `file_changes`, and approval-aware `tools`.
   - Port current codebase tools into a dedicated module, for example `codebase_tools.rs`.
   - Port current extension/custom-agent creation tools into a dedicated module or into `tools.rs`.
   - Update the agent tool list to include both creative-library virtual workspace tools and codebase/agent-extension tools.
   - Update the system/task prompt so Professor Mari knows when to use each tool family.

7. **Add only the required state/command registrations.**

   From target `src-tauri/src/state.rs`, cherry-pick only:

   - `mari_approvals` field;
   - initialization in `AppState::from_data_dir`;
   - `register_mari_approval`, `resolve_mari_approval`, and `cancel_mari_approval`.

   Do not take unrelated removals in startup seeding or game-state snapshot repair tests.

   From target `src-tauri/src/lib.rs`, add only:

   - `professor_mari_apply_staged_changes`;
   - `professor_mari_resolve_approval`.

8. **Fix remote runtime explicitly.**

   Current architecture exposes Professor Mari through `src-tauri/src/http_dispatch.rs`. Because target uses Tauri `Channel`, create a core event abstraction such as:

   - Tauri command: wraps events into `tauri::ipc::Channel<Value>`.
   - HTTP dispatch: uses a no-op or collected event sink and returns final JSON.

   Then expose remote routes for:

   - `professor_mari_prompt`;
   - `professor_mari_apply_staged_changes` if staged changes are supported remotely;
   - `professor_mari_resolve_approval` only if remote approval has a viable request/response lifecycle.

9. **Dependencies.**

   Manually add dependencies needed by the port:

   - `bashkit = "0.7.1"` if adopting the virtual workspace.
   - AutoAgents git revision only if the target code requires APIs missing from crates.io `0.3.7`.

   Do not accept target's `package.json` / `Cargo.toml` version regressions or script reversions.

10. **Update guidance.**

   Keep `AGENTS.md` Professor Mari section and update the map from:

   - `src-tauri/src/commands/storage/mari.rs`

   to:

   - `src-tauri/src/commands/storage/mari.rs` plus `src-tauri/src/commands/storage/mari/*.rs` modules.

## Conflict hotspots

Expect manual conflicts in:

- `src/engine/mari/mari-entry.ts`
- `src/shared/api/mari-api.ts`
- `src/features/shell/mari/components/ProfessorMariSurface.tsx`
- `src-tauri/src/commands/storage/mari.rs`
- `src-tauri/src/commands/storage/commands/mari.rs`
- `src-tauri/src/state.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/http_dispatch.rs`
- `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock`

Avoid accepting target deletions of:

- `AGENTS.md` Professor Mari guidance;
- `src/engine/mari/mari-history.ts`;
- `src/engine/mari/*.test.ts`;
- current refactor-specific command registrations and runtime routes;
- current package/script/version metadata.

## Verification after merge

Run at least:

```bash
pnpm typecheck
pnpm check:architecture
cargo check --manifest-path src-tauri/Cargo.toml
```

If Rust modules or docs/guidance are touched, also run:

```bash
pnpm check:docs
```

Recommended focused manual tests:

1. Open Professor Mari, select a connection/persona, reload app, verify selections persist.
2. Send enough history to trigger compaction or lower max context in a test connection; verify compacted summary is passed.
3. Ask a Marinara source-code question; verify Mari uses codebase search/read tools before answering.
4. Ask for a creative-library edit; verify workspace diff appears, approval works, storage updates, and rejection rolls back.
5. Verify remote/hostable runtime behavior for `professor_mari_prompt` if remote support is still required.

## Bottom-line decision

Take these from `feat/prof-mari-optimizations`:

- Modular Rust `mari/` backend shape.
- Bashkit virtual workspace for creative-library editing.
- Staged change mapping and approval registry.
- Streaming trace and approval frontend UX.
- Diff/review panels.

Preserve these from current `refactor`:

- Professor Mari as a codebase-research agent.
- Codebase read/search/edit, extension, and custom-agent tools.
- Persistent preferences/history/compaction and `/reset`.
- `AGENTS.md` guidance and source map.
- Remote runtime HTTP pipeline.
- Current refactor package/version/script/state fixes and tests.
