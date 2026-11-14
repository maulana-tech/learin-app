"""ops/deploy-docker-ssh.sh, run against fake ssh and scp: what it sends to the server, never a real host."""
import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "ops" / "deploy-docker-ssh.sh"

FAKE = """#!/usr/bin/env bash
# record the call and anything piped in (the remote script), then succeed
{ echo "CALL $(basename "$0") $*"; if [ ! -t 0 ]; then cat; fi; echo "END"; } >> "$LOG"
"""


class DeployDockerTest(unittest.TestCase):
    def run_deploy(self, known_hosts: str, **extra: str):
        tmp = Path(tempfile.mkdtemp())
        bin_dir = tmp / "bin"
        bin_dir.mkdir()
        for name in ("ssh", "scp"):
            f = bin_dir / name
            f.write_text(FAKE)
            f.chmod(f.stat().st_mode | stat.S_IEXEC)
        log = tmp / "calls.log"
        env = {**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}", "LOG": str(log),
               "EC2_HOST": "learis.example.com", "EC2_SSH_KEY": "PRIVATE KEY",
               "EC2_KNOWN_HOSTS": known_hosts, "IMAGE_WEB": "ghcr.io/x/learis-web:latest",
               "IMAGE_AGENTS": "ghcr.io/x/learis-agents:latest", **extra}
        r = subprocess.run(["bash", str(SCRIPT)], cwd=ROOT, env=env, capture_output=True, text=True,
                           stdin=subprocess.DEVNULL, timeout=60)
        return r, (log.read_text() if log.exists() else "")

    def test_alias_comes_from_the_known_hosts_line(self):
        for alias in ("sigap-ec2", "learis-ec2"):
            r, calls = self.run_deploy(f"{alias} ssh-ed25519 AAAATESTKEY")
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn(f"HostKeyAlias={alias}", calls)

    def test_deploys_to_opt_learis_and_moves_the_old_install_once(self):
        r, calls = self.run_deploy("sigap-ec2 ssh-ed25519 AAAATESTKEY")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("docker-compose.yml ubuntu@learis.example.com:/opt/learis/docker-compose.yml", calls)
        remote = calls.split("bash -s", 1)[1]
        self.assertIn("cd /opt/learis", remote)
        self.assertIn("-d /opt/sigap-project && ! -f /opt/learis/.migrated", remote)
        self.assertIn("docker compose -p sigap-project down", remote)
        self.assertIn("sigap-project_agent_data:/from:ro -v learis_agent_data:/to", remote)
        self.assertIn("mv /to/sigap.db /to/learis.db", remote)
        self.assertIn("starting the old one again", remote)       # rollback if the new stack fails
        self.assertNotIn("down -v", remote)                       # volumes are never deleted

    def test_refuses_bad_configuration(self):
        r, calls = self.run_deploy("not-a-host-key-line")
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(calls, "", "nothing is sent with a malformed known_hosts")
        r, _ = self.run_deploy("sigap-ec2 ssh-ed25519 AAAATESTKEY", EC2_HOST="bad host;rm")
        self.assertNotEqual(r.returncode, 0)

    def test_compose_has_no_leftovers(self):
        compose = (ROOT / "docker-compose.yml").read_text()
        self.assertIn("name: learis", compose)
        self.assertIn("LEARIS_DB=/app/data/learis.db", compose)
        self.assertNotIn("sigap", compose.lower())
        self.assertNotIn("postgres", compose.lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
