"""Combat resolution for map-based battles."""
import random
from models.game_models import GameState, Unit, TileType
from game_logic.resources import hex_distance

# Terrain defense bonus (percentage multiplier on defender strength)
TERRAIN_DEFENSE: dict[TileType, float] = {
    TileType.PLAINS:    1.0,
    TileType.FOREST:    1.25,
    TileType.HILLS:     1.30,
    TileType.MOUNTAINS: 1.50,
    TileType.OCEAN:     1.0,
    TileType.DESERT:    1.0,
    TileType.TUNDRA:    1.05,
    TileType.RIVER:     1.10,
}

# Unit type combat matchups (attacker vs defender multiplier)
MATCHUP: dict[tuple[str, str], float] = {
    ("archer",  "warrior"):       1.25,
    ("archer",  "eagle_warrior"): 1.25,
    ("archer",  "legion"):        1.20,
    ("knight",  "warrior"):       1.30,
    ("knight",  "archer"):        1.10,
    ("warrior", "archer"):        1.15,
    ("tank",    "warrior"):       2.0,
    ("tank",    "archer"):        1.8,
    ("tank",    "knight"):        1.5,
    ("legion",  "warrior"):       1.1,
}


def get_tile(state: GameState, x: int, y: int):
    for tile in state.map.tiles:
        if tile.x == x and tile.y == y:
            return tile
    return None


def resolve_combat(state: GameState, attacker_owner: str, details: dict) -> tuple[GameState, dict]:
    attacker_id = details.get("attackerUnitId")
    defender_id = details.get("defenderUnitId")

    defender_owner = "ai" if attacker_owner == "player" else "player"
    attacker_pstate = getattr(state, attacker_owner)
    defender_pstate = getattr(state, defender_owner)

    attacker = next((u for u in attacker_pstate.units if u.id == attacker_id), None)
    defender = next((u for u in defender_pstate.units if u.id == defender_id), None)

    if attacker is None:
        return state, {"error": "Attacker unit not found"}
    if defender is None:
        return state, {"error": "Defender unit not found"}
    if attacker.has_attacked:
        return state, {"error": "Unit has already attacked this turn"}

    dist = hex_distance(attacker.position.x, defender.position.x,
                        attacker.position.y, defender.position.y)
    if dist > 1:
        return state, {"error": "Units not adjacent"}

    def_tile = get_tile(state, defender.position.x, defender.position.y)
    terrain_bonus = TERRAIN_DEFENSE.get(def_tile.tile_type if def_tile else TileType.PLAINS, 1.0)
    matchup_bonus = MATCHUP.get((attacker.unit_type.value, defender.unit_type.value), 1.0)

    # Combat formula: randomised damage in a range
    attacker_power = attacker.strength * matchup_bonus * (attacker.health / 100)
    defender_power = defender.strength * terrain_bonus * (defender.health / 100)

    rng = random.uniform(0.85, 1.15)
    attacker_damage = int((defender_power / max(attacker_power, 1)) * 30 * rng)
    defender_damage = int((attacker_power / max(defender_power, 1)) * 30 * rng)

    attacker.health -= attacker_damage
    defender.health -= defender_damage
    attacker.has_attacked = True
    attacker.movement_points_left = 0  # using attack costs all movement

    result = {
        "attacker": {"unit_id": attacker_id, "damage_taken": attacker_damage, "health_remaining": attacker.health},
        "defender": {"unit_id": defender_id, "damage_taken": defender_damage, "health_remaining": defender.health},
        "winner": None,
        "rewards": {},
    }

    # Handle deaths
    if defender.health <= 0:
        defender_pstate.units = [u for u in defender_pstate.units if u.id != defender_id]
        # Attacker captures tile
        tile = get_tile(state, defender.position.x, defender.position.y)
        if tile:
            tile.owner = attacker_owner
        result["winner"] = attacker_owner
        result["rewards"]["gold"] = 25

        # Check if captured a city
        for city in list(defender_pstate.cities):
            if city.position.x == defender.position.x and city.position.y == defender.position.y:
                city.owner = attacker_owner
                attacker_pstate.cities.append(city)
                defender_pstate.cities = [c for c in defender_pstate.cities if c.id != city.id]
                result["captured_city"] = city.id

        attacker_pstate.resources.gold += 25
        # Promotion chance
        attacker.promotions.append("veteran") if len(attacker.promotions) == 0 else None

    if attacker.health <= 0:
        attacker_pstate.units = [u for u in attacker_pstate.units if u.id != attacker_id]
        result["attacker_killed"] = True

    return state, result
