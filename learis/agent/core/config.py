"""Configuration, read once from the environment and .env."""
from __future__ import annotations

import os
import pathlib
from dataclasses import dataclass
from typing import Mapping, Tuple


def _value(raw: str) -> str:
    """One .env value.

    A trailing comment is stripped from an unquoted value, because the example
    file documents each key beside it. Without this, uncommenting
    `SMTP_PASSWORD=   # from the mail provider` sets the value to the comment:
    a non-empty string, which then fails somewhere far from the config error
    it is.
    A quoted value is taken whole, so a `#` inside a password survives.
    """
    v = raw.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    if v.startswith("#"):                       # the whole value is a comment
        return ""
    return v.split(" #", 1)[0].split("\t#", 1)[0].strip()


#: Read in this order; the first to set a key wins, and a real environment
#: variable beats both. `.secrets/ai.env` can hold the deployment's own model key
#: (LEARIS_AI_API_KEY) in the gitignored, mode-700 secrets folder, so it never
#: sits in `.env`.
_ENV_FILES = (".env", ".secrets/ai.env")


def _load_env() -> None:
    """Read .env when present. Convenient in dev; production uses real env vars."""
    root = pathlib.Path(__file__).resolve().parent.parent
    for name in _ENV_FILES:
        f = root / name
        if not f.exists():
            continue
        for line in f.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), _value(v))
    # The product was called SIGAP before it was LEARIS. A deployment whose
    # .env still carries the old names keeps working: each SIGAP_* value fills
    # its LEARIS_* name unless that is already set.
    for k in [k for k in os.environ if k.startswith("SIGAP_")]:
        os.environ.setdefault("LEARIS_" + k[len("SIGAP_"):], os.environ[k])


_load_env()


class InvalidConfig(RuntimeError):
    pass


@dataclass(frozen=True)
class Config:
    env: str                 # "dev" | "staging" | "prod"
    database: str
    #: Where people open LEARIS.
    web_url: str = "http://localhost:3000"
    #: A default model for deployments that run their own, used only when the
    #: student has not connected one (Bring Your Own AI comes first).
    ai_base_url: str = ""
    ai_api_key: str = ""
    ai_model: str = ""
    #: Delete an uploaded document's full text once it has been analysed,
    #: keeping only the quoted evidence. On by default: transcripts and CVs are
    #: personal data and the analysis needs only the quotes.
    auto_delete: bool = True

    @property
    def production(self) -> bool:
        return (self.env or "").strip().lower() in ("prod", "production")

    @property
    def server_ai(self) -> bool:
        return bool(self.ai_base_url and self.ai_model)


def load() -> Config:
    return Config(
        env=os.environ.get("LEARIS_ENV", "dev"),
        database=os.environ.get("LEARIS_DB", "data/learis.db"),
        web_url=(os.environ.get("LEARIS_WEB_URL", "").strip() or "http://localhost:3000").rstrip("/"),
        ai_base_url=os.environ.get("LEARIS_AI_BASE_URL", "").strip().rstrip("/"),
        ai_api_key=os.environ.get("LEARIS_AI_API_KEY", "").strip(),
        ai_model=os.environ.get("LEARIS_AI_MODEL", "").strip(),
        auto_delete=os.environ.get("LEARIS_AUTO_DELETE", "1") != "0",
    )


CFG = load()


def fixtures_only(script: str, flag: str) -> None:
    """Re-exec a self-check on fixtures and a scratch database.

    Returns only in the child.

    A self-check writes specimen documents and runs. Doing that in the real
    database would leave fake evidence in a student's record, so LEARIS_DB is
    redirected to a scratch file, and CFG being frozen at import means only a
    fresh process honours it.
    """
    import subprocess
    import sys
    import tempfile

    if os.environ.get(flag) == "1":
        return
    scratch = pathlib.Path(tempfile.mkdtemp(prefix="learis-check-")) / "check.db"
    env = {**os.environ, "LEARIS_DB": str(scratch), flag: "1",
           "PYTHONPATH": os.environ.get("PYTHONPATH", ".")}
    sys.exit(subprocess.call([sys.executable, script, *sys.argv[1:]], env=env))


def bind_target(env: Mapping[str, str]) -> Tuple[str, int]:
    """Where the HTTP service should listen.

    A container platform sets PORT and routes traffic in from outside, so the
    listener has to accept more than loopback or the health check fails. Nothing sets PORT on a dev
    machine, and binding to loopback there keeps the API off the local network.
    LEARIS_HOST overrides both.
    """
    port = int(env.get("PORT") or 8787)
    host = env.get("LEARIS_HOST") or ("0.0.0.0" if env.get("PORT") else "127.0.0.1")
    return host, port


def demo() -> None:
    assert bind_target({}) == ("127.0.0.1", 8787), "a dev machine stays off the network"
    assert bind_target({"PORT": "8080"}) == ("0.0.0.0", 8080), "a platform port opens the bind"
    assert bind_target({"LEARIS_HOST": "127.0.0.1", "PORT": "8080"}) == ("127.0.0.1", 8080)
    assert bind_target({"LEARIS_HOST": "0.0.0.0"}) == ("0.0.0.0", 8787)
    print("  bind: loopback by default ✓ · opens only when the platform sets PORT ✓")

    assert _value("us-west-2") == "us-west-2"
    assert _value("  dev   # dev | staging | prod  ") == "dev"
    assert _value("   # from the mail provider") == "", "a key that is only a comment is empty"
    assert _value('"p#ssw0rd"') == "p#ssw0rd", "a quoted value keeps its hash"
    assert _value("'p#ssw0rd'") == "p#ssw0rd"
    assert _value("sk-abc#123") == "sk-abc#123", "only ' #' starts a comment, not any hash"
    print("  .env values: comments stripped ✓ · quotes respected ✓ · bare # kept ✓")

    print("config ok")


if __name__ == "__main__":
    demo()
