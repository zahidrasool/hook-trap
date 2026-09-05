#!/bin/bash
# MockLane host bootstrap. Runs once at first boot.
# Log: /var/log/cloud-init-output.log
set -euxo pipefail

REGION="${aws_region}"
PARAM_PREFIX="${param_prefix}"
APP_DIR=/opt/mocklane

dnf update -y
dnf install -y docker git postgresql15 amazon-cloudwatch-agent cronie
systemctl enable --now crond

# ── Swap ─────────────────────────────────────────────────────────────────────
# A t4g.small has 2 GB, and `next build` will OOM without headroom.
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── Docker ───────────────────────────────────────────────────────────────────
systemctl enable --now docker
usermod -aG docker ec2-user

DOCKER_CLI_PLUGINS=/usr/local/lib/docker/cli-plugins
mkdir -p "$DOCKER_CLI_PLUGINS"
ARCH=$(uname -m)
curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$${ARCH}" \
  -o "$DOCKER_CLI_PLUGINS/docker-compose"
chmod +x "$DOCKER_CLI_PLUGINS/docker-compose"

# buildx is a hard requirement: Compose >= 2.x delegates `compose build` to it
# and fails with "compose build requires buildx 0.17.0 or later" otherwise. The
# Amazon Linux docker package does not ship it, so install it explicitly.
# The asset filename embeds the version, so resolve the tag first.
case "$ARCH" in
  aarch64) BUILDX_ARCH=arm64 ;;
  x86_64)  BUILDX_ARCH=amd64 ;;
  *)       BUILDX_ARCH=amd64 ;;
esac
BUILDX_TAG=$(curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest \
  | grep -o '"tag_name": *"[^"]*"' | head -1 | sed 's/.*: *"//;s/"//')
curl -fsSL "https://github.com/docker/buildx/releases/download/$${BUILDX_TAG}/buildx-$${BUILDX_TAG}.linux-$${BUILDX_ARCH}" \
  -o "$DOCKER_CLI_PLUGINS/docker-buildx"
chmod +x "$DOCKER_CLI_PLUGINS/docker-buildx"

# Cap log growth so the disk cannot fill with container output.
cat >/etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
systemctl restart docker

mkdir -p "$APP_DIR"

# ── Fetch configuration from SSM into an .env file ───────────────────────────
cat >/usr/local/bin/mocklane-env <<EOF
#!/bin/bash
# Regenerates $APP_DIR/.env from SSM Parameter Store.
set -euo pipefail
aws ssm get-parameters-by-path \
  --path "$PARAM_PREFIX" \
  --with-decryption \
  --recursive \
  --region "$REGION" \
  --query 'Parameters[].[Name,Value]' \
  --output text \
| while IFS=\$'\t' read -r name value; do
    echo "\$(basename "\$name")=\$value"
  done > "$APP_DIR/.env.tmp"
mv "$APP_DIR/.env.tmp" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"
EOF
chmod +x /usr/local/bin/mocklane-env

# ── Caddy config: automatic Let's Encrypt, replacing a $16/mo ALB ────────────
#
# /api/* and /h/* are routed to FastAPI here rather than via the Next.js
# rewrite in next.config.mjs. Two reasons:
#   - Next.js bakes rewrite destinations in at build time, so the API hostname
#     could not be changed without rebuilding the image.
#   - that destination was the public API hostname, which resolves to this
#     host's own Elastic IP. AWS does not hairpin traffic to your own EIP, so
#     every browser API call returned 500.
# Going straight to the container also drops a proxy hop and a TLS handshake.
cat >"$APP_DIR/Caddyfile" <<EOF
{
  email ${admin_email}
}

# www redirects to the apex rather than sharing its site block. Serving both
# hostnames from one block meant every page existed twice at HTTP 200 with no
# canonical, so search engines saw the whole site duplicated and had to guess
# which host was real.
www.${domain_name} {
  redir https://${domain_name}{uri} permanent
}

${domain_name} {
  # zstd and br before gzip: Brotli takes the docs page from 18 KB to 14 KB on
  # the wire. Clients that support neither still negotiate gzip.
  encode zstd br gzip

  # Only /api/v1/* belongs to FastAPI. Next.js owns /api/auth/* (the magic-link
  # callback and logout route handlers), so a blanket /api/* rule breaks login.
  handle /api/v1/* {
    reverse_proxy backend:8000
  }
  handle /h/* {
    reverse_proxy backend:8000
  }
  # Mock serving. Omitting this sent /m/ to Next.js, which 404'd every mock
  # endpoint on the apex domain while the same URL worked on api.<domain>.
  handle /m/* {
    reverse_proxy backend:8000
  }
  handle {
    reverse_proxy frontend:3000
  }
}

${api_domain} {
  encode zstd br gzip
  reverse_proxy backend:8000
}
EOF

# ── Nightly database backup ──────────────────────────────────────────────────
cat >/usr/local/bin/mocklane-backup <<EOF
#!/bin/bash
set -euo pipefail
STAMP=\$(date +%Y%m%d-%H%M%S)
FILE=/tmp/mocklane-\$STAMP.sql.gz
docker exec mocklane-postgres pg_dump -U mocklane mocklane | gzip > "\$FILE"
aws s3 cp "\$FILE" "s3://${backup_bucket}/postgres/mocklane-\$STAMP.sql.gz" --region "$REGION"
rm -f "\$FILE"
EOF
chmod +x /usr/local/bin/mocklane-backup
echo "30 3 * * * root /usr/local/bin/mocklane-backup >> /var/log/mocklane-backup.log 2>&1" \
  > /etc/cron.d/mocklane-backup

# ── systemd unit so the stack survives reboots and spot restarts ─────────────
cat >/etc/systemd/system/mocklane.service <<EOF
[Unit]
Description=MockLane application stack
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStartPre=/usr/local/bin/mocklane-env
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d --build
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable mocklane.service

# ── First deploy ─────────────────────────────────────────────────────────────
# Skipped when app_repo_url is empty; deploy manually with infrastructure/deploy.sh.
if [ -n "${app_repo_url}" ]; then
  git clone "${app_repo_url}" "$APP_DIR/src"
  cp "$APP_DIR/src/docker-compose.prod.yml" "$APP_DIR/docker-compose.prod.yml" || true
  /usr/local/bin/mocklane-env
  systemctl start mocklane.service
fi

echo "bootstrap complete"
