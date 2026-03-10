"""Turn-based state machine and action resolution."""
from __future__ import annotations
import uuid
from typing import Any

from models.game_models import (
    GameState, Unit, City, UnitType, BuildingType,
    ProductionQueue, Building, TurnPhase, Position
)
from game_logic.resources import (
    apply_end_of_turn_resources, tick_production_queues,
    hex_distance, BUILDING_YIELDS
)
from game_logic.fog import update_fog_of_war
from game_logic.technology import TECH_TREE, get_available_techs
from game_logic.victory import check_victory

# ─── Unit stats ──────────────────────────────────────────────────────────────
UNIT_STATS: dict[str, dict] = {
    "warrior":       {"strength": 10, "health": 100, "movement": 2, "cost_turns": 4},
    "archer":        {"strength": 8,  "health": 80,  "movement": 2, "cost_turns": 5},
    "knight":        {"strength": 15, "health": 100, "movement": 3, "cost_turns": 7},
    "settler":       {"strength": 3,  "health": 60,  "movement": 2, "cost_turns": 6},
    "tank":          {"strength": 40, "health": 150, "movement": 3, "cost_turns": 12},
    "eagle_warrior": {"strength": 12, "health": 100, "movement": 2, "cost_turns": 5},
    "legion":        {"strength": 13, "health": 110, "movement": 2, "cost_turns": 5},
}

# ─── Building costs ──────────────────────────────────────────────────────────
BUILDING_COSTS: dict[BuildingType, int] = {
    BuildingType.GRANARY:  4,
    BuildingType.LIBRARY:  5,
    BuildingType.BARRACKS: 5,
    BuildingType.MARKET:   6,
    BuildingType.TEMPLE:   6,
    BuildingType.FORGE:    7,
    BuildingType.PALACE:   0,
}

# ─── Movement costs per tile type ────────────────────────────────────────────
from models.game_models import TileType

MOVEMENT_COSTS: dict[TileType, int] = {
    TileType.PLAINS:    1,
    TileType.FOREST:    2,
    TileType.HILLS:     2,
    TileType.MOUNTAINS: 3,
    TileType.OCEAN:     99,  # impassable
    TileType.DESERT:    1,
    TileType.TUNDRA:    1,
    TileType.RIVER:     1,
}


def get_tile(state: GameState, x: int, y: int):
    for tile in state.map.tiles:
        if tile.x == x and tile.y == y:
            return tile
    return None


def process_action(state: GameState, owner: str, action_type: str, details: dict[str, Any]) -> tuple[GameState, dict]:
    """Dispatch a player or AI action. Returns updated state and event dict."""
    handlers = {
        "moveUnit": _move_unit,
        "attackEnemy": _attack_enemy,
        "buildStructure": _build_structure,
        "trainUnit": _train_unit,
        "researchTechnology": _research_technology,
        "foundCity": _found_city,
        "improveResource": _improve_resource,
        "endTurn": _end_turn,
    }
    handler = handlers.get(action_type)
    if handler is None:
        return state, {"error": f"Unknown action: {action_type}"}
    return handler(state, owner, details)


# ─── Action implementations ──────────────────────────────────────────────────

def _move_unit(state: GameState, owner: str, details: dict) -> tuple[GameState, dict]:
    unit_id = details.get("unitId")
    dest = details.get("destination", {})
    dx, dy = dest.get("x"), dest.get("y")

    pstate = getattr(state, owner)
    unit = next((u for u in pstate.units if u.id == unit_id), None)
    if unit is None:
        return state, {"error": "Unit not found"}
    if unit.movement_points_left <= 0:
        return state, {"error": "No movement points remaining"}

    dest_tile = get_tile(state, dx, dy)
    if dest_tile is None:
        return state, {"error": "Invalid destination"}

    cost = MOVEMENT_COSTS.get(dest_tile.tile_type, 99)
    dist = hex_distance(dx, unit.position.x, dy, unit.position.y)
    if dist > 1:
        return state, {"error": "Can only move 1 tile at a time"}
    if cost > unit.movement_points_left:
        return state, {"error": "Not enough movement points"}

    # Check for ruins/barbarian on destination
    events: list[dict] = []
    if dest_tile.has_ruins:
        dest_tile.has_ruins = False
        pstate.resources.science += 30
        events.append({"type": "ruins_discovered", "bonus": "science+30"})

    old_pos = unit.position.model_dump()
    unit.position = Position(x=dx, y=dy)
    unit.movement_points_left -= cost
    dest_tile.owner = owner

    state = update_fog_of_war(state)
    return state, {"moved": unit_id, "from": old_pos, "to": {"x": dx, "y": dy}, "events": events}


def _attack_enemy(state: GameState, owner: str, details: dict) -> tuple[GameState, dict]:
    """Delegated to combat.py – imported lazily to avoid circular imports."""
    from game_logic.combat import resolve_combat
    return resolve_combat(state, owner, details)


