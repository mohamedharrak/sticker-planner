from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from app.db import db

app = FastAPI(title="Sticker Planner API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── MODELS ────────────────────────────────────────────────────────────


class MessageResponse(BaseModel):
    message: str


class HealthResponse(BaseModel):
    status: str
    database: Optional[str] = None
    details: Optional[str] = None


class Sticker(BaseModel):
    name: str
    category: str
    src: str               # image data URL or remote URL
    x: float = 100
    y: float = 100
    w: float = 100
    h: float = 100
    rot: float = 0
    flipH: bool = False
    flipV: bool = False
    hue: float = 0
    sat: float = 100
    br: float = 100


class StickerUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    src: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    w: Optional[float] = None
    h: Optional[float] = None
    rot: Optional[float] = None
    flipH: Optional[bool] = None
    flipV: Optional[bool] = None
    hue: Optional[float] = None
    sat: Optional[float] = None
    br: Optional[float] = None


class StickerOut(BaseModel):
    id: str
    name: str
    category: str
    src: str
    x: float
    y: float
    w: float
    h: float
    rot: float
    flipH: bool
    flipV: bool
    hue: float
    sat: float
    br: float


class StickerListResponse(BaseModel):
    stickers: list[StickerOut]

# ── SERIALIZER ────────────────────────────────────────────────────────


def serialize_sticker(s):
    return {
        "id":       str(s["_id"]),
        "name":     s.get("name", ""),
        "category": s.get("category", "custom"),
        "src":      s.get("src", ""),
        "x":        s.get("x", 100),
        "y":        s.get("y", 100),
        "w":        s.get("w", 100),
        "h":        s.get("h", 100),
        "rot":      s.get("rot", 0),
        "flipH":    s.get("flipH", False),
        "flipV":    s.get("flipV", False),
        "hue":      s.get("hue", 0),
        "sat":      s.get("sat", 100),
        "br":       s.get("br", 100),
    }

# ── ROUTES ────────────────────────────────────────────────────────────


@app.get("/", response_model=MessageResponse)
def root():
    return {"message": "Sticker Planner API v0.2 is running"}


@app.get("/health", response_model=HealthResponse)
def health():
    try:
        db.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "details": str(e)}


@app.get("/stickers", response_model=StickerListResponse)
def get_stickers():
    stickers = [serialize_sticker(s) for s in db.stickers.find()]
    return {"stickers": stickers}


@app.post("/stickers", response_model=StickerOut)
def create_sticker(sticker: Sticker):
    result = db.stickers.insert_one(sticker.model_dump())
    new_sticker = db.stickers.find_one({"_id": result.inserted_id})
    return serialize_sticker(new_sticker)


@app.put("/stickers/{sticker_id}", response_model=StickerOut)
def update_sticker(sticker_id: str, data: StickerUpdate):
    if not ObjectId.is_valid(sticker_id):
        raise HTTPException(status_code=400, detail="Invalid sticker ID")
    # Only update fields that were actually sent
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = db.stickers.update_one(
        {"_id": ObjectId(sticker_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sticker not found")
    updated = db.stickers.find_one({"_id": ObjectId(sticker_id)})
    return serialize_sticker(updated)


@app.delete("/stickers/{sticker_id}", response_model=MessageResponse)
def delete_sticker(sticker_id: str):
    if not ObjectId.is_valid(sticker_id):
        raise HTTPException(status_code=400, detail="Invalid sticker ID")
    result = db.stickers.delete_one({"_id": ObjectId(sticker_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sticker not found")
    return {"message": "Sticker deleted successfully"}


@app.delete("/stickers", response_model=MessageResponse)
def clear_stickers():
    db.stickers.delete_many({})
    return {"message": "All stickers cleared"}


@app.post("/seed", response_model=MessageResponse)
def seed_data():
    sample = [
        {"name": "Star",        "category": "fun",          "src": "", "x": 80,  "y": 60,  "w": 100,
            "h": 100, "rot": 0, "flipH": False, "flipV": False, "hue": 0, "sat": 100, "br": 100},
        {"name": "Study",       "category": "school",       "src": "", "x": 200, "y": 120, "w": 100,
            "h": 100, "rot": 0, "flipH": False, "flipV": False, "hue": 0, "sat": 100, "br": 100},
        {"name": "Productivity", "category": "productivity",  "src": "", "x": 320, "y": 80,  "w": 100,
            "h": 100, "rot": 0, "flipH": False, "flipV": False, "hue": 0, "sat": 100, "br": 100},
    ]
    db.stickers.delete_many({})
    db.stickers.insert_many(sample)
    return {"message": "Sample stickers inserted"}
