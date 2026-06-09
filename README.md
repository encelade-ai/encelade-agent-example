# Encelade Agent Example

A working example of generating presentations from an AI agent's output via the **Encelade presentation generation API** (REST), with runnable agents in both **Python** and **TypeScript**. It hands a messy blob of research notes to Encelade and gets back a polished, interactive web deck — the same flow any agent or backend can use to produce slides programmatically.

## What is Encelade?

Encelade is a presentation generation platform that turns prompts, research, and AI agent output into interactive, shareable decks (slides). This repo is a minimal, end-to-end example of calling its public REST API so an agent — or any backend — can generate slides programmatically.

## Prerequisites

- An Encelade API key. Sign up at [encelade.ai](https://www.encelade.ai).
- Python 3.8+ or Node 18+.

The scripts read `ENCELADE_API_KEY` from your shell environment. `.env.example` is included as a convenience template for storing the value locally.

## Setup and run (Python)

```bash
cd python
pip install -r requirements.txt
cp ../.env.example ../.env  # then edit ../.env
export ENCELADE_API_KEY=your_api_key_here
python agent.py
```

## Setup and run (TypeScript)

```bash
cd typescript
npm install
export ENCELADE_API_KEY=your_api_key_here
npm start
```

## The mock data

The hardcoded NovaTech notes are intentionally messy: scraped-looking fragments, conflicting market estimates, half-sentences, funding notes, competitor names, customer anecdotes, and an unfinished TODO. The point is to show the kind of unstructured research an upstream agent might dump into Slack, and how Encelade can turn that blob into a polished interactive deck.

## How it works

The agent runs a three-step REST workflow against the Encelade presentation generation API.

1. **Send the research.** `POST /api/public/v1/projects/generate` with your API key in the `x-api-key` header, passing the topic, outline hints, and raw notes as supporting material:

   ```json
   {
     "topic": "NovaTech investor update",
     "outlineHints": [
       "Company snapshot and mission",
       "Traction and key metrics",
       "Funding history and the ask"
     ],
     "supportingMaterials": [
       {
         "title": "NovaTech raw research notes",
         "notes": "ARR $2.4M (Q3), founders ex-Stripe + ex-Palantir, ..."
       }
     ],
     "verbosity": "balanced",
     "pageCount": "auto"
   }
   ```

   The response returns a session id:

   ```json
   { "sessionId": "sess_..." }
   ```

2. **Poll for completion.** `GET /api/public/v1/sessions/{sessionId}` every 3 seconds until `status` is `succeeded` (or `failed`). The example scripts also fall back to the older `/api/public/v1/projects/generate/session/{sessionId}` path if needed.

3. **Open the deck.** Read `link` from the succeeded session response. (`shareLink` is also returned when the project has a share token and an end-user email — the example request above doesn't set one, so use `link`.)

   ```json
   { "status": "succeeded", "link": "https://app.encelade.ai/p/..." }
   ```

The output is an **interactive, shareable web deck** — open the `link` URL to view or share it; there's no file to download or render.

## Claude Code skill

A ready-to-use Claude Code skill that teaches Claude when and how to drive Encelade via this API. Drop it into your Claude Code skills directory or reference it from a custom agent.

- [skills/encelade-agent-skill.md](skills/encelade-agent-skill.md)

## Related

- [Encelade for Agents](https://www.encelade.ai/agents) — generate presentations from AI agents and MCP clients.
- [Encelade API docs](https://www.encelade.ai/docs) — full REST reference for the public API.
- [n8n-nodes-encelade](https://github.com/encelade-ai/n8n-nodes-encelade) — community n8n node that calls the same Encelade presentation API for no-code workflows.
- Sign up for an API key: [encelade.ai](https://www.encelade.ai)
