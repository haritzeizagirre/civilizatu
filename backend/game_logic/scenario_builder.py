"""Scenario / new-game builder: generates the initial GameState from a scenario document."""
from __future__ import annotations
import random
import uuid
from models.game_models import (
    GameState, PlayerState, MapData, Tile, TileType, City, Unit,
    UnitType, Building, BuildingType, Resources, ResourceType, Position
)
from game_logic.civilizations import CIVILIZATIONS, DEFAULT_PLAYER_CIV, DEFAULT_AI_CIV


# Zone probability per tile type
TILE_WEIGHTS = [
    (TileType.PLAINS,    35),
    (TileType.FOREST,    20),
    (TileType.HILLS,     15),
    (TileType.MOUNTAINS, 10),
    (TileType.OCEAN,     5),
    (TileType.DESERT,    8),
    (TileType.TUNDRA,    5),
    (TileType.RIVER,     2),
]

RESOURCE_WEIGHTS = [
    (ResourceType.IRON,        20),
    (ResourceType.CATTLE,      25),
    (ResourceType.LUXURY_SILK, 10),
    (ResourceType.WHEAT,       30),
    (ResourceType.COAL,        10),
    (ResourceType.OIL,         5),
]


def _weighted_choice(weights: list[tuple]) -> any:
    population, weights_list = zip(*weights)
    return random.choices(population, weights=weights_list, k=1)[0]


def build_initial_state(scenario: dict, player_civ_id: str = DEFAULT_PLAYER_CIV) -> GameState:
    w = scenario.get("map_width", 50)
    h = scenario.get("map_height", 50)
    rng = random.Random(scenario.get("seed", 42))

    tiles: list[Tile] = []
    for y in range(h):
        for x in range(w):
            tile_type = _weighted_choice(TILE_WEIGHTS)
            resource = None
            # ~20% chance of resource on non-mountain/ocean
            if tile_type not in (TileType.MOUNTAINS, TileType.OCEAN) and rng.random() < 0.20:
                resource = _weighted_choice(RESOURCE_WEIGHTS)
            has_ruins = rng.random() < 0.02
            has_barbarian = rng.random() < 0.03
            tiles.append(Tile(
                x=x, y=y, tile_type=tile_type,
                resource=resource, has_ruins=has_ruins,
                has_barbarian_camp=has_barbarian,
            ))

    # Build fog-of-war grid (all unexplored initially)
    fog_of_war = [[False] * w for _ in range(h)]

    game_map = MapData(width=w, height=h, tiles=tiles, fog_of_war=fog_of_war)

    # ─── Player starting state ───────────────────────────────────────────────
    player_civ = CIVILIZATIONS.get(player_civ_id, CIVILIZATIONS[DEFAULT_PLAYER_CIV])
    ai_civ = CIVILIZATIONS[DEFAULT_AI_CIV]

    player_start = Position(x=5, y=5)
    ai_start = Position(x=w - 6, y=h - 6)

    def make_capital(owner: str, pos: Position, civ_id: str) -> City:
        civ_names = {"aztec": "Tenochtitlan", "rome": "Roma"}
        return City(
            id=f"city_{str(uuid.uuid4())[:8]}",
            name=civ_names.get(civ_id, "Capital"),
            owner=owner,
            position=pos,
            population=2,
            buildings=[Building(building_type=BuildingType.PALACE)],
        )

    def make_warrior(owner: str, pos: Position) -> Unit:
        return Unit(
            id=f"unit_{str(uuid.uuid4())[:8]}",
            unit_type=UnitType.WARRIOR,
            owner=owner,
            position=pos,
            movement_points=2,
            movement_points_left=2,
            strength=10,
            health=100,
        )

    def make_settler(owner: str, pos: Position) -> Unit:
        return Unit(
            id=f"unit_{str(uuid.uuid4())[:8]}",
            unit_type=UnitType.SETTLER,
            owner=owner,
            position=pos,
            movement_points=2,
            movement_points_left=2,
            strength=3,
            health=60,
        )

    player_state = PlayerState(
        civ_id=player_civ_id,
        resources=Resources(food=20, production=10, science=5, gold=50),
        cities=[make_capital("player", player_start, player_civ_id)],
        units=[make_warrior("player", Position(x=6, y=5)), make_settler("player", Position(x=5, y=6))],
        researched_techs=list(player_civ.starting_techs),
    )

    ai_state = PlayerState(
        civ_id=DEFAULT_AI_CIV,
        resources=Resources(food=20, production=10, science=5, gold=50),
        cities=[make_capital("ai", ai_start, DEFAULT_AI_CIV)],
        units=[make_warrior("ai", Position(x=ai_start.x - 1, y=ai_start.y)), make_settler("ai", Position(x=ai_start.x, y=ai_start.y + 1))],
        researched_techs=list(ai_civ.starting_techs),
    )

    # Mark starting tiles as owned
    for tile in tiles:
        if tile.x == player_start.x and tile.y == player_start.y:
            tile.owner = "player"
        if tile.x == ai_start.x and tile.y == ai_start.y:
            tile.owner = "ai"

    state = GameState(
        turn=1,
        player=player_state,
        ai=ai_state,
        map=game_map,
    )

    # Apply initial fog of war
    from game_logic.fog import update_fog_of_war
    state = update_fog_of_war(state)

    return state
