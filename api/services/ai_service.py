"""
services/ai_service.py — AI parsing layer for AI Project Pulse (Gemini API).

Public interface:
- parse_update(raw_text) -> dict | None
- compare_blocker_to_existing(new_blocker, open_blockers) -> tuple[bool, int | None, str]
- generate_digest(updates, blockers, project_name, date) -> tuple[dict | None, str]
"""

import json
import os
import re
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

MODEL = "models/gemini-3.5-flash-lite"

_model: genai.GenerativeModel | None = None


def _get_model() -> genai.GenerativeModel:
    global _model
    if _model is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. "
                "Get a free key at https://aistudio.google.com/app/apikey "
                "and add it to backend/.env"
            )
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel(
            model_name=MODEL,
            system_instruction=PARSE_UPDATE_SYSTEM,
        )
    return _model


# ── System prompt ───────────────────────────────────────────────────────────

PARSE_UPDATE_SYSTEM = """\
You are a project-status parser embedded in a standup tool.

Your job: read a team member's daily standup update and extract structured data.

Return ONLY a single JSON object — no prose, no explanation, no markdown fences,
no trailing text. The object must conform exactly to this schema:

{
  "task": "<one concise sentence describing what the person is working on>",
  "blocker": {
    "present": <true or false>,
    "type": <"waiting-on-person" | "waiting-on-decision" | "technical" | "other" | null>,
    "description": <"brief description of the blocker" | null>
  }
}

Classification rules:
- "waiting-on-person"   → blocked because a specific person/team hasn't responded or delivered
- "waiting-on-decision" → blocked because a decision, approval, or sign-off is pending
- "technical"           → blocked by a bug, outage, missing access, broken tooling, or tech debt
- "other"               → a genuine blocker that doesn't fit the above categories

If there is no blocker, set present=false, type=null, description=null.
If a blocker is implied but not explicit (e.g. "might need to sync at some point"),
prefer present=false unless there is a clear impediment to forward progress.

Output the JSON object and nothing else.\
"""

PARSE_UPDATE_RETRY_SUFFIX = (
    "\n\n[IMPORTANT] Your previous response could not be parsed as JSON. "
    "Reply with ONLY the raw JSON object. No prose. No markdown. No code fences. "
    "Start your response with '{' and end it with '}'."
)

# ── Generation config — deterministic, short output ─────────────────────────

_GEN_CONFIG = genai.types.GenerationConfig(
    temperature=0.0,
    max_output_tokens=512,
)


# ── Public API ──────────────────────────────────────────────────────────────

def parse_update(raw_text: str) -> dict | None:
    """
    Send a standup update to Gemini and return the parsed JSON dict.

    Returns a dict matching the schema above, or None on total failure.
    Retries once with a stricter reminder, then gives up gracefully.
    """
    result = _call_parse(raw_text, retry=False)
    if result is not None:
        return result

    # First attempt failed — retry with stricter reminder
    result = _call_parse(raw_text, retry=True)
    return result


# ── Private helpers ─────────────────────────────────────────────────────────

def _call_parse(raw_text: str, retry: bool) -> dict | None:
    user_content = raw_text
    if retry:
        user_content += PARSE_UPDATE_RETRY_SUFFIX

    try:
        response = _get_model().generate_content(
            user_content,
            generation_config=_GEN_CONFIG,
        )
        response_text = response.text.strip()
        return _extract_json(response_text)
    except Exception as exc:
        label = "retry" if retry else "attempt-1"
        print(f"[gemini] parse_update {label} failed: {type(exc).__name__}: {exc}")
        return None


