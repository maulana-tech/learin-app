"""The curated data: skill taxonomy, target roles, sample job posts."""
from __future__ import annotations

import functools
import json
import pathlib
from typing import Any, Dict, List, Optional

HERE = pathlib.Path(__file__).resolve().parent.parent / "catalog"


@functools.lru_cache(maxsize=None)
def _load(name: str) -> Dict[str, Any]:
    return json.loads((HERE / name).read_text())


def skills() -> List[Dict[str, Any]]:
    return _load("taxonomy.json")["skills"]


def watchlist() -> List[str]:
    return _load("taxonomy.json").get("watchlist", [])


def categories() -> List[str]:
    return _load("taxonomy.json")["categories"]


@functools.lru_cache(maxsize=None)
def skill_index() -> Dict[str, Dict[str, Any]]:
    return {s["id"]: s for s in skills()}


def skill(sid: str) -> Optional[Dict[str, Any]]:
    return skill_index().get(sid)


def roles() -> List[Dict[str, Any]]:
    return _load("roles.json")["roles"]


def role(rid: str) -> Optional[Dict[str, Any]]:
    return next((r for r in roles() if r["id"] == rid), None)


def regions() -> List[Dict[str, Any]]:
    return _load("roles.json")["regions"]


def posts(role_id: str, region: Optional[str] = None) -> List[Dict[str, Any]]:
    all_for_role = [p for p in _load("jobs.json")["posts"] if p["role"] == role_id]
    in_region = [p for p in all_for_role if region and p["region"] == region]
    return in_region or all_for_role


def demo() -> None:
    ids = set(skill_index())
    for s in skills():
        assert s["category"] in categories(), s["id"]
        assert set(s["prereqs"]) <= ids, s["id"]
        assert s["aliases"], s["id"]
    for r in roles():
        for req in r["requires"]:
            assert req["skill"] in ids, (r["id"], req["skill"])
            assert req["level"] in ("core", "plus")
        assert posts(r["id"]), f"{r['id']} has no sample posts"
    assert {p["region"] for p in posts("junior-web-developer", "sg")} == {"sg"}
    assert posts("junior-web-developer", "mars"), "an unknown region falls back to every post"
    print(f"catalog ok: {len(ids)} skills, {len(roles())} roles, every prerequisite and requirement resolves")


if __name__ == "__main__":
    demo()
