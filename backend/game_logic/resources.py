"""Resource/yield calculator run at end of each turn."""
from models.game_models import (
    GameState, PlayerState, City, Resources, TileType, ResourceType, BuildingType
)


# ─── Tile base yields ────────────────────────────────────────────────────────
TILE_YIELDS: dict[TileType, Resources] = {
    TileType.PLAINS:    Resources(food=1, production=1),
    TileType.FOREST:    Resources(food=1, production=2),
    TileType.HILLS:     Resources(production=2, science=1),
    TileType.MOUNTAINS: Resources(production=1, science=2),
    TileType.OCEAN:     Resources(food=1, gold=1),
    TileType.DESERT:    Resources(gold=1),
    TileType.TUNDRA:    Resources(food=1),
    TileType.RIVER:     Resources(food=2, gold=2),
}

# ─── Resource bonuses (when improved) ───────────────────────────────────────
RESOURCE_YIELDS: dict[ResourceType, Resources] = {
    ResourceType.IRON:        Resources(production=3),
    ResourceType.CATTLE:      Resources(food=3),
    ResourceType.LUXURY_SILK: Resources(gold=4, happiness=2),
    ResourceType.WHEAT:       Resources(food=2),
    ResourceType.COAL:        Resources(production=4),
    ResourceType.OIL:         Resources(production=5, gold=2),
}

# ─── Building yields ─────────────────────────────────────────────────────────
BUILDING_YIELDS: dict[BuildingType, Resources] = {
    BuildingType.GRANARY:  Resources(food=2),
    BuildingType.LIBRARY:  Resources(science=3),
    BuildingType.BARRACKS: Resources(),                # allows unit production
    BuildingType.MARKET:   Resources(gold=3),
    BuildingType.TEMPLE:   Resources(culture=2, happiness=1),
    BuildingType.FORGE:    Resources(production=3),
    BuildingType.PALACE:   Resources(gold=5, culture=2),
}

# ─── Unit maintenance (gold per turn) ───────────────────────────────────────
UNIT_MAINTENANCE: dict[str, int] = {
    "warrior": 1, "archer": 1, "knight": 2,
    "settler": 0, "tank": 3,
    "eagle_warrior": 2, "legion": 2,
}


def _city_tile_yields(city: City, tiles_by_pos: dict[tuple, any]) -> Resources:
    """Sum yields from tiles within 2-hex radius of city (BFS simplified to owned tiles)."""
    base = Resources(food=2, production=1)  # city center
    # Owned tiles are stored in map.tiles with owner == city.owner
    # We use a simple radius 2 neighbourhood; caller passes relevant tiles
    return base


def compute_city_yields(city: City, game_map) -> Resources:
    """Compute total per-turn yield for one city."""
    r = Resources(food=2, production=1, gold=1)  # city center base

    # Building bonuses
    for b in city.buildings:
        bonus = BUILDING_YIELDS.get(b.building_type, Resources())
        r.food += bonus.food
        r.production += bonus.production
        r.science += bonus.science
        r.gold += bonus.gold
        r.culture += bonus.culture
        r.happiness += bonus.happiness

    # Nearby tile + resource bonuses (2-hex neighbourhood)
    for tile in game_map.tiles:
        dist = hex_distance(tile.x, city.position.x, tile.y, city.position.y)
        if 1 <= dist <= 2 and tile.owner == city.owner:
            tile_y = TILE_YIELDS.get(tile.tile_type, Resources())
            r.food += tile_y.food
            r.production += tile_y.production
            r.science += tile_y.science
            r.gold += tile_y.gold
            if tile.resource and tile.resource_improved:
                res_y = RESOURCE_YIELDS.get(tile.resource, Resources())
                r.food += res_y.food
                r.production += res_y.production
                r.science += res_y.science
                r.gold += res_y.gold
                r.happiness += res_y.happiness

    return r


def hex_distance(ax: int, bx: int, ay: int, by: int) -> int:
    """Offset-coordinate hex distance (even-q)."""
    # Convert offset to cube coords
    def to_cube(col, row):
        x = col - (row - (row & 1)) // 2
        z = row
        y = -x - z
        return x, y, z

    ax2, ay2, az2 = to_cube(ax, ay)
    bx2, by2, bz2 = to_cube(bx, by)
    return max(abs(ax2 - bx2), abs(ay2 - by2), abs(az2 - bz2))


def apply_end_of_turn_resources(state: GameState) -> GameState:
    """Mutate game state to apply end-of-turn resource gains, growth, and unit maintenance."""
    for owner_key in ("player", "ai"):
        pstate: PlayerState = getattr(state, owner_key)
        total = Resources()

        for city in pstate.cities:
            city.yields = compute_city_yields(city, state.map)
            total.food += city.yields.food
            total.production += city.yields.production
            total.science += city.yields.science
            total.gold += city.yields.gold
            total.culture += city.yields.culture

            # City growth: store food, grow when threshold met
            food_threshold = 10 + city.population * 5
            city.food_stored += city.yields.food
            if city.food_stored >= food_threshold:
                city.population += 1
                city.food_stored = 0

        # Unit maintenance
        for unit in pstate.units:
            maintenance = UNIT_MAINTENANCE.get(unit.unit_type.value, 1)
            total.gold -= maintenance

        # Apply to player totals
        pstate.resources.food += total.food
        pstate.resources.food = max(0, pstate.resources.food)
        pstate.resources.production += total.production
        pstate.resources.science += total.science
        pstate.resources.gold += total.gold
        pstate.resources.culture += total.culture

    return state


def tick_production_queues(state: GameState) -> tuple[GameState, list[dict]]:
    """Advance production queues; return list of completion events."""
    events = []
    for owner_key in ("player", "ai"):
        pstate: PlayerState = getattr(state, owner_key)
        for city in pstate.cities:
            if not city.production_queue:
                continue
            q = city.production_queue
            production_available = city.yields.production if city.yields.production > 0 else 2
            q.turns_remaining -= 1
            if q.turns_remaining <= 0:
                events.append({
                    "owner": owner_key,
                    "city_id": city.id,
                    "completed": q.item_type,
                    "is_unit": q.is_unit,
                })
                city.production_queue = None
    return state, events
