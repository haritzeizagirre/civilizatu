from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class SavedGame(BaseModel):
    id: Optional[str] = None
    user_id: str
    name: str
    scenario_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_saved: datetime = Field(default_factory=datetime.utcnow)
    is_autosave: bool = False
    cheats_used: list[str] = []
    game_state: dict[str, Any] = {}  # serialized GameState


class SavedGameSummary(BaseModel):
    id: str
    name: str
    scenario_id: str
    created_at: datetime
    last_saved: datetime
    is_autosave: bool
    turn: int
    result: str


class Scenario(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    difficulty: str = "normal"
    map_width: int = 50
    map_height: int = 50
    initial_state: dict[str, Any] = {}


class NewGameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    scenario_id: str
    player_civ: str = "aztec"  # matches CivilizationDef.civ_id


class ActionRequest(BaseModel):
    action_type: str
    details: dict[str, Any] = {}


class CheatRequest(BaseModel):
    cheat_code: str
    target: Optional[dict[str, Any]] = None


class SaveRequest(BaseModel):
    name: Optional[str] = None  # if None, overwrite existing name


class DiplomacyAction(BaseModel):
    action: str   # "proposePeace" | "declareWar" | "offerTrade"
    details: dict[str, Any] = {}