def _build_structure(state: GameState, owner: str, details: dict) -> tuple[GameState, dict]:
    city_id = details.get("cityId")
    structure = details.get("structureType")
    try:
        btype = BuildingType(structure)
    except ValueError:
        return state, {"error": f"Unknown building: {structure}"}

    pstate = getattr(state, owner)
    city = next((c for c in pstate.cities if c.id == city_id), None)
    if city is None:
        return state, {"error": "City not found"}
    if any(b.building_type == btype for b in city.buildings):
        return state, {"error": "Building already exists"}
    if city.production_queue:
        return state, {"error": "Production queue already occupied"}

    turns = BUILDING_COSTS.get(btype, 5)
    city.production_queue = ProductionQueue(
        item_type=structure, is_unit=False, turns_remaining=turns
    )
    return state, {"queued": structure, "city": city_id, "turns": turns}


def _train_unit(state: GameState, owner: str, details: dict) -> tuple[GameState, dict]:
    city_id = details.get("cityId")
    unit_type_str = details.get("unitType")
    try:
        utype = UnitType(unit_type_str)
    except ValueError:
        return state, {"error": f"Unknown unit type: {unit_type_str}"}

    pstate = getattr(state, owner)
    city = next((c for c in pstate.cities if c.id == city_id), None)
    if city is None:
        return state, {"error": "City not found"}
    if city.production_queue:
        return state, {"error": "Production queue busy"}

    stats = UNIT_STATS.get(utype.value, {})
    turns = stats.get("cost_turns", 5)
    city.production_queue = ProductionQueue(
        item_type=unit_type_str, is_unit=True, turns_remaining=turns
    )
    return state, {"queued_unit": unit_type_str, "city": city_id, "turns": turns}


def _research_technology(state: GameState, owner: str, details: dict) -> tuple[GameState, dict]:
    tech_id = details.get("techId")
    if tech_id not in TECH_TREE:
        return state, {"error": f"Unknown technology: {tech_id}"}

    pstate = getattr(state, owner)
    tech = TECH_TREE[tech_id]
    if tech_id in pstate.researched_techs:
        return state, {"error": "Already researched"}
    if not all(r in pstate.researched_techs for r in tech.required_techs):
        return state, {"error": "Prerequisites not met"}

    pstate.current_research = tech_id
    pstate.research_progress = 0
    return state, {"researching": tech_id, "cost": tech.cost}


def _found_city(state: GameState, owner: str, details: dict) -> tuple[GameState, dict]:
    unit_id = details.get("unitId")
    city_name = details.get("name", "New City")

    pstate = getattr(state, owner)
    unit = next((u for u in pstate.units if u.id == unit_id), None)
    if unit is None or unit.unit_type != UnitType.SETTLER:
        return state, {"error": "Need a settler unit"}

    city_id = f"city_{str(uuid.uuid4())[:8]}"
    new_city = City(
        id=city_id,
        name=city_name,
        owner=owner,
        position=unit.position,
        population=1,
    )
    # Add palace to first city
    if not pstate.cities:
        new_city.buildings.append(Building(building_type=BuildingType.PALACE))

    pstate.cities.append(new_city)
    # Remove settler
    pstate.units = [u for u in pstate.units if u.id != unit_id]

    tile = get_tile(state, unit.position.x, unit.position.y)
    if tile:
        tile.owner = owner

    return state, {"founded": city_id, "name": city_name, "position": unit.position.model_dump()}


def _improve_resource(state: GameState, owner: str, details: dict) -> tuple[GameState, dict]:
    x, y = details.get("x"), details.get("y")
    tile = get_tile(state, x, y)
    if tile is None or tile.resource is None:
        return state, {"error": "No resource at that tile"}
    if tile.owner != owner:
        return state, {"error": "Tile not owned by you"}
    tile.resource_improved = True
    return state, {"improved": tile.resource.value, "position": {"x": x, "y": y}}


def _end_turn(state: GameState, owner: str, details: dict) -> tuple[GameState, dict]:
    """Apply end-of-turn calculations."""
    # Advance research
    for o in ("player", "ai"):
        pstate = getattr(state, o)
        if pstate.current_research:
            tech = TECH_TREE.get(pstate.current_research)
            if tech:
                pstate.research_progress += pstate.resources.science
                if pstate.research_progress >= tech.cost:
                    pstate.researched_techs.append(pstate.current_research)
                    pstate.current_research = None
                    pstate.research_progress = 0

    state, prod_events = tick_production_queues(state)

    # Spawn completed units/buildings
    for event in prod_events:
        pstate = getattr(state, event["owner"])
        city = next((c for c in pstate.cities if c.id == event["city_id"]), None)
        if city and event["is_unit"]:
            stats = UNIT_STATS.get(event["completed"], {})
            new_unit = Unit(
                id=f"unit_{str(uuid.uuid4())[:8]}",
                unit_type=UnitType(event["completed"]),
                owner=event["owner"],
                position=city.position,
                movement_points=stats.get("movement", 2),
                movement_points_left=stats.get("movement", 2),
                strength=stats.get("strength", 10),
                health=stats.get("health", 100),
            )
            pstate.units.append(new_unit)
        elif city and not event["is_unit"]:
            btype = BuildingType(event["completed"])
            city.buildings.append(Building(building_type=btype))

    state = apply_end_of_turn_resources(state)

    # Reset movement points for the owner
    pstate = getattr(state, owner)
    for unit in pstate.units:
        unit.movement_points_left = unit.movement_points
        unit.has_attacked = False

    state.turn += 1
    state.current_player = "ai" if owner == "player" else "player"

    state = update_fog_of_war(state)
    result = check_victory(state)
    state.result = result

    return state, {"turn": state.turn, "prod_events": prod_events, "result": result.value}
