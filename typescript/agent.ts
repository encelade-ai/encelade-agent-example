const BASE_URL = "https://www.encelade.ai/api/public/v1";
const POLL_INTERVAL_MS = 3_000;
const MAX_WAIT_MS = 600_000;
const REQUEST_TIMEOUT_MS = 60_000;

const MOCK_RESEARCH = `NovaTech - quick notes, do not ship

ARR: $2.4M (Q3), up from 780K, burn ~ 310k/mo, team size 14 (was 9 in Jan)
founders ex-Stripe + ex-Palantir, met at...
TAM somewhere between 8B and 22B depending on who you ask (Gartner vs internal)
vs. Lattice, Rippling, some new YC co "Framepoint"?
Seed 4.2M led by Accel, bridge 1.1M from existing, Series A rumored Q2
signed Brex pilot (!!), lost Notion in POC, Ramp expansion doubled seats
pivot from "HRIS" framing to "workforce graph" is working - outbound reply rate 2.3x since message change
need to confirm headcount number w/ Ana before Monday
`;

const OUTLINE_HINTS = [
  "Company snapshot and mission",
  "Traction and key metrics",
  "Market opportunity and positioning",
  "Competitive landscape",
  "Funding history and the ask",
  "Team and what's next",
];
const SUPPORTING_MATERIAL_TITLE = "NovaTech raw research notes";

const SUCCESS_STATUSES = new Set(["completed", "succeeded"]);
const FAILURE_STATUSES = new Set(["failed", "canceled", "cancelled"]);

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

type GenerateResponse = {
  sessionId?: string;
  status?: string;
};

type SessionEvent = {
  type?: string;
  message?: string;
};

type SessionResponse = {
  status?: string;
  shareLink?: string;
  link?: string;
  url?: string;
  projectPid?: string;
  error?: string;
  message?: string;
  events?: SessionEvent[];
};

function buildPayload(): JsonObject {
  return {
    topic: "NovaTech investor update",
    outlineHints: OUTLINE_HINTS,
    supportingMaterials: [
      {
        title: SUPPORTING_MATERIAL_TITLE,
        notes: MOCK_RESEARCH,
      },
    ],
    verbosity: "balanced",
    pageCount: "auto",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function exitWithError(message: string): never {
  console.error(`[x] ${message}`);
  process.exit(1);
}

function describeFailure(
  payload: JsonValue | undefined,
  fallback: string,
): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    for (const key of ["error", "message", "detail"]) {
      const value = payload[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return fallback;
}

async function requestJson<T extends JsonObject>(
  method: "GET" | "POST",
  url: string,
  apiKey: string,
  body?: JsonObject,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const rawText = await response.text();
    let payload: JsonValue | undefined;

    if (rawText.trim()) {
      try {
        payload = JSON.parse(rawText) as JsonValue;
      } catch (error) {
        throw new Error(
          `Expected JSON from ${method} ${url}, got: ${rawText.slice(0, 200)}`,
        );
      }
    }

    if (!response.ok) {
      const detail = describeFailure(
        payload,
        rawText.trim() || `HTTP ${response.status}`,
      );
      throw new Error(
        `${method} ${url} failed (${response.status}): ${detail}`,
      );
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(`Expected JSON object from ${method} ${url}.`);
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function generate(apiKey: string): Promise<string> {
  const response = await requestJson<GenerateResponse>(
    "POST",
    `${BASE_URL}/projects/generate`,
    apiKey,
    buildPayload(),
  );
  const sessionId = response.sessionId;
  if (!sessionId) {
    throw new Error(
      "POST /projects/generate succeeded but did not return a sessionId.",
    );
  }
  return sessionId;
}

async function fetchSession(
  apiKey: string,
  sessionId: string,
): Promise<SessionResponse> {
  const currentUrl = `${BASE_URL}/sessions/${sessionId}`;
  const legacyUrl = `${BASE_URL}/projects/generate/session/${sessionId}`;

  try {
    return await requestJson<SessionResponse>("GET", currentUrl, apiKey);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("(404)")) {
      throw error;
    }
    return requestJson<SessionResponse>("GET", legacyUrl, apiKey);
  }
}

function extractFailureMessage(session: SessionResponse): string {
  for (const key of ["error", "message"] as const) {
    const value = session[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  if (Array.isArray(session.events)) {
    for (const event of [...session.events].reverse()) {
      for (const key of ["message", "type"] as const) {
        const value = event[key];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
    }
  }

  return "Generation failed without an error message.";
}

function extractDeckUrl(session: SessionResponse): string | null {
  for (const key of ["shareLink", "link", "url"] as const) {
    const value = session[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  if (typeof session.projectPid === "string" && session.projectPid.trim()) {
    return `https://app.encelade.ai/p/${session.projectPid.trim()}`;
  }

  return null;
}

async function pollUntilDone(
  apiKey: string,
  sessionId: string,
): Promise<string> {
  const startTime = Date.now();

  while (true) {
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs >= MAX_WAIT_MS) {
      throw new Error("Timed out after 600 seconds waiting for the deck.");
    }

    await sleep(POLL_INTERVAL_MS);

    const session = await fetchSession(apiKey, sessionId);
    const elapsedNow = Date.now() - startTime;
    const status = session.status ?? "unknown";
    console.log(`  [${formatElapsed(elapsedNow)}] status=${status}`);

    const normalizedStatus = status.toLowerCase();
    if (SUCCESS_STATUSES.has(normalizedStatus)) {
      const deckUrl = extractDeckUrl(session);
      if (!deckUrl) {
        throw new Error(
          "Generation completed but no deck link was returned in the session payload.",
        );
      }
      return deckUrl;
    }

    if (FAILURE_STATUSES.has(normalizedStatus)) {
      throw new Error(extractFailureMessage(session));
    }
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.ENCELADE_API_KEY;
  if (!apiKey) {
    exitWithError(
      "Missing ENCELADE_API_KEY. Export it in your shell and try again.",
    );
  }

  console.log("-> Packaging research notes about NovaTech...");
  console.log("-> Sending to Encelade (POST /projects/generate)...");

  const sessionId = await generate(apiKey);
  console.log(`[ok] Session started: ${sessionId}`);
  console.log("-> Polling for completion (up to 10 min)...");

  const deckUrl = await pollUntilDone(apiKey, sessionId);
  console.log(`[ok] Deck ready: ${deckUrl}`);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    exitWithError(error.message);
  }

  exitWithError(String(error));
});
