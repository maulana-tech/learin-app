"""Data origin labelling.

The house rule: a value travels with where it came from. A skill found by a
rule in a student's own document is DERIVED; a figure from the curated sample
data is MODELLED and says so.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class Origin(str, Enum):
    LIVE = "live"          # straight from an official API
    CACHED = "cached"      # was live once, carries its timestamp
    DERIVED = "derived"    # computed from something live
    MODELLED = "modelled"  # company profile / fixture, labelled in the open
    MISSING = "missing"    # the lead stops here rather than guessing


#: Origins strong enough to be shown as fact.
TRUSTED = frozenset({Origin.LIVE, Origin.CACHED, Origin.DERIVED})

#: Weakest first. A finding is never more trustworthy than the weakest thing it rests on.
STRENGTH = (Origin.MISSING, Origin.MODELLED, Origin.CACHED, Origin.DERIVED, Origin.LIVE)


def weakest(*origins: Origin) -> Origin:
    """The weakest of several origins: what a figure built from all of them is worth."""
    return min(origins, key=STRENGTH.index)


@dataclass
class Result:
    value: Any
    origin: Origin
    source: str                      # "syllabus:Pemrograman Web" / "catalog:jobs.json"
    fetched_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    note: str = ""

    @property
    def trusted(self) -> bool:
        return self.origin in TRUSTED

    def brief(self) -> dict:
        return {
            "origin": self.origin.value,
            "source": self.source,
            "fetched_at": self.fetched_at.isoformat(timespec="seconds"),
            "note": self.note,
        }


def demo() -> None:
    live = Result({"repo": "sari/resepku", "stars": 3}, Origin.LIVE, "github")
    assert live.trusted and live.value["stars"] == 3

    failed = Result(None, Origin.MISSING, "github", note="rate limit spent")
    assert not failed.trusted
    assert failed.value is None, "a failure must never invent a value"

    modelled = Result({"posts": 7}, Origin.MODELLED, "catalog:jobs.json")
    assert not modelled.trusted, "modelled data must never count as trusted"

    assert {o.value for o in Origin} == {"live", "cached", "derived", "modelled", "missing"}
    assert weakest(Origin.LIVE, Origin.MODELLED, Origin.DERIVED) is Origin.MODELLED
    assert weakest(Origin.DERIVED) is Origin.DERIVED
    print("provenance ok")


if __name__ == "__main__":
    demo()
