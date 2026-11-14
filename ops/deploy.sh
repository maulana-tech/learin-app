#!/usr/bin/env bash
# Executed via sudo on Ubuntu EC2. Dependencies run as ubuntu.
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run via sudo'; exit 1; }
archive=${1:?release archive required}
release_id=${2:?release ID required}
[[ $release_id =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]] || { echo 'Invalid release ID'; exit 1; }
root=/opt/sigap-project
release="$root/releases/$release_id"
current="$root/current"
env_file="$root/learis/agent/.env"
secrets_dir="$root/learis/agent/.secrets"
[[ -f $env_file ]] || { echo "Missing server configuration: $env_file"; exit 1; }
for tool in node python3 curl flock runuser; do command -v "$tool" >/dev/null; done
[[ $(node -p 'process.versions.node.split(".")[0]') == 20 ]] || { echo 'Install Node.js 20 on EC2'; exit 1; }
# ponytail: one EC2 deployment lock; use an orchestrator for multiple instances.
exec 9>/var/lock/learis-deploy.lock
flock -w 120 9
mkdir -p "$root/releases"
[[ ! -e $release ]] || { echo 'Release already exists; rerun the GitHub workflow'; exit 1; }
mkdir "$release"
tar -xzf "$archive" -C "$release" --no-same-owner
[[ -f $release/standalone/server.js && -f $release/learis/agent/api.py ]]
ln -s "$env_file" "$release/learis/agent/.env"
# core/config.py reads .env and .secrets/ai.env. Linked the same way as .env,
# and optional, because a server may keep everything in .env instead.
if [[ -d $secrets_dir ]]; then ln -s "$secrets_dir" "$release/learis/agent/.secrets"; fi
chown -R ubuntu:ubuntu "$release"
runuser -u ubuntu -- python3 -m venv "$release/learis/agent/.venv"
runuser -u ubuntu -- "$release/learis/agent/.venv/bin/pip" install \
  -r "$release/learis/agent/requirements.txt"
runuser -u ubuntu -- "$release/learis/agent/.venv/bin/python" -c \
  'import sys; sys.path.insert(0, sys.argv[1]); from core.config import CFG; assert CFG.database == "/var/lib/sigap/sigap.db", "Set absolute LEARIS_DB in the server .env"' \
  "$release/learis/agent"

# Overrides preserve the existing unit's user, environment, and restart settings.
agent_override=/etc/systemd/system/learis-agent.service.d/10-release.conf
web_override=/etc/systemd/system/learis-web.service.d/10-release.conf
mkdir -p "$(dirname "$agent_override")" "$(dirname "$web_override")"
backup=$(mktemp -d)
previous=$(readlink "$current" || true)
for name in agent web; do
  path_var="${name}_override"
  path=${!path_var}
  if [[ -f $path ]]; then cp "$path" "$backup/$name"; fi
done
switched=0
rollback() {
  code=$?
  trap - ERR
  if [[ $switched == 1 ]]; then
    echo 'Deployment failed; restoring previous service configuration'
    if [[ -n $previous ]]; then
      ln -s "$previous" "$current.rollback"
      mv -Tf "$current.rollback" "$current"
    else
      rm -f "$current"
    fi
    for name in agent web; do
      path_var="${name}_override"
      path=${!path_var}
      if [[ -f $backup/$name ]]; then cp "$backup/$name" "$path"; else rm -f "$path"; fi
    done
    systemctl daemon-reload || true
    systemctl restart learis-agent learis-web || true
  fi
  rm -rf "$backup"
  exit "$code"
}
trap rollback ERR
[[ ! -e $current || -L $current ]] || { echo "$current must be a symlink"; false; }
ln -s "$release" "$current.new"
switched=1
mv -Tf "$current.new" "$current"
cat > "$agent_override" <<UNIT
[Service]
WorkingDirectory=$current/learis/agent
ExecStart=
ExecStart=$current/learis/agent/.venv/bin/python $current/learis/agent/api.py
Environment=LEARIS_DB=/var/lib/sigap/sigap.db
UNIT
cat > "$web_override" <<UNIT
[Service]
WorkingDirectory=$current/standalone
ExecStart=
ExecStart=/usr/bin/node $current/standalone/server.js
Environment=NODE_ENV=production
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3000
Environment=LEARIS_API=http://127.0.0.1:8787
UNIT
systemctl daemon-reload
systemctl restart learis-agent learis-web
healthy=0
for attempt in $(seq 1 30); do
  if systemctl is-active --quiet learis-agent learis-web && \
      curl --fail --silent --max-time 5 http://127.0.0.1:8787/health >/dev/null && \
      curl --fail --silent --max-time 5 http://127.0.0.1:3000/login >/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done
[[ $healthy == 1 ]] || { echo 'Service health check failed'; false; }
trap - ERR
rm -rf "$backup"
# Keep only the 3 most recent releases to prevent disk exhaustion
(cd "$root/releases" && ls -dt */ 2>/dev/null | tail -n +4 | xargs -r rm -rf)
echo "Deployed $release_id"
