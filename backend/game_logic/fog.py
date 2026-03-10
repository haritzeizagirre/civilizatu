"""Fog of War: determine which tiles are visible to a player."""
from models.game_models import GameState, PlayerState
from game_logic.resources import hex_distance

# Vision radii
UNIT_VISION = 2
CITY_VISION = 3


def compute_visible_tiles(state: GameState, owner: str) -> set[tuple[int, int]]:
    """Return the set of (x, y) positions currently visible to `owner`."""
    pstate: PlayerState = getattr(state, owner)
    visible: set[tuple[int, int]] = set()

    for unit in pstate.units:
        for tile in state.map.tiles:
            if hex_distance(tile.x, unit.position.x, tile.y, unit.position.y) <= UNIT_VISION:
                visible.add((tile.x, tile.y))

    for city in pstate.cities:
        for tile in state.map.tiles:
            if hex_distance(tile.x, city.position.x, tile.y, city.position.y) <= CITY_VISION:
                visible.add((tile.x, tile.y))

    return visible


def update_fog_of_war(state: GameState) -> GameState:
    """Mark all currently-visible tiles as explored in fog_of_war array."""
    visible = compute_visible_tiles(state, "player")
    for x, y in visible:
        if 0 <= y < len(state.map.fog_of_war) and 0 <= x < len(state.map.fog_of_war[y]):
            state.map.fog_of_war[y][x] = True
    return state


def filter_ai_state_for_player(state: GameState) -> dict:
    """
    Return AI state filtered to only what the player can see (for fog-of-war).
    Used when sending game state to the frontend.
    """
    visible = compute_visible_tiles(state, "player")
    ai_cities = []
    for city in state.ai.cities:
        if (city.position.x, city.position.y) in visible:
            ai_cities.append(city.model_dump())
        else:
            ai_cities.append({
                "id": city.id,
                "name": "???",
                "position": city.position.model_dump(),
                "visible": False,
            })

    ai_units = [
        u.model_dump() for u in state.ai.units
        if (u.position.x, u.position.y) in visible
    ]

    return {
        "civ_id": state.ai.civ_id,
        "cities": ai_cities,
        "units": ai_units,
        "diplomacy_status": state.ai.diplomacy_status,
        # Resources are hidden to player
    }
