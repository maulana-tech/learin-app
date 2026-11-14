# CI/CD

One workflow, `.github/workflows/deploy.yml`.

| When | What runs |
|---|---|
| Every push and every PR into `main` | **CI**: eslint, `tsc`, unit tests, Next.js build, the agent service's 22 self-checks, and the deploy script's tests (fake `ssh`/`scp`, no server touched) |
| Push to `main` (after CI passes) | **Deploy**: build `learis-web` and `learis-agents` images, push them to GHCR, then `ops/deploy-docker-ssh.sh` |

## What the deploy does

`ops/deploy-docker-ssh.sh` connects to `ubuntu@$EC2_HOST` with strict host-key checking. It then:
1. uploads `docker-compose.yml` to **`/opt/learis`**;
2. pulls the images;
3. runs `docker compose up -d`.

The stack has two containers:
- `learis-agents`: the Python agent service, with SQLite in the `learis_agent_data` volume at `/app/data/learis.db`;
- `learis-web`: Next.js, on `127.0.0.1:3000` behind nginx (`ops/server-config/nginx-learis.conf`).

**The first deploy after the SIGAP → LEARIS rename moves the old install once, keeping all data:**
1. Copy `/opt/sigap-project/learis/agent/.env` to `/opt/learis/learis/agent/.env`.
2. Stop the old stack, keeping its volumes as a backup.
3. Copy the `sigap-project_agent_data` volume into `learis_agent_data`, and rename `sigap.db` → `learis.db`.
4. Start the new stack. If it fails to start, the old one is started again.
5. Write `/opt/learis/.migrated` so this never runs twice.

The agent service has the same safety net: if `learis.db` is missing and `sigap.db` sits next to it, it adopts it on startup.

## Repository settings

| Name | Kind | Value |
|---|---|---|
| `EC2_HOST` | variable | The server's public IP or DNS name. Use an **Elastic IP**: a plain public IP changes when the instance is stopped. |
| `EC2_SSH_KEY` | secret | The private key for `ubuntu@EC2_HOST` |
| `EC2_KNOWN_HOSTS` | secret | One line, `<alias> <key-type> <key>`, e.g. `learis-ec2 ssh-ed25519 AAAA…`. The alias is read from the line, so an older `sigap-ec2 …` line still works. |
| `GHCR_PAT` | secret, optional | A token with `read:packages` if the server cannot pull with the workflow token |

## When the deploy says "Host key verification failed"

The machine at `EC2_HOST` presents a different SSH host key than `EC2_KNOWN_HOSTS` holds. Either the
server was rebuilt, or its IP changed and now belongs to another machine. **Do not turn the check off.**

1. In the EC2 console, find the instance and its current public IP (or attach an Elastic IP).
2. Read its real host key fingerprint from the console: **Actions → Monitor and troubleshoot → Get system log**,
   the `ssh-ed25519` line between `BEGIN SSH HOST KEY FINGERPRINTS` and `END`.
3. From your machine, fetch the key and check that its fingerprint matches the console:
   ```bash
   ssh-keyscan -t ed25519 <IP> 2>/dev/null | tee /tmp/hostkey
   ssh-keygen -lf /tmp/hostkey        # must equal the fingerprint from step 2
   ```
4. Store it with an alias, and update the host:
   ```bash
   sed 's/^[^ ]*/learis-ec2/' /tmp/hostkey | gh secret set EC2_KNOWN_HOSTS
   gh variable set EC2_HOST --body <IP>
   ```
5. Point DNS (`learis.lumbungstack.dev`) at the same IP, then re-run the workflow (`gh run rerun <id>`).

## Split hosting: web on HackOnVibe, agent service on EC2

For HackOnVibe the web app is built and hosted by the organisers from the team repository
(`<repo>.hackonvibe.com`), where no environment variables can be set. In production it therefore
calls `https://api.learis.lumbungstack.dev` (`app/upstream.ts`); `LEARIS_API` still overrides it.

On the server, once per server:
1. DNS: an `A` record `api.learis.lumbungstack.dev` → the Elastic IP.
2. `sudo cp ops/server-config/nginx-learis-api.conf /etc/nginx/sites-available/learis-api`,
   `sudo ln -s /etc/nginx/sites-available/learis-api /etc/nginx/sites-enabled/`,
   `sudo nginx -t && sudo systemctl reload nginx`.
3. `sudo certbot --nginx -d api.learis.lumbungstack.dev`.
4. Check: `curl https://api.learis.lumbungstack.dev/health`.

The compose stack publishes the agent service on `127.0.0.1:8787` only; nginx is the one way in.

## Server `.env`

Template: `ops/server-config/agent.env.example`. It needs at least `LEARIS_ENV=prod` and a strong
`LEARIS_SECRET`. Add `AWS_BEARER_TOKEN_BEDROCK` to give everyone a model without their own key.
Never commit the real file.

## Check locally

```bash
python3 ops/test_deploy_docker.py
bash -n ops/deploy-docker-ssh.sh
docker compose config -q            # the compose file is valid
```
