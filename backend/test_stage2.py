"""
test_stage2.py — Sanity-check the POST /updates endpoint with 3 sample updates:
  1. Clear technical blocker
  2. No blocker
  3. Ambiguous / soft blocker

Run:  python test_stage2.py
Requires: server running on localhost:8000, ANTHROPIC_API_KEY set in .env
"""

import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"

SAMPLES = [
    {
        "label": "CLEAR BLOCKER (technical)",
        "payload": {
            "user_id":    1,       # Alice Chen — Project Alpha
            "project_id": 1,
            "raw_text": (
                "Did: Finished implementing the new onboarding carousel screens "
                "and hooked them up to the navigation stack.\n"
                "Next: Write unit tests for the carousel component.\n"
                "Blocking: The CI pipeline is broken — the Android build agent "
                "keeps failing with a Gradle version mismatch. I can't merge "
                "or run integration tests until DevOps fixes it."
            ),
        },
    },
    {
        "label": "NO BLOCKER",
        "payload": {
            "user_id":    2,       # Bob Patel — Project Alpha
            "project_id": 1,
            "raw_text": (
                "Did: Completed the dark-mode token audit across all 14 screen components.\n"
                "Next: Apply the corrected tokens to the Settings and Profile screens.\n"
                "Blocking: Nothing, good to go."
            ),
        },
    },
    {
        "label": "AMBIGUOUS (waiting-on-decision)",
        "payload": {
            "user_id":    3,       # Carol Nguyen — Project Beta
            "project_id": 2,
            "raw_text": (
                "Did: Drafted the rate-limiting strategy doc for the API gateway "
                "and shared it with the team for review.\n"
                "Next: Start implementing whichever strategy gets approved.\n"
                "Blocking: Not technically blocked, but I'm on hold until the "
                "team agrees on the throttle limits — could be a day or two."
            ),
        },
    },
]


def post(path: str, body: dict) -> tuple[int, dict]:
    data = json.dumps(body).encode()
    req  = urllib.request.Request(
        BASE + path,
        data    = data,
        headers = {"Content-Type": "application/json"},
        method  = "POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def fmt(d: dict) -> str:
    return json.dumps(d, indent=2)


for sample in SAMPLES:
    print("=" * 60)
    print(f"  {sample['label']}")
    print("=" * 60)
    print(f"\nINPUT raw_text:\n  {sample['payload']['raw_text'][:120]}...")
    print()

    status, resp = post("/updates/", sample["payload"])
    print(f"HTTP {status}")

    if status == 201:
        parsed = resp.get("parsed_json")
        parse_ok = resp.get("parse_ok")
        print(f"parse_ok : {parse_ok}")
        print(f"update_id: {resp['id']}")
        print(f"\nparsed_json:\n{fmt(parsed) if parsed else '  null (parse failed)'}")
    else:
        print(f"ERROR: {fmt(resp)}")
    print()
