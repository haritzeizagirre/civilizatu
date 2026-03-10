"""Parse and validate AI response JSON."""
import json
import re
import logging

logger = logging.getLogger(__name__)

VALID_ACTION_TYPES = {
    "moveUnit", "attackEnemy", "buildStructure",
    "trainUnit", "researchTechnology", "foundCity",
    "improveResource", "endTurn",
}


def parse_response(raw: str) -> dict:
    """Extract JSON from raw LLM response, validate schema, return cleaned dict."""
    # Strip any markdown code fences
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.warning("JSON parse error: %s\nRaw: %s", e, raw[:500])
        # Return a safe fallback: just end the turn
        return {"actions": [{"type": "endTurn"}], "reasoning": "Parse error", "analysis": ""}

    actions = data.get("actions", [])
    valid_actions = []
    has_end_turn = False

    for action in actions:
        atype = action.get("type", "")
        if atype not in VALID_ACTION_TYPES:
            logger.warning("Invalid action type ignored: %s", atype)
            continue
        if atype == "endTurn":
            has_end_turn = True
        valid_actions.append(action)

    if not has_end_turn:
        valid_actions.append({"type": "endTurn"})

    data["actions"] = valid_actions
    return data
