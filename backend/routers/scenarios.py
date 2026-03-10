from fastapi import APIRouter, HTTPException
from bson import ObjectId
from database import get_db

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.get("/")
async def list_scenarios():
    db = get_db()
    scenarios = []
    async for doc in db.scenarios.find({}, {"initial_state": 0}):
        doc["id"] = str(doc.pop("_id"))
        scenarios.append(doc)
    return scenarios


@router.get("/{scenario_id}")
async def get_scenario(scenario_id: str):
    db = get_db()
    try:
        oid = ObjectId(scenario_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scenario ID")
    doc = await db.scenarios.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Scenario not found")
    doc["id"] = str(doc.pop("_id"))
    return doc
