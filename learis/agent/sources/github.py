"""A public GitHub repository, read as evidence.

Read only, and only what a reviewer would read: the description, the
languages GitHub counted, the README, and the dependency manifest at the root.
The code is never run here. A dependency is strong evidence ("react" in
package.json means React was used), so the manifest goes in as text the
matcher reads like any other document.

Only github.com URLs are accepted, which is also what keeps this from being a
way to make the server fetch an arbitrary address. LEARIS_GITHUB_TOKEN, when
set, raises the unauthenticated limit of 60 requests an hour.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, Optional, Tuple

API = "https://api.github.com"
_URL = re.compile(r"^https?://(www\.)?github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(\.git)?/?(\?.*|#.*|/.*)?$")
MANIFESTS = ("package.json", "requirements.txt", "pyproject.toml", "composer.json", "go.mod",
             "Cargo.toml", "pom.xml")
README_LIMIT = 12_000
#: Package names that do not spell the skill they prove.
FRIENDLY = {"next": "Next.js", "react": "React", "react-dom": "React", "express": "Express",
            "jest": "Jest unit testing", "vitest": "Vitest unit testing", "typescript": "TypeScript",
            "pg": "PostgreSQL", "mysql2": "MySQL", "mongoose": "MongoDB", "prisma": "SQL database schema",
            "@playwright/test": "Playwright", "cypress": "Cypress", "pandas": "pandas",
            "matplotlib": "matplotlib", "scikit-learn": "scikit-learn", "jsonwebtoken": "JWT"}


class GitHubError(RuntimeError):
    pass


def parse(url: str) -> Tuple[str, str]:
    m = _URL.match(url.strip())
    if not m:
        raise GitHubError("give a repository link like https://github.com/owner/repo")
    return m.group(2), m.group(3)


def _get(path: str, raw: bool = False) -> Optional[Any]:
    headers = {"User-Agent": "learis-agent",
               "Accept": "application/vnd.github.raw" if raw else "application/vnd.github+json"}
    token = os.environ.get("LEARIS_GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{API}{path}", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        if e.code == 403:
            raise GitHubError("GitHub's rate limit is spent for now; try again later or set "
                              "LEARIS_GITHUB_TOKEN") from None
        raise GitHubError(f"GitHub answered HTTP {e.code}") from None
    except urllib.error.URLError as e:
        raise GitHubError(f"cannot reach GitHub ({e.reason})") from None
    return body if raw else json.loads(body)


def _deps(name: str, text: str) -> str:
    if name == "package.json":
        try:
            pkg = json.loads(text)
        except json.JSONDecodeError:
            return ""
        deps = sorted({*pkg.get("dependencies", {}), *pkg.get("devDependencies", {})})
        scripts = sorted(pkg.get("scripts", {}))
        uses = sorted({FRIENDLY[d] for d in deps if d in FRIENDLY})
        return (f"Dependencies: {', '.join(deps)}\n" if deps else "") + \
               (f"Uses: {', '.join(uses)}\n" if uses else "") + \
               (f"Scripts: {', '.join(scripts)}\n" if scripts else "")
    return text[:3000]


def fetch(url: str) -> Dict[str, Any]:
    """{title, text, source_url} for one public repository."""
    owner, repo = parse(url)
    meta = _get(f"/repos/{owner}/{repo}")
    if meta is None:
        raise GitHubError(f"{owner}/{repo} is not a public repository")
    langs = _get(f"/repos/{owner}/{repo}/languages") or {}
    total = sum(langs.values()) or 1
    lines = [f"Repository {meta['full_name']}"]
    if meta.get("description"):
        lines.append(f"Description: {meta['description']}")
    if meta.get("topics"):
        lines.append(f"Topics: {', '.join(meta['topics'])}")
    if langs:
        lines.append("Languages: " + ", ".join(f"{k} {round(100 * v / total)}%"
                                                for k, v in sorted(langs.items(), key=lambda x: -x[1])))
    if meta.get("homepage"):
        lines.append(f"Deployed at: {meta['homepage']}")
    for name in MANIFESTS:
        text = _get(f"/repos/{owner}/{repo}/contents/{name}", raw=True)
        if text:
            lines.append(f"\n{name}:\n{_deps(name, text)}")
    readme = _get(f"/repos/{owner}/{repo}/readme", raw=True)
    if readme:
        lines.append("\nREADME:\n" + readme[:README_LIMIT])
    return {"title": meta["full_name"], "text": "\n".join(lines), "source_url": meta["html_url"]}


def demo() -> None:
    assert parse("https://github.com/vercel/next.js") == ("vercel", "next.js")
    assert parse("https://github.com/a-b/c_d.git") == ("a-b", "c_d")
    assert parse("https://github.com/owner/repo/tree/main/src") == ("owner", "repo")
    for bad in ("https://gitlab.com/a/b", "http://169.254.169.254/latest", "github.com/a"):
        try:
            parse(bad)
            raise AssertionError(f"{bad} must be refused")
        except GitHubError:
            pass
    deps = _deps("package.json", json.dumps({"dependencies": {"react": "1", "next": "1"},
                                             "devDependencies": {"jest": "1"}, "scripts": {"test": "jest"}}))
    assert "react" in deps and "jest" in deps and "Scripts: test" in deps
    assert "Uses: Jest unit testing, Next.js, React" in deps, deps
    print("github ok: only github.com repositories · dependencies read as evidence")


if __name__ == "__main__":
    demo()
