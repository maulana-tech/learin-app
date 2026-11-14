"""Workers: the agent team's runs, off the request thread, a few at a time.

A run can take a minute with a model in it. The request that starts it
answers at once with a run id; the run waits in a queue as `queued` until one
of LEARIS_WORKERS threads takes it and marks it `running`. Several students
can run together without one slow model holding up the rest, and the agent
panel polls the run's steps the whole time.

A run that a worker never finished (the process restarted mid-run) is closed
as failed by the scheduled `stale_runs` job, so it cannot block the student.
"""
from __future__ import annotations

import os
import queue
import threading
import traceback
from typing import Any, Callable, Dict, Optional, Tuple

WORKERS = max(1, int(os.environ.get("LEARIS_WORKERS", "3")))


class Pool:
    def __init__(self, size: int = WORKERS):
        self.size = size
        self._q: "queue.Queue[Tuple[str, Callable[..., Any], tuple]]" = queue.Queue()
        self._threads: list = []
        self._lock = threading.Lock()
        self.active: Dict[str, str] = {}          # thread name -> job label
        self.done = 0
        self.failed = 0

    def _start(self) -> None:
        with self._lock:
            while len(self._threads) < self.size:
                t = threading.Thread(target=self._loop, name=f"learis-worker-{len(self._threads) + 1}",
                                     daemon=True)
                t.start()
                self._threads.append(t)

    def _loop(self) -> None:
        name = threading.current_thread().name
        while True:
            label, fn, args = self._q.get()
            self.active[name] = label
            try:
                fn(*args)
                self.done += 1
            except Exception:                                      # noqa: BLE001
                traceback.print_exc()
                self.failed += 1
            finally:
                self.active.pop(name, None)
                self._q.task_done()

    def submit(self, label: str, fn: Callable[..., Any], *args: Any) -> None:
        self._start()
        self._q.put((label, fn, args))

    def status(self) -> Dict[str, Any]:
        return {"workers": self.size, "busy": len(self.active), "queued": self._q.qsize(),
                "done": self.done, "failed": self.failed}

    def wait(self, timeout: Optional[float] = None) -> None:
        """For checks: block until the queue is empty."""
        if timeout is None:
            self._q.join()
            return
        import time
        end = time.time() + timeout
        while self._q.unfinished_tasks and time.time() < end:
            time.sleep(0.02)


POOL = Pool()


def demo() -> None:
    import time
    p = Pool(2)
    seen = []
    lock = threading.Lock()

    def job(i: int) -> None:
        time.sleep(0.05)
        with lock:
            seen.append(i)

    def boom() -> None:
        raise RuntimeError("a failing job must not kill its worker")

    started = time.time()
    for i in range(4):
        p.submit(f"job {i}", job, i)
    p.submit("boom", boom)
    p.submit("after", job, 99)
    p.wait(5)
    assert sorted(seen) == [0, 1, 2, 3, 99], seen
    assert time.time() - started < 0.3, "two workers run jobs side by side"
    assert p.status()["failed"] == 1 and p.status()["done"] == 5 and p.status()["queued"] == 0
    print("worker ok: jobs run in parallel · a failing job does not stop its worker")


if __name__ == "__main__":
    demo()
