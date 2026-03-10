"""Game CRUD, action dispatch, turn management, cheats, and WebSocket AI turn."""
from __future__ import annotations
import json
import asyncio
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status
from bson import ObjectId

from database import get_db
from models.request_models import NewGameRequest, ActionRequest, CheatRequest, SaveRequest
from models.game_models import GameState, GameResult
from services.deps import get_current_user
from services.ai_client import request_ai_decision
from config import get_settings
from game_logic.scenario_builder import build_initial_state
from game_logic.turn import process_action
from game_logic.cheats import apply_cheat
from game_logic.fog import filter_ai_state_for_player

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/games", tags=["games"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _state_to_doc(state: GameState) -> dict:
    return json.loads(state.model_dump_json())


def _doc_to_state(doc: dict) -> GameState:
    return GameState.model_validate(doc)


def _game_summary(doc: dict) -> dict:
    gs = doc.get("game_state", {})
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "scenario_id": doc["scenario_id"],
        "created_at": doc["created_at"],
        "last_saved": doc["last_saved"],
        "is_autosave": doc.get("is_autosave", False),
        "turn": gs.get("turn", 1),
        "result": gs.get("result", "ongoing"),
    }


async def _load_game_doc(db, game_id: str, user_id: str) -> dict:
    try:
        oid = ObjectId(game_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid game ID")
    doc = await db.games.find_one({"_id": oid, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Game not found")
    return doc


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/")
async def list_games(current_user: dict = Depends(get_current_user)):
    db = get_db()
    games = []
    async for doc in db.games.find(
        {"user_id": current_user["sub"]},
        {"game_state.map": 0},  # exclude heavy map data from list
    ).sort("last_saved", -1):
        games.append(_game_summary(doc))
    return games


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_game(body: NewGameRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        scenario_doc = await db.scenarios.find_one({"_id": ObjectId(body.scenario_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scenario ID")
    if not scenario_doc:
        raise HTTPException(status_code=404, detail="Scenario not found")

    state = build_initial_state(scenario_doc, player_civ_id=body.player_civ)

    now = datetime.utcnow()
    game_doc = {
        "user_id": current_user["sub"],
        "name": body.name,
        "scenario_id": body.scenario_id,
        "created_at": now,
        "last_saved": now,
        "is_autosave": False,
        "cheats_used": [],
        "game_state": _state_to_doc(state),
    }
    result = await db.games.insert_one(game_doc)
    return {"id": str(result.inserted_id), "name": body.name}


@router.get("/{game_id}")
async def get_game(game_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _load_game_doc(db, game_id, current_user["sub"])
    state = _doc_to_state(doc["game_state"])

    # Build player-facing response (fog-of-war filtered)
    response = _state_to_doc(state)
    response["ai"] = filter_ai_state_for_player(state)
    response["id"] = str(doc["_id"])
    response["name"] = doc["name"]
    response["cheats_used"] = doc.get("cheats_used", [])
    return response


@router.post("/{game_id}/save")
async def save_game(game_id: str, body: SaveRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _load_game_doc(db, game_id, current_user["sub"])
    update: dict[str, Any] = {"last_saved": datetime.utcnow(), "is_autosave": False}
    if body.name:
        update["name"] = body.name
    await db.games.update_one({"_id": doc["_id"]}, {"$set": update})
    return {"saved": True}


@router.post("/{game_id}/action")
async def player_action(
    game_id: str,
    body: ActionRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await _load_game_doc(db, game_id, current_user["sub"])
    state = _doc_to_state(doc["game_state"])

    if state.current_player != "player":
        raise HTTPException(status_code=400, detail="Not the player's turn")
    if state.result != GameResult.ONGOING:
        raise HTTPException(status_code=400, detail="Game is already over")

    state, event = process_action(state, "player", body.action_type, body.details)

    if "error" in event:
        raise HTTPException(status_code=400, detail=event["error"])

    await db.games.update_one(
        {"_id": doc["_id"]},
        {"$set": {"game_state": _state_to_doc(state), "last_saved": datetime.utcnow()}},
    )
    response = _state_to_doc(state)
    response["ai"] = filter_ai_state_for_player(state)
    response["event"] = event
    return response


@router.post("/{game_id}/end-turn")
async def end_turn(game_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _load_game_doc(db, game_id, current_user["sub"])
    state = _doc_to_state(doc["game_state"])

    if state.current_player != "player":
        raise HTTPException(status_code=400, detail="Not the player's turn")

    state, event = process_action(state, "player", "endTurn", {})

    await db.games.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "game_state": _state_to_doc(state),
                "last_saved": datetime.utcnow(),
                "is_autosave": True,
            }
        },
    )
    response = _state_to_doc(state)
    response["ai"] = filter_ai_state_for_player(state)
    response["event"] = event
    return response


@router.post("/{game_id}/cheat")
async def cheat(
    game_id: str,
    body: CheatRequest,
    current_user: dict = Depends(get_current_user),
):
    settings = get_settings()
    if not settings.enable_cheats:
        raise HTTPException(status_code=403, detail="Cheats are disabled")

    db = get_db()
    doc = await _load_game_doc(db, game_id, current_user["sub"])
    state = _doc_to_state(doc["game_state"])

    state, result = apply_cheat(state, body.cheat_code, body.target)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    await db.games.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {"game_state": _state_to_doc(state), "last_saved": datetime.utcnow()},
            "$push": {"cheats_used": body.cheat_code},
        },
    )
    response = _state_to_doc(state)
    response["ai"] = filter_ai_state_for_player(state)
    response["cheat_result"] = result
    return response


# ─── WebSocket: AI turn streaming ────────────────────────────────────────────

@router.websocket("/ws/{game_id}")
async def ai_turn_websocket(websocket: WebSocket, game_id: str):
    """
    Client connects, sends {token: "..."}.
    Server validates JWT, runs AI turn, streams actions one-by-one.
    Each message: {"action_index": i, "total": n, "action": {...}, "state_after": {...}}
    Final message: {"done": true, "final_state": {...}}
    """
    await websocket.accept()
    try:
        # Auth via first message
        auth_msg = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        from services.auth_service import decode_token
        payload = decode_token(auth_msg.get("token", ""))
        if payload is None:
            await websocket.send_json({"error": "Invalid token"})
            await websocket.close()
            return

        db = get_db()
        doc = await _load_game_doc(db, game_id, payload["sub"])
        state = _doc_to_state(doc["game_state"])

        if state.current_player != "ai":
            await websocket.send_json({"error": "Not the AI's turn"})
            await websocket.close()
            return

        # Call AI service
        await websocket.send_json({"status": "thinking"})
        try:
            from game_logic.fog import filter_ai_state_for_player
            # Build AI-visible game state (full AI state, fog-filtered player state)
            ai_view = _state_to_doc(state)
            # Player cities/units are hidden from AI too (reversed fog)
            ai_response = await request_ai_decision(ai_view)
        except Exception as e:
            logger.error("AI service call failed: %s", e)
            await websocket.send_json({"error": "AI service error", "detail": str(e)})
            await websocket.close()
            return

        actions: list[dict] = ai_response.get("actions", [])
        total = len(actions)

        for i, action in enumerate(actions):
            action_type = action.get("type", "")
            details = action.get("details", {})

            if action_type == "endTurn":
                state, event = process_action(state, "ai", "endTurn", {})
            else:
                state, event = process_action(state, "ai", action_type, details)

            state_snapshot = _state_to_doc(state)
            state_snapshot["ai"] = filter_ai_state_for_player(state)

            await websocket.send_json({
                "action_index": i + 1,
                "total": total,
                "action": action,
                "event": event,
                "state_after": state_snapshot,
            })
            await asyncio.sleep(0.3)  # pacing for animation

        # Persist updated state
        await db.games.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "game_state": _state_to_doc(state),
                    "last_saved": datetime.utcnow(),
                    "is_autosave": True,
                }
            },
        )

        final = _state_to_doc(state)
        final["ai"] = filter_ai_state_for_player(state)
        await websocket.send_json({
            "done": True,
            "reasoning": ai_response.get("reasoning", ""),
            "analysis": ai_response.get("analysis", ""),
            "final_state": final,
        })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected for game %s", game_id)
    except Exception as e:
        logger.error("WebSocket error: %s", e)
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
