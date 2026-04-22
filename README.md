# Encelade Agent Example

See how an AI agent hands off research to Encelade and gets back an interactive deck.

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

1. Send data: `POST /api/public/v1/projects/generate` with the research blob, topic, and outline hints.
2. Poll for completion: `GET /api/public/v1/sessions/{sessionId}` every 3 seconds until the session completes or fails. The example scripts also fall back to the older `/api/public/v1/projects/generate/session/{sessionId}` path if needed.
3. Get deck link: read `shareLink` or `link` from the session response and open the interactive deck.

## Links

- API docs: [encelade.ai/docs](https://www.encelade.ai/docs)
- Sign up: [encelade.ai](https://www.encelade.ai)
- For Agents: [encelade.ai/agents](https://www.encelade.ai/agents)
