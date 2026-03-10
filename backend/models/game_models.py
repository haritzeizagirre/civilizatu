"""
Pydantic models for the game domain.
All MongoDB documents use str(_id) serialized as 'id'.
"""
from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field
from enum import Enum


# ─── Enums ────────────────────────────────────────────────────────────────────

class TileType(str, Enum):
    PLAINS = "plains"
    FOREST = "forest"
    HILLS = "hills"
    MOUNTAINS = "mountains"
    OCEAN = "ocean"
    DESERT = "desert"
    TUNDRA = "tundra"
    RIVER = "river"


class ResourceType(str, Enum):
    IRON = "iron"
    CATTLE = "cattle"
    LUXURY_SILK = "luxury_silk"
    WHEAT = "wheat"
    COAL = "coal"
    OIL = "oil"


class UnitType(str, Enum):
    WARRIOR = "warrior"
    ARCHER = "archer"
    KNIGHT = "knight"
    SETTLER = "settler"
    TANK = "tank"           # cheat / advanced tech unlock
    UNIQUE_PLAYER = "eagle_warrior"
    UNIQUE_AI = "legion"


class BuildingType(str, Enum):
    GRANARY = "granary"
    LIBRARY = "library"
    BARRACKS = "barracks"
    MARKET = "market"
    TEMPLE = "temple"
    FORGE = "forge"
    PALACE = "palace"       # unique – capital auto-built


class TechEra(str, Enum):
    ANCIENT = "ancient"
    CLASSICAL = "classical"
    MODERN = "modern"


class DiplomacyStatus(str, Enum):
    PEACE = "peace"
    WAR = "war"
    ALLIANCE = "alliance"


class TurnPhase(str, Enum):
    PRODUCTION = "production"
    RESEARCH = "research"
    MOVEMENT = "movement"
    DIPLOMACY = "diplomacy"
    BUILDING = "building"
    END = "end"


class GameResult(str, Enum):
    ONGOING = "ongoing"
    PLAYER_WIN_CONQUEST = "player_win_conquest"
    PLAYER_WIN_SCIENCE = "player_win_science"
    PLAYER_WIN_CULTURE = "player_win_culture"
    PLAYER_WIN_DOMINATION = "player_win_domination"
    AI_WIN_CONQUEST = "ai_win_conquest"
    AI_WIN_SCIENCE = "ai_win_science"
    AI_WIN_CULTURE = "ai_win_culture"
    AI_WIN_DOMINATION = "ai_win_domination"


# ─── Sub-models ───────────────────────────────────────────────────────────────

class Position(BaseModel):
    x: int
    y: int


class Resources(BaseModel):
    food: int = 0
    production: int = 0
    science: int = 0
    gold: int = 0
    culture: int = 0
    happiness: int = 0


class Tile(BaseModel):
    x: int
    y: int
    tile_type: TileType = TileType.PLAINS
    resource: Optional[ResourceType] = None
    resource_improved: bool = False
    has_ruins: bool = False
    has_barbarian_camp: bool = False
    road: bool = False
    # Ownership: "player", "ai", or None
    owner: Optional[str] = None


class Building(BaseModel):
    building_type: BuildingType
    turns_built: int = 0  # track when it was completed


class ProductionQueue(BaseModel):
    item_type: str  # BuildingType or UnitType value
    is_unit: bool = False
    turns_remaining: int = 1


class City(BaseModel):
    id: str
    name: str
    owner: str  # "player" or "ai"
    position: Position
    population: int = 1
    food_stored: int = 0
    buildings: list[Building] = []
    production_queue: Optional[ProductionQueue] = None
    # Per-turn yields (computed by resource calculator)
    yields: Resources = Field(default_factory=Resources)
    happiness: int = 5
    culture: int = 0


class Unit(BaseModel):
    id: str
    unit_type: UnitType
    owner: str  # "player" or "ai"
    position: Position
    movement_points: int = 2
    movement_points_left: int = 2
    strength: int = 10
    health: int = 100
    promotions: list[str] = []
    has_attacked: bool = False


class Technology(BaseModel):
    tech_id: str
    name: str
    era: TechEra
    cost: int  # science points
    required_techs: list[str] = []
    unlocks_buildings: list[BuildingType] = []
    unlocks_units: list[UnitType] = []
    culture_bonus: int = 0
    production_bonus: int = 0


class CivilizationDef(BaseModel):
    civ_id: str
    name: str
    unique_unit: UnitType
    science_bonus: float = 1.0
    production_bonus: float = 1.0
    culture_bonus: float = 1.0
    gold_bonus: float = 1.0
    starting_techs: list[str] = []


class PlayerState(BaseModel):
    civ_id: str
    resources: Resources = Field(default_factory=Resources)
    cities: list[City] = []
    units: list[Unit] = []
    researched_techs: list[str] = []
    current_research: Optional[str] = None
    research_progress: int = 0
    diplomacy_status: DiplomacyStatus = DiplomacyStatus.PEACE
    score: int = 0
    spaceship_built: bool = False


class MapData(BaseModel):
    width: int
    height: int
    tiles: list[Tile] = []
    # fog_of_war[y][x] = True means explored by player
    fog_of_war: list[list[bool]] = []


class GameState(BaseModel):
    turn: int = 1
    current_phase: TurnPhase = TurnPhase.MOVEMENT
    current_player: str = "player"  # "player" or "ai"
    player: PlayerState
    ai: PlayerState
    map: MapData
    result: GameResult = GameResult.ONGOING
    max_turns: int = 200
