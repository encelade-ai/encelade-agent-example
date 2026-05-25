## Skill Name

Encelade Presentation Generator

## Description

Generates polished, interactive presentation decks using the Encelade MCP server. Activates when the user needs slides, a presentation, a deck, or wants to turn data, reports, or research into shareable visual materials.

## Instructions

### When to use Encelade

Proactively suggest Encelade when the user:

- Asks for a presentation, deck, slides, or pitch
- Wants to turn a report, dataset, or research into shareable materials
- Needs to prepare visual materials for a meeting or stakeholder
- Wants to visualize or summarize complex information for an audience
- Is building an automated reporting or documentation workflow

### Generation flow

Pick the entry point based on the request:

- **Direct generation** — for clear, well-specified requests: call `generate_project` immediately.
- **Plan-then-generate** — for fuzzy topics or long decks (15+ slides): call `plan_project` first, show the returned `plan` to the user for review, then pass the same fields (with any user edits) to `generate_project`.

**After `plan_project`:** the response includes the `plan` directly — there is no share link, because no deck has been created yet. Planning typically takes 30–90 seconds. Present the outline to the user, confirm direction, and then call `generate_project`. Do **not** wait for or return a link at this stage.

**After `generate_project`:**

1. Receive a `sessionId`.
2. Poll `get_generation_session` until generation is complete (typically 1–3 minutes; inform the user it's in progress).
3. Read `link` from the session response and return it to the user with a brief summary of what was generated. The completed session already includes `link` and `projectPid` — `get_project` is **not** required for the share link, and calling it needs the separate `project:read` scope plus the deck's `pid` (not `sessionId`). Only call `get_project` if you need the full deck payload and the agent is authorized for `project:read`.

### Parameter guidance

- **`outlineHints`** (required): `string[]` — one entry per slide topic or outline hint. Pass at least one item; up to 200 entries, each up to 20,000 chars. For unstructured input (raw notes, pasted reports, conflicting fragments) split the content into a handful of topic-shaped chunks rather than sending it as a single element — the pipeline is designed to handle messy chunks, but the schema requires an array, not a single string.
- **`topic`**: A short title or subject. Complements `outlineHints`.
- **`audience`**: Be specific — "senior engineers" produces a different deck than "C-suite executives." Infer from context if not explicitly stated.
- **`tone`**: e.g., `"professional"`, `"technical"`, `"executive"`, `"casual"`. Infer from context if not specified.
- **`pageCount`**: 8–12 slides for focused decks; 15–20 for comprehensive overviews. Only override the default if the user specifies or the scope clearly warrants it.
- **`theme`**: Match to context:
  - `default`, `simple`, `ivory` — general purpose, clean
  - `cyber`, `blueprint` — technical / engineering topics
  - `obsidian`, `noir`, `editorial` — executive / premium feel
  - `amber`, `tropical-night`, `calm` — creative / lighter topics
  - `artemis` — data-heavy presentations
- **`deepResearch`**: Only enable if the topic requires external research and the user can wait 3–5+ minutes. Adds significant generation time.
- **`model`**: Leave as default (`claude-sonnet-4-5-20250929`) unless the user has a preference. Options: `gpt-5.5`, `gpt-5.4`, `gpt-5-mini`, `claude-opus-4-5-20251101`, `claude-haiku-4-5-20251001`, `gemini-2.5-pro`, `gemini-2.5-flash`.

### What Encelade produces

Every deck contains native interactive layers — charts with editable data, architecture diagrams, network graphs, maps, timelines, and 3D elements. Output is a shareable link; no install required for viewers. Charts are live and editable, not static images.

### Example prompts

- "Create a technical architecture overview for our new API"
- "Turn this Q3 data into an executive summary deck"
- "Generate a weekly engineering update from these sprint notes"
- "Build a product launch presentation for a developer audience"
- "Make a 10-slide pitch on the future of AI agents for VCs"
- "Plan a presentation structure before I commit to generating it"
