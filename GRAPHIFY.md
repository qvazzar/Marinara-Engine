# Graphify Instructions

Graphify is the persistent repository map for the Marinara Engine `refactor` branch. It turns the project files into a knowledge graph under `graphify-out/` so agents can query relationships instead of repeatedly sweeping raw files.

## Prerequisites

Keep Graphify installed and available before codebase-navigation, architecture, file-relationship, or implementation work on this branch.

| Requirement | Minimum | Check | Install |
| --- | --- | --- | --- |
| Python | 3.10+ | `python --version` | [python.org](https://www.python.org/downloads/) |
| `uv` (recommended) | Any | `uv --version` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| `pipx` (alternative) | Any | `pipx --version` | `pip install pipx` |

Quick installs:

```sh
# macOS with Homebrew
brew install python@3.12 uv

# Windows
winget install astral-sh.uv

# Ubuntu/Debian
sudo apt install python3.12 python3-pip pipx

# Ubuntu/Debian uv alternative
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Install Graphify

The official PyPI package is `graphifyy` (double-y). Other `graphify*` packages on PyPI are not affiliated. The CLI command is still `graphify`.

Install the package:

```sh
# Recommended: uv puts graphify on PATH automatically.
uv tool install graphifyy

# Alternatives.
pipx install graphifyy
pip install graphifyy
```

Register the assistant integration after installing the package:

```sh
graphify install --platform opencode
```

To install the assistant skill into the current repository instead of the user profile, run from the repository root:

```sh
graphify install --project
graphify install --project --platform opencode
```

Project-scoped installs write under the current directory, for example `.claude/skills/graphify/SKILL.md` or `.agents/skills/graphify/SKILL.md`, and print a `git add` hint for files that can be committed. Per-platform commands that support project-scoped installs accept the same flag, for example `graphify claude install --project` or `graphify codex install --project`.

PowerShell note: use `graphify .`, not `/graphify .`, because a leading slash is treated as a path separator.

If `graphify` is not found after install, use `uv tool install graphifyy` or `pipx install graphifyy`; both put the CLI on `PATH` automatically. With plain `pip`, add `~/.local/bin` on Linux or `~/Library/Python/3.x/bin` on macOS to `PATH`, or run `python -m graphify`.

## Platform Registration

| Platform | Install command |
| --- | --- |
| Claude Code (Linux/Mac) | `graphify install` |
| Claude Code (Windows) | `graphify install --platform windows` |
| Codex | `graphify install --platform codex` |
| OpenCode | `graphify install --platform opencode` |
| GitHub Copilot CLI | `graphify install --platform copilot` |
| VS Code Copilot Chat | `graphify vscode install` |
| Aider | `graphify install --platform aider` |
| OpenClaw | `graphify install --platform claw` |
| Factory Droid | `graphify install --platform droid` |
| Trae | `graphify install --platform trae` |
| Trae CN | `graphify install --platform trae-cn` |
| Gemini CLI | `graphify install --platform gemini` |
| Hermes | `graphify install --platform hermes` |
| Kimi Code | `graphify install --platform kimi` |
| Amp | `graphify amp install` |
| Kiro IDE/CLI | `graphify kiro install` |
| Pi coding agent | `graphify install --platform pi` |
| Cursor | `graphify cursor install` |
| Devin CLI | `graphify devin install` |
| Google Antigravity | `graphify antigravity install` |

Codex users also need `multi_agent = true` under `[features]` in `~/.codex/config.toml`. Codex uses `$graphify` instead of `/graphify`.

## Optional Extras

Install only what you need:

| Extra | What it adds | Install |
| --- | --- | --- |
| `pdf` | PDF extraction | `pip install "graphifyy[pdf]"` |
| `office` | `.docx` and `.xlsx` support | `pip install "graphifyy[office]"` |
| `google` | Google Sheets rendering | `pip install "graphifyy[google]"` |
| `video` | Video/audio transcription with faster-whisper and yt-dlp | `pip install "graphifyy[video]"` |
| `mcp` | MCP stdio server | `pip install "graphifyy[mcp]"` |
| `neo4j` | Neo4j push support | `pip install "graphifyy[neo4j]"` |
| `svg` | SVG graph export | `pip install "graphifyy[svg]"` |
| `leiden` | Leiden community detection (Python < 3.13 only) | `pip install "graphifyy[leiden]"` |
| `ollama` | Ollama local inference | `pip install "graphifyy[ollama]"` |
| `openai` | OpenAI and OpenAI-compatible APIs | `pip install "graphifyy[openai]"` |
| `gemini` | Google Gemini API | `pip install "graphifyy[gemini]"` |
| `bedrock` | AWS Bedrock using IAM, no API key | `pip install "graphifyy[bedrock]"` |
| `sql` | SQL schema extraction | `pip install "graphifyy[sql]"` |
| `chinese` | Chinese query segmentation with jieba | `pip install "graphifyy[chinese]"` |
| `all` | Everything above | `pip install "graphifyy[all]"` |

## Make Assistants Use The Graph

Run this once in the project after building a graph:

| Platform | Command |
| --- | --- |
| Claude Code | `graphify claude install` |
| Codex | `graphify codex install` |
| OpenCode | `graphify opencode install` |
| GitHub Copilot CLI | `graphify copilot install` |
| VS Code Copilot Chat | `graphify vscode install` |
| Aider | `graphify aider install` |
| OpenClaw | `graphify claw install` |
| Factory Droid | `graphify droid install` |
| Trae | `graphify trae install` |
| Trae CN | `graphify trae-cn install` |
| Cursor | `graphify cursor install` |
| Gemini CLI | `graphify gemini install` |
| Hermes | `graphify hermes install` |
| Kimi Code | `graphify install --platform kimi` |
| Amp | `graphify amp install` |
| Kiro IDE/CLI | `graphify kiro install` |
| Pi coding agent | `graphify pi install` |
| Devin CLI | `graphify devin install` |
| Google Antigravity | `graphify antigravity install` |

This writes a small config file that tells the assistant to consult the knowledge graph for codebase questions, preferring scoped queries like `graphify query "<question>"` over reading the full report or grepping raw files. `GRAPH_REPORT.md` remains available for broad architecture review.

To remove Graphify from all platforms at once, run `graphify uninstall`. Add `--purge` only when you also want to delete `graphify-out/`. Per-platform uninstall commands are also available, for example `graphify claude uninstall`.

## Required Workflow

- This repository has a persistent `graphify-out/` map. Use it as navigational evidence, not as authority over current source files.
- Before broad architecture, unfamiliar-area, dependency, or file-relationship exploration, read `graphify-out/GRAPH_REPORT.md` or use `graphify query "<question>"`.
- Prefer scoped graph queries over broad raw-file searches when the question is about relationships between areas.
- After every code change, run `graphify update .` from the repository root so the map stays current.
- For docs, PDFs, images, or other semantic-source changes, run `/graphify . --update` or the equivalent Graphify update path so semantic nodes are refreshed.
- Do not hand-edit generated `graphify-out/` files.
- If Graphify is unavailable, say so in the final response and fall back to direct source inspection. Do not invent graph evidence.

## Common Commands

- `graphify .`: build or rebuild the graph for the current repository.
- `graphify update .`: incrementally update the existing graph after changes.
- `graphify query "<question>"`: ask a relationship question against `graphify-out/graph.json`.
- `graphify path "Node A" "Node B"`: find the shortest path between two concepts.
- `graphify explain "Node"`: explain one node and its neighbors.
- `graphify export callflow-html`: generate a Mermaid architecture/call-flow HTML view.
- `graphify hook install`: install post-commit/post-checkout hooks that rebuild graph output and configure merge handling for `graph.json`.
- `graphify hook status`: check whether the hooks are installed.

PowerShell note: use `graphify .`, not `/graphify .`, because a leading slash is treated as a path separator.

## What Graphify Builds

The core outputs live in `graphify-out/`:

- `graphify-out/graph.html`: interactive graph for browser exploration, search, filtering, and community navigation.
- `graphify-out/GRAPH_REPORT.md`: human-readable highlights, report sections, freshness information, and suggested questions.
- `graphify-out/graph.json`: persistent graph data that can be queried later without re-reading the whole repository.
- `graphify-out/wiki/`: optional agent-crawlable Markdown wiki when built with `--wiki`.
- `graphify-out/cache/`: content-hash cache so unchanged files are skipped on future runs.

## How It Works

- Detection finds supported code, docs, PDFs, images, video/audio, office files with optional extras, and selected config formats.
- Code extraction runs locally with tree-sitter and call-graph passes. Normal code-only updates do not require LLM semantic extraction.
- Video and audio transcription runs locally when the `video` extra is installed.
- Docs, PDFs, images, and transcripts use the configured assistant or headless backend for semantic extraction.
- Graph construction uses nodes, edges, confidence tags, community detection, and analysis to produce reports and queryable graph data.
- Every relationship is tagged `EXTRACTED`, `INFERRED`, or `AMBIGUOUS` so readers can tell source facts from model inferences.

## Reading `GRAPH_REPORT.md`

Use the report as a navigation map. Verify behavior claims against source files before changing code or giving final answers.

- `Corpus Check`: file count, approximate word count, and whether the corpus is large enough for graph structure to add value.
- `Summary`: node count, edge count, community count, extraction confidence mix, and token cost.
- `Graph Freshness`: commit the graph was built from, with a reminder to compare against `git rev-parse HEAD` and run `graphify update .` after code changes.
- `Community Hubs (Navigation)`: links into community hub pages when Obsidian/wiki-style outputs exist.
- `God Nodes`: the highest-degree concepts, functions, utilities, or abstractions. These often reveal central coupling points or utility hubs.
- `Surprising Connections`: cross-file or cross-module links ranked for unexpectedness. Treat inferred entries as leads to verify, not as proof.
- `Hyperedges`: group relationships connecting three or more nodes when the group relationship matters beyond pairwise edges.
- `Communities`: clusters of related nodes with cohesion scores. Low cohesion can indicate broad or weakly connected areas; high cohesion can indicate tightly related feature or infrastructure slices.
- `Ambiguous Edges`: relationships Graphify could not classify confidently. Review these manually before relying on them.
- `Knowledge Gaps`: isolated nodes, thin communities, or high ambiguity that may signal missing edges, missing docs, or stale graph output.
- `Suggested Questions`: relationship questions the graph is well positioned to answer. These are good starting points for `graphify query`.

## Confidence Tags

- `EXTRACTED`: directly found in the source, such as imports, direct calls, citations, or explicit references.
- `INFERRED`: reasonable deduction from naming, context, shared data, or semantic alignment. Check the confidence score and verify in source.
- `AMBIGUOUS`: uncertain relationship flagged for human review. Do not treat it as established behavior.

## Privacy And Scope

- Code files are processed locally for AST extraction.
- Docs, PDFs, images, and transcripts may be sent through the configured AI backend for semantic extraction.
- Do not graph private chat transcripts, secrets, generated dependency/build output, provider caches, or unrelated workspace folders unless the user explicitly asks and the scope is safe.
- Use Graphify to decide where to inspect, then cite and trust source files, tests, and project docs for behavior.
