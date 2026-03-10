"""Technology tree definition for CIVilizaTu."""
from models.game_models import Technology, TechEra, BuildingType, UnitType

TECH_TREE: dict[str, Technology] = {
    # ─── ANCIENT ERA ─────────────────────────────────────────────────────────
    "agriculture": Technology(
        tech_id="agriculture",
        name="Agriculture",
        era=TechEra.ANCIENT,
        cost=20,
        unlocks_buildings=[BuildingType.GRANARY],
    ),
    "pottery": Technology(
        tech_id="pottery",
        name="Pottery",
        era=TechEra.ANCIENT,
        cost=25,
        required_techs=["agriculture"],
        culture_bonus=1,
    ),
    "animal_husbandry": Technology(
        tech_id="animal_husbandry",
        name="Animal Husbandry",
        era=TechEra.ANCIENT,
        cost=30,
        required_techs=["agriculture"],
    ),
    "writing": Technology(
        tech_id="writing",
        name="Writing",
        era=TechEra.ANCIENT,
        cost=35,
        required_techs=["pottery"],
        unlocks_buildings=[BuildingType.LIBRARY],
    ),
    "bronze_working": Technology(
        tech_id="bronze_working",
        name="Bronze Working",
        era=TechEra.ANCIENT,
        cost=40,
        required_techs=["animal_husbandry"],
        unlocks_units=[UnitType.WARRIOR],
        unlocks_buildings=[BuildingType.BARRACKS],
    ),
    "archery": Technology(
        tech_id="archery",
        name="Archery",
        era=TechEra.ANCIENT,
        cost=35,
        required_techs=["animal_husbandry"],
        unlocks_units=[UnitType.ARCHER],
    ),
    "currency": Technology(
        tech_id="currency",
        name="Currency",
        era=TechEra.ANCIENT,
        cost=50,
        required_techs=["writing"],
        unlocks_buildings=[BuildingType.MARKET],
    ),
    # ─── CLASSICAL ERA ───────────────────────────────────────────────────────
    "iron_working": Technology(
        tech_id="iron_working",
        name="Iron Working",
        era=TechEra.CLASSICAL,
        cost=70,
        required_techs=["bronze_working"],
        unlocks_buildings=[BuildingType.FORGE],
        production_bonus=2,
    ),
    "horseback_riding": Technology(
        tech_id="horseback_riding",
        name="Horseback Riding",
        era=TechEra.CLASSICAL,
        cost=75,
        required_techs=["animal_husbandry"],
        unlocks_units=[UnitType.KNIGHT],
    ),
    "philosophy": Technology(
        tech_id="philosophy",
        name="Philosophy",
        era=TechEra.CLASSICAL,
        cost=80,
        required_techs=["writing"],
        unlocks_buildings=[BuildingType.TEMPLE],
        culture_bonus=3,
    ),
    "mathematics": Technology(
        tech_id="mathematics",
        name="Mathematics",
        era=TechEra.CLASSICAL,
        cost=90,
        required_techs=["currency", "writing"],
    ),
    "construction": Technology(
        tech_id="construction",
        name="Construction",
        era=TechEra.CLASSICAL,
        cost=85,
        required_techs=["iron_working"],
        production_bonus=3,
    ),
    # ─── MODERN ERA ──────────────────────────────────────────────────────────
    "industrialization": Technology(
        tech_id="industrialization",
        name="Industrialization",
        era=TechEra.MODERN,
        cost=150,
        required_techs=["construction", "mathematics"],
        production_bonus=5,
    ),
    "electricity": Technology(
        tech_id="electricity",
        name="Electricity",
        era=TechEra.MODERN,
        cost=175,
        required_techs=["industrialization"],
    ),
    "combustion": Technology(
        tech_id="combustion",
        name="Combustion",
        era=TechEra.MODERN,
        cost=200,
        required_techs=["electricity", "industrialization"],
        unlocks_units=[UnitType.TANK],
    ),
    "rocketry": Technology(
        tech_id="rocketry",
        name="Rocketry",
        era=TechEra.MODERN,
        cost=250,
        required_techs=["combustion"],
    ),
    "space_flight": Technology(
        tech_id="space_flight",
        name="Space Flight",
        era=TechEra.MODERN,
        cost=300,
        required_techs=["rocketry"],
    ),
    "future_tech": Technology(
        tech_id="future_tech",
        name="Future Technology",
        era=TechEra.MODERN,
        cost=400,
        required_techs=["space_flight"],
    ),
}

ALL_TECH_IDS: list[str] = list(TECH_TREE.keys())


def get_available_techs(researched: list[str]) -> list[Technology]:
    """Return all techs whose prerequisites are satisfied."""
    available = []
    for tech in TECH_TREE.values():
        if tech.tech_id in researched:
            continue
        if all(req in researched for req in tech.required_techs):
            available.append(tech)
    return available


def is_tech_tree_complete(researched: list[str]) -> bool:
    return all(t in researched for t in ALL_TECH_IDS)
