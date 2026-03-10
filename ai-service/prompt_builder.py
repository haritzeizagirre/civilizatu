"""Builds the GroQ prompt from game state JSON."""
import json

SYSTEM_PROMPT = """You are an AI agent playing a Civilization-inspired turn-based strategy game called CIVilizaTu.
Your goal is to expand your empire, manage resources, develop cities, research technologies, and defeat the human player.

RULES:
- You control units marked with owner="ai"
- You must only act on your own cities and units
- Movement: units can only move to adjacent tiles (distance 1); impassable tile types: ocean, mountains
- Cities can only build one structure at a time (production_queue)
- You MUST end your turn with an "endTurn" action
- Respect unit movement_points_left; a unit with 0 points cannot move or attack
- You can only research one technology at a time (current_research)

Always respond with valid JSON. No markdown fences, no explanation outside the JSON.
"""

def build_messages(game_state: dict) -> list[dict]:
    # Truncate the tile list to keep tokens low – only first 200 tiles + summary
    state_copy = game_state.copy()
    tiles = state_copy.get("map", {}).get("tiles", [])
    fog = state_copy.get("map", {}).get("fog_of_war", [])
    state_copy["map"] = {
        "width": state_copy.get("map", {}).get("width", 50),
        "height": state_copy.get("map", {}).get("height", 50),
        "tiles_sample": tiles[:150],  # send first 150 tiles to save tokens
        "total_tiles": len(tiles),
    }

    state_json = json.dumps(state_copy, indent=2, default=str)

    user_content = f"""Current game state:

<game_state>
{state_json}
</game_state>

Analyze the situation and decide your actions for this turn.
Respond ONLY with this JSON structure:
{{
  "actions": [
    {{"type": "moveUnit", "details": {{"unitId": "...", "destination": {{"x": 0, "y": 0}}}}}},
    {{"type": "buildStructure", "details": {{"cityId": "...", "structureType": "granary"}}}},
    {{"type": "trainUnit", "details": {{"cityId": "...", "unitType": "warrior"}}}},
    {{"type": "researchTechnology", "details": {{"techId": "..."}}}},
    {{"type": "attackEnemy", "details": {{"attackerUnitId": "...", "defenderUnitId": "..."}}}},
    {{"type": "endTurn"}}
  ],
  "reasoning": "Brief explanation of your strategy",
  "analysis": "Brief analysis of the current game situation"
}}

Valid structureTypes: granary, library, barracks, market, temple, forge
Valid unitTypes: warrior, archer, knight, settler, eagle_warrior, legion
"""
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
