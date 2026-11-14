#!/usr/bin/env bash
# Deploy LEARIS to EC2: pull the GHCR images and restart the Compose stack over SSH.
#
# The first deploy after the SIGAP → LEARIS rename moves the server once, keeping all data:
# /opt/sigap-project → /opt/learis, its data volume copied (the old one kept as a backup),
# sigap.db renamed learis.db. If the new stack fails to start, the old one is started again.
set -Eeuo pipefail

for key in EC2_HOST EC2_SSH_KEY EC2_KNOWN_HOSTS IMAGE_WEB IMAGE_AGENTS; do
  [[ -n ${!key:-} ]] || { echo "Missing configuration: $key"; exit 1; }
done

[[ $EC2_HOST =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || { echo 'Invalid EC2_HOST'; exit 1; }

umask 077
ssh_dir=$(mktemp -d)
target="ubuntu@$EC2_HOST"
APP_DIR=/opt/learis
OLD_DIR=/opt/sigap-project

cleanup() {
  rm -rf "$ssh_dir"
}
trap cleanup EXIT

printf '%s\n' "$EC2_SSH_KEY" | tr -d '\r' > "$ssh_dir/key"
printf '%s\n' "$EC2_KNOWN_HOSTS" | tr -d '\r' > "$ssh_dir/known_hosts"

# The host key line names its alias ("learis-ec2 ssh-ed25519 …", or the older "sigap-ec2 …"):
# use whichever the secret holds, so the secret never has to change for a rename.
alias_name=$(awk 'NF >= 3 { print $1; exit }' "$ssh_dir/known_hosts")
[[ $alias_name =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || { echo 'EC2_KNOWN_HOSTS must be "<alias> <key-type> <key>"'; exit 1; }

ssh_options=(
  -i "$ssh_dir/key"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes
  -o "HostKeyAlias=$alias_name"
  -o "UserKnownHostsFile=$ssh_dir/known_hosts"
  -o ConnectTimeout=15
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=4
)

echo "==> Verifying SSH connection to $EC2_HOST (host key alias: $alias_name)..."
ssh "${ssh_options[@]}" -T "$target" "echo 'SSH connection verified'"

echo "==> Uploading docker-compose.yml..."
ssh "${ssh_options[@]}" -T "$target" "mkdir -p $APP_DIR/learis/agent 2>/dev/null || { sudo -n mkdir -p $APP_DIR/learis/agent && sudo -n chown -R \$(id -u):\$(id -g) $APP_DIR; }"
scp "${ssh_options[@]}" docker-compose.yml "$target:$APP_DIR/docker-compose.yml"

echo "==> Deploying containers on EC2..."
ssh "${ssh_options[@]}" -T "$target" "bash -s" <<REMOTE
set -Eeuo pipefail
export IMAGE_WEB="$IMAGE_WEB"
export IMAGE_AGENTS="$IMAGE_AGENTS"

if [[ -n "${GHCR_TOKEN:-}" && -n "${GHCR_USER:-}" ]]; then
  echo "${GHCR_TOKEN:-}" | docker login ghcr.io -u "${GHCR_USER:-}" --password-stdin
fi

cd $APP_DIR
echo "--> Pulling images..."
docker compose pull

migrated=0
if [[ -d $OLD_DIR && ! -f $APP_DIR/.migrated ]]; then
  echo "--> One-time move from $OLD_DIR to $APP_DIR (data kept)"
  [[ -f $APP_DIR/learis/agent/.env ]] || cp $OLD_DIR/learis/agent/.env $APP_DIR/learis/agent/.env
  # stop the old stack; its volumes stay, as a backup
  (cd $OLD_DIR && docker compose -p sigap-project down --remove-orphans) || true
  docker volume create learis_agent_data >/dev/null
  if docker volume inspect sigap-project_agent_data >/dev/null 2>&1; then
    docker run --rm --entrypoint sh -v sigap-project_agent_data:/from:ro -v learis_agent_data:/to "\$IMAGE_AGENTS" \
      -c 'cp -a /from/. /to/ && if [ -f /to/sigap.db ] && [ ! -f /to/learis.db ]; then mv /to/sigap.db /to/learis.db; fi'
  fi
  migrated=1
fi

echo "--> Starting containers..."
if ! docker compose up -d --remove-orphans; then
  if [[ \$migrated == 1 ]]; then
    echo "!! New stack failed to start: starting the old one again"
    docker compose down || true
    (cd $OLD_DIR && docker compose -p sigap-project up -d) || true
  fi
  exit 1
fi
[[ \$migrated == 1 ]] && date -u > $APP_DIR/.migrated

echo "--> Cleaning up unused images..."
docker image prune -f

echo "--> Container status:"
docker compose ps
REMOTE

echo "==> Deployment completed successfully!"
