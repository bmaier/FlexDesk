"""Shared helpers for behave step definitions (not a step module itself)."""
from __future__ import annotations


def user_id(context, name: str) -> int:
    if not hasattr(context, "_user_ids"):
        context._user_ids = {}
        for u in context.client.get("/api/auth/users").json():
            context._user_ids[u["display_name"]] = u["id"]
    return context._user_ids[name]


def headers_for(context, name: str) -> dict:
    if name not in context.tokens:
        uid = user_id(context, name)
        resp = context.client.post("/api/auth/login", json={"user_id": uid})
        context.tokens[name] = resp.json()["token"]
    return {"Authorization": f"Bearer {context.tokens[name]}"}


def find_room_id(context, name: str, headers: dict) -> int:
    props = context.client.get("/api/catalog/properties", headers=headers).json()
    for p in props:
        tree = context.client.get(f"/api/catalog/properties/{p['id']}/tree", headers=headers).json()
        for b in tree["buildings"]:
            for f in b["floors"]:
                for r in f["rooms"]:
                    if r["name"] == name:
                        return r["id"]
    raise LookupError(f"Room not found: {name}")


def find_desk(context, desk_number: str, headers: dict) -> dict:
    props = context.client.get("/api/catalog/properties", headers=headers).json()
    for p in props:
        tree = context.client.get(f"/api/catalog/properties/{p['id']}/tree", headers=headers).json()
        for b in tree["buildings"]:
            for f in b["floors"]:
                for r in f["rooms"]:
                    for d in r["desks"]:
                        if d["desk_number"] == desk_number:
                            return d
    raise LookupError(f"Desk not found: {desk_number}")


def find_property_id(context, name: str, headers: dict) -> int:
    props = context.client.get("/api/catalog/properties", headers=headers).json()
    return next(p["id"] for p in props if p["name"] == name)
