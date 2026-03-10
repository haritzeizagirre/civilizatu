"""Victory condition checker."""
from models.game_models import GameState, GameResult
from game_logic.technology import is_tech_tree_complete

CULTURE_WIN_THRESHOLD = 2000
DOMINATION_TURNS = 200


def check_victory(state: GameState) -> GameResult:
    p = state.player
    ai = state.ai

    # ─── Player wins ─────────────────────────────────────────────────────────
    # Conquest: AI has no cities
    if not ai.cities:
        return GameResult.PLAYER_WIN_CONQUEST

    # Science: full tech tree + spaceship
    if is_tech_tree_complete(p.researched_techs) and p.spaceship_built:
        return GameResult.PLAYER_WIN_SCIENCE

    # Culture
    if p.resources.culture >= CULTURE_WIN_THRESHOLD:
        return GameResult.PLAYER_WIN_CULTURE

    # Domination: max turns reached, player has more cities
    if state.turn >= DOMINATION_TURNS:
        if len(p.cities) > len(ai.cities):
            return GameResult.PLAYER_WIN_DOMINATION
        elif len(ai.cities) > len(p.cities):
            return GameResult.AI_WIN_DOMINATION
        # tie – player wins
        return GameResult.PLAYER_WIN_DOMINATION

    # ─── AI wins ─────────────────────────────────────────────────────────────
    if not p.cities:
        return GameResult.AI_WIN_CONQUEST

    if is_tech_tree_complete(ai.researched_techs) and ai.spaceship_built:
        return GameResult.AI_WIN_SCIENCE

    if ai.resources.culture >= CULTURE_WIN_THRESHOLD:
        return GameResult.AI_WIN_CULTURE

    return GameResult.ONGOING
