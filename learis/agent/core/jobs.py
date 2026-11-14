"""Scheduled jobs: small, on a timer, never on a model.

    stale_runs   every 5 min   close runs no worker will finish (after a restart)
    purge_text   hourly        delete kept full text the student wants deleted
    checkin      every 6 h     a weekly check-in reminder once a plan is a week old

One thread wakes every TICK seconds and runs whatever is due. LEARIS_SCHEDULE=0
turns it off; every job can still be run by hand (POST /jobs/{name}/run).
"""
from __future__ import annotations

import os
import threading
import time
import traceback
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

from core import store

TICK = 30


@dataclass
class Job:
    name: str
    every: int                    # seconds
    what: str
    fn: Callable[[], str]
    last_at: Optional[float] = None
    last_result: Optional[str] = None
    last_ok: Optional[bool] = None
    runs: int = field(default=0)

    def due(self, now: float) -> bool:
        return self.last_at is None or now - self.last_at >= self.every

    def run(self) -> str:
        self.last_at = time.time()
        try:
            self.last_result = self.fn()
            self.last_ok = True
        except Exception as e:                                       # noqa: BLE001
            traceback.print_exc()
            self.last_result, self.last_ok = f"{type(e).__name__}: {e}", False
        self.runs += 1
        return self.last_result


def _stale_runs() -> str:
    n = store.fail_stale_runs()
    return f"{n} stuck run(s) closed" if n else "nothing stuck"


def _purge_text() -> str:
    n = store.purge_kept_text()
    return f"full text deleted from {n} analysed document(s)" if n else "nothing to delete"


def _checkin() -> str:
    due = store.checkin_due()
    for uid in due:
        store.add_reminder(uid, "checkin",
                           "Weekly check-in: how did last week go? Adjust your free hours or exam "
                           "weeks and the plan follows.")
    return f"{len(due)} check-in reminder(s) created" if due else "no check-in due"


def all_jobs() -> List[Job]:
    return [
        Job("stale_runs", 300, "Close runs that no worker will finish", _stale_runs),
        Job("purge_text", 3600, "Delete kept full text of analysed documents (auto-delete)", _purge_text),
        Job("checkin", 6 * 3600, "Weekly check-in reminder once a plan is a week old", _checkin),
    ]


class Scheduler:
    def __init__(self, jobs: List[Job]):
        self.jobs: Dict[str, Job] = {j.name: j for j in jobs}
        self.enabled = os.environ.get("LEARIS_SCHEDULE", "1") != "0"
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if not self.enabled or self._thread:
            return
        self._thread = threading.Thread(target=self._loop, name="learis-scheduler", daemon=True)
        self._thread.start()

    def _loop(self) -> None:
        while True:
            now = time.time()
            for j in self.jobs.values():
                if j.due(now):
                    j.run()
            time.sleep(TICK)

    def run_now(self, name: str) -> Optional[str]:
        j = self.jobs.get(name)
        return j.run() if j else None

    def describe(self) -> List[dict]:
        return [{"name": j.name, "what": j.what, "every_seconds": j.every,
                 "last_at": j.last_at, "last_result": j.last_result, "last_ok": j.last_ok,
                 "runs": j.runs} for j in self.jobs.values()]


SCHEDULER = Scheduler(all_jobs())


def demo() -> None:
    s = Scheduler(all_jobs())
    assert [j["name"] for j in s.describe()] == ["stale_runs", "purge_text", "checkin"]
    for name in s.jobs:
        out = s.run_now(name)
        assert out and s.jobs[name].last_ok, (name, out)
    assert s.run_now("nope") is None
    boom = Job("boom", 1, "fails", lambda: 1 / 0)
    boom.run()
    assert boom.last_ok is False and "ZeroDivisionError" in boom.last_result, "a failing job is recorded"
    print("jobs ok: " + " · ".join(f"{j['name']}: {j['last_result']}" for j in s.describe()))


if __name__ == "__main__":
    from core.config import fixtures_only
    fixtures_only(__file__, "LEARIS_JOBS_CHECK")
    demo()
