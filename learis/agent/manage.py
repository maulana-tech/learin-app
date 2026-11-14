"""LEARIS operator commands.

    python3 manage.py check                       # run every self-check
    python3 manage.py user <email> "<Name>" <role> "<password>"
    python3 manage.py seed                        # a demo student with sample evidence
    python3 manage.py secret                      # print a fresh LEARIS_SECRET
"""
from __future__ import annotations

import os
import pathlib
import secrets
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent

#: Files that carry their own self-check in a __main__ block.
CHECKS = [
    "core/config.py", "core/provenance.py", "core/identity.py", "core/store.py", "core/ai.py",
    "core/registry.py", "core/worker.py", "core/jobs.py", "core/space.py",
    "engine/catalog.py", "engine/evidence.py", "engine/gap.py", "engine/roadmap.py",
    "engine/planner.py", "engine/profile.py", "sources/github.py",
    "agents/team.py", "agents/loop.py", "agents/workspace.py", "core/academic.py", "core/growth.py", "mcp.py", "api.py --check",
]

SAMPLES = HERE / "catalog" / "samples"
SAMPLE_DOCS = [
    ("syllabus", "Pemrograman Web (silabus)", "silabus-pemrograman-web.txt"),
    ("transcript", "Transkrip semester 1-5", "transkrip-semester-1-5.txt"),
    ("project", "Resepku (README)", "README-resepku.md"),
]


def check() -> None:
    failed = []
    for f in CHECKS:
        r = subprocess.run([sys.executable, *f.split()], capture_output=True, text=True, cwd=HERE,
                           env={**os.environ, "PYTHONPATH": str(HERE)})
        print(f"  {'ok    ' if r.returncode == 0 else 'FAILED'} {f}")
        if r.returncode:
            failed.append(f)
            print("        " + ((r.stderr or r.stdout).strip().splitlines() or [""])[-1])
    print(f"\n  {len(CHECKS) - len(failed)}/{len(CHECKS)} passed")
    if failed:
        sys.exit(1)


def seed() -> None:
    """A demo student, Sari, with a syllabus, a transcript and a project README
    waiting to be analysed, a target role, and the LinkedIn text she would paste."""
    from core import identity, store
    email, password = "sari@demo.learis", "demo12345"
    try:
        u = identity.log_in(email, password)
        print(f"exists: {email}")
    except identity.NotAuthorised:
        u = identity.add_user(email, "Sari Wulandari", "student", password)
        print(f"created: {email} / {password}")
    if store.documents(u.id):
        print("  sample documents already there; delete them in the app to seed again")
        return
    for kind, title, name in SAMPLE_DOCS:
        store.add_document(u.id, kind, title, (SAMPLES / name).read_text())
    store.update_student(u.id, target_role="junior-web-developer", region="id",
                         hours_per_week=8, exam_weeks=[3],
                         profile_text=(SAMPLES / "profil-linkedin.txt").read_text())
    print(f"  {len(SAMPLE_DOCS)} sample documents added, target Junior Web Developer (Indonesia)")
    print("  sign in and press Analyse to run the agents")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "check":
        check()
    elif cmd == "seed":
        seed()
    elif cmd == "secret":
        print(f'export LEARIS_SECRET="{secrets.token_hex(32)}"')
    elif cmd == "user":
        from core import identity
        if len(sys.argv) != 6:
            print('usage: python3 manage.py user <email> "<Full Name>" <role> "<password>"')
            print(f"  roles: {', '.join(identity.ROLES)}")
            sys.exit(2)
        email, name, role, password = sys.argv[2:6]
        try:
            u = identity.add_user(email, name, role, password)
        except ValueError as e:
            print(f"{e}\n  roles: {', '.join(identity.ROLES)}")
            sys.exit(2)
        print(f"created: {u.email} · {u.role}")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