def _extract_json(text: str) -> dict | None:
    """
    Parse JSON from Gemini's response.
    Handles stray prose, markdown fences, and partial wrapping.
    """
    # Happy path: entire response is valid JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown fences if the model added them despite instructions
    stripped = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    stripped = re.sub(r"\s*```$", "", stripped).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Extract the first {...} block
    match = re.search(r"\{.*\}", stripped, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return None


# ── Blocker deduplication ───────────────────────────────────────────────────

DEDUP_SYSTEM = """\
You are a blocker deduplication assistant for a software team standup tool.

Your job: decide whether a newly reported blocker is the SAME underlying
impediment as one of the existing open blockers listed below.

Same = same root cause or waiting dependency, even if:
- Worded differently ("finance hasn't sent keys" vs "still waiting on finance for keys")
- Reported by a different person
- Phrased more or less urgently

Different = genuinely separate issues, even if related (e.g. two different
missing credentials from two different vendors are NOT the same blocker).

Return ONLY a JSON object — no prose, no markdown, no code fences:
{
  "match_found": <true or false>,
  "matched_id": <integer id of the matching blocker, or null>,
  "reasoning": "<one concise sentence>"
}\
"""

DEDUP_RETRY_SUFFIX = (
    "\n\n[IMPORTANT] Your previous response was not valid JSON. "
    "Reply with ONLY the JSON object starting with '{' and ending with '}'."
)


def compare_blocker_to_existing(
    new_description: str,
    existing_blockers: list[dict],  # [{"id": int, "description": str}, ...]
) -> dict | None:
    """
    Ask Gemini whether new_description matches any blocker in existing_blockers.

    Returns:
        {"match_found": bool, "matched_id": int|None, "reasoning": str}
        or None on total failure (caller treats as no match).
    """
    if not existing_blockers:
        return {"match_found": False, "matched_id": None, "reasoning": "No existing blockers."}

    existing_lines = "\n".join(
        f'{i+1}. (id={b["id"]}) "{b["description"]}"'
        for i, b in enumerate(existing_blockers)
    )

    user_msg = (
        f'New blocker:\n"{new_description}"\n\n'
        f"Existing open blockers:\n{existing_lines}"
    )

    # Attempt 1
    result = _call_dedup(user_msg, retry=False)
    if result is not None:
        return result

    # Retry with stricter suffix
    result = _call_dedup(user_msg + DEDUP_RETRY_SUFFIX, retry=True)
    return result  # None means caller treats as no match


def _call_dedup(user_msg: str, retry: bool) -> dict | None:
    try:
        dedup_model = genai.GenerativeModel(
            model_name=MODEL,
            system_instruction=DEDUP_SYSTEM,
        )
        response = dedup_model.generate_content(
            user_msg,
            generation_config=_GEN_CONFIG,
        )
        return _extract_json(response.text.strip())
    except Exception as exc:
        label = "retry" if retry else "attempt-1"
        print(f"[gemini] compare_blocker {label} failed: {type(exc).__name__}: {exc}")
        return None


# ── Digest generation ───────────────────────────────────────────────────────

DIGEST_SYSTEM = """\
You are a project health analyst generating a concise daily digest for an
engineering manager.

You will receive:
- A project name and date
- Each team member's standup summary for the day (what they worked on, any blocker)
- A list of currently open blockers with how many consecutive days they have
  been reported (days_recurring)

Return ONLY a single JSON object — no prose, no markdown fences, no code blocks:
{
  "summary": "<2-4 sentences synthesising what the team accomplished today.
               Write as a narrative paragraph, NOT a bullet list.
               Focus on progress and momentum; mention blockers only if they
               are materially slowing the team down.>",
  "flagged_risks": [
    {
      "blocker_id": <integer — must match an id from the blockers list>,
      "description": "<one sentence restating the blocker clearly>",
      "days_recurring": <integer>,
      "suggested_action": "<EXACTLY one sentence naming a specific role/person
                           AND a specific action AND why the usual approach has
                           not worked. See examples below.>"
    }
  ]
}

Rules for flagged_risks:
- ONLY include blockers where days_recurring >= 2. Day-1 blockers are normal
  noise; do NOT flag them.
- flagged_risks may be an empty list [] if no blockers qualify.
- If flagged_risks is empty, summary should still reflect the day's work.

Rules for suggested_action — this is the most important field:
- BAD (too vague):  "Follow up with the finance team."
- BAD (too vague):  "Escalate this blocker."
- BAD (too vague):  "The manager should check in soon."
- GOOD: "Engineering lead should call the finance team lead directly on Slack or
         phone today — two days of async messages have not produced a response."
- GOOD: "Product manager should make the pending design decision in the sprint
         planning meeting tomorrow, as the team cannot begin implementation
         without a direction."
- GOOD: "DevOps on-call should roll back the Gradle upgrade on the CI agent
         today; it has blocked all Android merges for two days and the fix is
         low-risk."

The suggested_action must answer: WHO does WHAT, through WHICH channel or
mechanism, and WHY the current approach is insufficient.\
"""

DIGEST_RETRY_SUFFIX = (
    "\n\n[IMPORTANT] Your previous response was not valid JSON. "
    "Reply with ONLY the raw JSON object. Start with '{' and end with '}'."
)


def generate_digest(
    project_name: str,
    date_str: str,
    updates: list[dict],      # [{user_name, task, blocker_present, blocker_description}]
    open_blockers: list[dict], # [{id, description, type, days_recurring, first_seen_date}]
) -> tuple[dict | None, str]:
    """
    Generate a manager digest via Gemini.

    Returns (result_dict, prompt_sent) so callers can log/display the exact prompt.
    result_dict matches the JSON schema above, or None on total failure.
    """
    prompt = _build_digest_prompt(project_name, date_str, updates, open_blockers)

    result = _call_digest(prompt, retry=False)
    if result is not None:
        return result, prompt

    result = _call_digest(prompt + DIGEST_RETRY_SUFFIX, retry=True)
    return result, prompt


def _build_digest_prompt(
    project_name: str,
    date_str: str,
    updates: list[dict],
    open_blockers: list[dict],
) -> str:
    """Build the user-turn message that gets sent alongside DIGEST_SYSTEM."""
    lines = [
        f"Project: {project_name}",
        f"Date: {date_str}",
        "",
        "== Today's standup updates ==",
    ]

    if not updates:
        lines.append("(No updates submitted today.)")
    else:
        for u in updates:
            lines.append(f"\n{u['user_name']}:")
            lines.append(f"  Task: {u['task']}")
            if u.get("blocker_present"):
                lines.append(f"  Blocker: {u['blocker_description']}")
            else:
                lines.append("  Blocker: none")

    lines += [
        "",
        "== All open blockers (all days, not just today) ==",
    ]

    if not open_blockers:
        lines.append("(No open blockers.)")
    else:
        for b in open_blockers:
            escalated = " [ESCALATED]" if b["days_recurring"] >= 2 else ""
            lines.append(
                f"  id={b['id']} | type={b['type']} | days_recurring={b['days_recurring']}{escalated}"
                f"\n    Description: {b['description']}"
                f"\n    First seen: {b['first_seen_date']}"
            )

    lines += [
        "",
        "Generate the digest JSON now. Remember: only flag blockers with days_recurring >= 2.",
    ]

    return "\n".join(lines)


def _call_digest(prompt: str, retry: bool) -> dict | None:
    try:
        digest_model = genai.GenerativeModel(
            model_name=MODEL,
            system_instruction=DIGEST_SYSTEM,
        )
        response = digest_model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,   # slight warmth for natural prose in summary
                max_output_tokens=1024,
            ),
        )
        return _extract_json(response.text.strip())
    except Exception as exc:
        label = "retry" if retry else "attempt-1"
        print(f"[gemini] generate_digest {label} failed: {type(exc).__name__}: {exc}")
        return None
