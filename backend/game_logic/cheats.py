"""Cheat code processor."""
import uuid
from models.game_models import (
    GameState, BuildingType, Building, UnitType, Unit, Position
)
from game_logic.turn import UNIT_STATS, BUILDING_COSTS
from game_logic.technology import ALL_TECH_IDS

VALID_CHEATS = {
    "eraiki_guztiak",
    "berehalako_porrota",
    "berehalako_garaipena",
    "tanke_eskuadroia",
    "teknologia_aurreratua",
    "maila_igo",
    "baliabide_maximoak",
    "mugimendu_infinitua",
    "zorion_maximoa",
    "mapa_agertu",
}


def apply_cheat(state: GameState, cheat_code: str, target: dict | None) -> tuple[GameState, dict]:
    if cheat_code not in VALID_CHEATS:
        return state, {"error": f"Unknown cheat: {cheat_code}"}

    p = state.player
    target = target or {}
    city_id = target.get("id")

    if cheat_code == "eraiki_guztiak":
        city = next((c for c in p.cities if c.id == city_id), p.cities[0] if p.cities else None)
        if not city:
            return state, {"error": "No city found"}
        existing = {b.building_type for b in city.buildings}
        for btype in BuildingType:
            if btype not in existing:
                city.buildings.append(Building(building_type=btype))
        return state, {"message": f"All buildings added to {city.name}"}

    elif cheat_code == "berehalako_porrota":
        from models.game_models import GameResult
        state.result = GameResult.AI_WIN_CONQUEST
        return state, {"message": "Instant defeat activated"}

    elif cheat_code == "berehalako_garaipena":
        from models.game_models import GameResult
        state.result = GameResult.PLAYER_WIN_CONQUEST
        return state, {"message": "Instant victory activated"}

    elif cheat_code == "tanke_eskuadroia":
        city = next((c for c in p.cities if c.id == city_id), p.cities[0] if p.cities else None)
        if not city:
            return state, {"error": "No city found"}
        for _ in range(5):
            tank = Unit(
                id=f"unit_{str(uuid.uuid4())[:8]}",
                unit_type=UnitType.TANK,
                owner="player",
                position=city.position,
                movement_points=3,
                movement_points_left=3,
                strength=40,
                health=150,
            )
            p.units.append(tank)
        return state, {"message": "5 tanks added"}

    elif cheat_code == "teknologia_aurreratua":
        unreseached = [t for t in ALL_TECH_IDS if t not in p.researched_techs]
        if unreseached:
            p.researched_techs.append(unreseached[0])
            return state, {"message": f"Researched: {unreseached[0]}"}
        return state, {"message": "All techs already researched"}

    elif cheat_code == "maila_igo":
        city = next((c for c in p.cities if c.id == city_id), p.cities[0] if p.cities else None)
        if not city:
            return state, {"error": "No city found"}
        old_pop = city.population
        city.population += 1
        return state, {"message": f"{city.name} population: {old_pop} → {city.population}"}

    elif cheat_code == "baliabide_maximoak":
        p.resources.food = 9999
        p.resources.production = 9999
        p.resources.science = 9999
        p.resources.gold = 9999
        p.resources.culture = 9999
        return state, {"message": "All resources maxed"}

    elif cheat_code == "mugimendu_infinitua":
        for unit in p.units:
            unit.movement_points_left = 99
        return state, {"message": "All units have infinite movement this turn"}

    elif cheat_code == "zorion_maximoa":
        city = next((c for c in p.cities if c.id == city_id), p.cities[0] if p.cities else None)
        if not city:
            return state, {"error": "No city found"}
        city.happiness = 100
        return state, {"message": f"{city.name} happiness maxed"}

    elif cheat_code == "mapa_agertu":
        for row in state.map.fog_of_war:
            for i in range(len(row)):
                row[i] = True
        return state, {"message": "Fog of war removed"}

    return state, {"error": "Cheat not implemented"}
