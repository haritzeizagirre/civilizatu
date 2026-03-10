"""Civilization definitions."""
from models.game_models import CivilizationDef, UnitType

CIVILIZATIONS: dict[str, CivilizationDef] = {
    "aztec": CivilizationDef(
        civ_id="aztec",
        name="Aztec Empire",
        unique_unit=UnitType.UNIQUE_PLAYER,   # Eagle Warrior
        science_bonus=1.15,
        production_bonus=1.0,
        culture_bonus=1.1,
        gold_bonus=1.0,
        starting_techs=["agriculture", "animal_husbandry"],
    ),
    "rome": CivilizationDef(
        civ_id="rome",
        name="Roman Empire",
        unique_unit=UnitType.UNIQUE_AI,        # Legion
        science_bonus=1.0,
        production_bonus=1.2,
        culture_bonus=1.0,
        gold_bonus=1.1,
        starting_techs=["agriculture", "bronze_working"],
    ),
}

DEFAULT_PLAYER_CIV = "aztec"
DEFAULT_AI_CIV = "rome"
