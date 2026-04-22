import os
import sys
import time
import warnings

warnings.filterwarnings(
    "ignore",
    message=r"urllib3 v2 only supports OpenSSL 1\.1\.1\+",
)

try:
    import requests
except ImportError:
    requests = None

BASE_URL = "https://www.encelade.ai/api/public/v1"
POLL_INTERVAL_SEC = 3
MAX_WAIT_SEC = 600
REQUEST_TIMEOUT_SEC = 60

MOCK_RESEARCH = """NovaTech - quick notes, do not ship

ARR: $2.4M (Q3), up from 780K, burn ~ 310k/mo, team size 14 (was 9 in Jan)
founders ex-Stripe + ex-Palantir, met at...
TAM somewhere between 8B and 22B depending on who you ask (Gartner vs internal)
vs. Lattice, Rippling, some new YC co "Framepoint"?
Seed 4.2M led by Accel, bridge 1.1M from existing, Series A rumored Q2
signed Brex pilot (!!), lost Notion in POC, Ramp expansion doubled seats
pivot from "HRIS" framing to "workforce graph" is working - outbound reply rate 2.3x since message change
need to confirm headcount number w/ Ana before Monday
"""

OUTLINE_HINTS = [
    "Company snapshot and mission",
    "Traction and key metrics",
    "Market opportunity and positioning",
    "Competitive landscape",
    "Funding history and the ask",
    "Team and what's next",
]
SUPPORTING_MATERIAL_TITLE = "NovaTech raw research notes"

SUCCESS_STATUSES = {"completed", "succeeded"}
FAILURE_STATUSES = {"failed", "canceled", "cancelled"}


def build_payload():
    return {
        "topic": "NovaTech investor update",
        "outlineHints": OUTLINE_HINTS,
        "supportingMaterials": [
            {
                "title": SUPPORTING_MATERIAL_TITLE,
                "notes": MOCK_RESEARCH,
            }
        ],
        "verbosity": "balanced",
        "pageCount": "auto",
    }


def exit_with_error(message):
    print(f"[x] {message}", file=sys.stderr)
    raise SystemExit(1)


def format_elapsed(seconds):
    minutes, remainder = divmod(seconds, 60)
    return f"{minutes:02d}:{remainder:02d}"


def parse_json(response):
    try:
        return response.json()
    except ValueError as exc:
        raise RuntimeError(
            f"Expected JSON from {response.request.method} {response.url}, got: {response.text[:200]}"
        ) from exc


def response_error_message(response, payload):
    if isinstance(payload, dict):
        for key in ("error", "message", "detail"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

    text = response.text.strip()
    if text:
        return text[:200]

    return f"HTTP {response.status_code}"


def request_json(method, url, api_key, *, json_body=None):
    if requests is None:
        raise RuntimeError(
            "Missing dependency: requests. Run `pip install -r requirements.txt` first."
        )

    response = requests.request(
        method,
        url,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
        },
        json=json_body,
        timeout=REQUEST_TIMEOUT_SEC,
    )
    payload = parse_json(response)

    if response.status_code >= 400:
        message = response_error_message(response, payload)
        raise RuntimeError(f"{method} {url} failed ({response.status_code}): {message}")

    return payload


def start_generation(api_key):
    payload = build_payload()
    response = request_json("POST", f"{BASE_URL}/projects/generate", api_key, json_body=payload)
    session_id = response.get("sessionId")
    if not isinstance(session_id, str) or not session_id.strip():
        raise RuntimeError("POST /projects/generate succeeded but did not return a sessionId.")
    return session_id.strip()


def fetch_session(api_key, session_id):
    current_url = f"{BASE_URL}/sessions/{session_id}"
    legacy_url = f"{BASE_URL}/projects/generate/session/{session_id}"

    try:
        return request_json("GET", current_url, api_key)
    except RuntimeError as exc:
        if "404" not in str(exc):
            raise
        return request_json("GET", legacy_url, api_key)


def extract_failure_message(session):
    for key in ("error", "message"):
        value = session.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    events = session.get("events")
    if isinstance(events, list):
        for event in reversed(events):
            if not isinstance(event, dict):
                continue
            for key in ("message", "type"):
                value = event.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()

    return "Generation failed without an error message."


def extract_deck_url(session):
    for key in ("shareLink", "link", "url"):
        value = session.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    project_pid = session.get("projectPid")
    if isinstance(project_pid, str) and project_pid.strip():
        return f"https://app.encelade.ai/p/{project_pid.strip()}"

    return None


def poll_until_done(api_key, session_id):
    start_time = time.monotonic()

    while True:
        elapsed = int(time.monotonic() - start_time)
        if elapsed >= MAX_WAIT_SEC:
            raise TimeoutError(
                f"Timed out after {MAX_WAIT_SEC} seconds waiting for the deck."
            )

        time.sleep(POLL_INTERVAL_SEC)
        elapsed = int(time.monotonic() - start_time)
        session = fetch_session(api_key, session_id)
        status = str(session.get("status", "unknown"))
        print(f"  [{format_elapsed(elapsed)}] status={status}")

        normalized_status = status.lower()
        if normalized_status in SUCCESS_STATUSES:
            deck_url = extract_deck_url(session)
            if not deck_url:
                raise RuntimeError(
                    "Generation completed but no deck link was returned in the session payload."
                )
            return deck_url

        if normalized_status in FAILURE_STATUSES:
            raise RuntimeError(extract_failure_message(session))


def main():
    api_key = os.environ.get("ENCELADE_API_KEY")
    if not api_key:
        exit_with_error(
            "Missing ENCELADE_API_KEY. Export it in your shell and try again."
        )

    if requests is None:
        exit_with_error(
            "Missing dependency: requests. Run `pip install -r requirements.txt` first."
        )

    print("-> Packaging research notes about NovaTech...")
    print("-> Sending to Encelade (POST /projects/generate)...")

    try:
        session_id = start_generation(api_key)
        print(f"[ok] Session started: {session_id}")
        print("-> Polling for completion (up to 10 min)...")
        deck_url = poll_until_done(api_key, session_id)
    except TimeoutError as exc:
        exit_with_error(str(exc))
    except requests.RequestException as exc:
        exit_with_error(f"Network request failed: {exc}")
    except Exception as exc:
        exit_with_error(str(exc))

    print(f"[ok] Deck ready: {deck_url}")


if __name__ == "__main__":
    main()
