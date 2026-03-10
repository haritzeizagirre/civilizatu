"""Builds the GroQ prompt from game state JSON."""
import json

SYSTEM_PROMPT = """You are an AI playing CIVilizaTu (Civilization-like game). Expand your empire and defeat the human.
Rules: only act on owner=ai units/cities; movement distance=1; impassable: ocean/mountains; end turn with endTurn.
Respond with valid JSON only, no markdown."""


def _slim_state(game_state: dict) -> dict:
    """Return a compact AI-relevant slice of the game state."""
    ai = game_state.get("ai", {})
    player = game_state.get("player", {})

    # Only the tiles visible to AI (non-fog) and near AI units/cities — cap at 60
    tiles = game_state.get("map", {}).get("tiles", [])
    ai_positions = set()
    for u in ai.get("units", []):
        p = u.get("position", {})
        ai_positions.add((p.get("x", 0), p.get("y", 0)))
    for c in ai.get("cities", []):
        p = c.get("position", {})
        ai_positions.add((p.get("x", 0), p.get("y", 0)))

    def near_ai(t):
        tx, ty = t.get("x", 0), t.get("y", 0)
        return any(abs(tx - px) + abs(ty - py) <= 4 for px, py in ai_positions)

    nearby = [t for t in tiles if near_ai(t)][:60]
    if len(nearby) < 20:
        nearby = tiles[:60]  # fallback if no AI units yet

    # Strip heavy player data — only expose position & unit IDs (for attack targeting)
    player_units_slim = [
        {"id": u.get("id"), "position": u.get("position"), "health": u.get("health"), "unit_type": u.get("unit_type")}
        for u in player.get("units", [])
    ]
    player_cities_slim = [
        {"id": c.get("id"), "position": c.get("position"), "name": c.get("name")}
        for c in player.get("cities", [])
    ]

    return {
        "turn": game_state.get("turn"),
        "current_player": game_state.get("current_player"),
        "ai": ai,
        "player_units": player_units_slim,
        "player_cities": player_cities_slim,
        "map_tiles": nearby,
    }


def build_messages(game_state: dict) -> list[dict]:
    slim = _slim_state(game_state)
    state_json = json.dumps(slim, separators=(",", ":"), default=str)

    user_content = (
        f"Game state:{state_json}\n\n"
        "Respond ONLY with JSON:\n"
        '{"actions":['
        '{"type":"moveUnit","details":{"unitId":"u1","destination":{"x":3,"y":4}}},'
        '{"type":"buildStructure","details":{"cityId":"c1","structureType":"granary"}},'
        '{"type":"trainUnit","details":{"cityId":"c1","unitType":"warrior"}},'
        '{"type":"researchTechnology","details":{"techId":"agriculture"}},'
        '{"type":"attackEnemy","details":{"attackerUnitId":"u1","defenderUnitId":"u2"}},'
        '{"type":"endTurn"}],'
        '"reasoning":"short","analysis":"short"}\n'
        "Valid structureTypes: granary,library,barracks,market,temple,forge,workshop,aqueduct,colosseum,university,factory,power_plant\n"
        "Valid unitTypes: warrior,archer,knight,settler,eagle_warrior,legion,tank"
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
