#!/usr/bin/env bash
#
# provision.sh — take a brand-new Ubuntu 24.04 droplet from "just created" to
# "safe to point a domain at". Run ONCE, as root, over the DigitalOcean console
# or an initial SSH session.
#
#   scp deploy/provision.sh root@<droplet-ip>:/root/
#   ssh root@<droplet-ip> 'bash /root/provision.sh <your-ssh-public-key-file-contents>'
#
# It implements the hardening checklist in docs/HOSTING.md. Every step is
# idempotent: running it twice changes nothing the second time.
#
# What it deliberately does NOT do: install MySQL. The database is DigitalOcean
# Managed MySQL, reached over the VPC. A database on this box would be one disk
# failure away from unrecoverable, and this repo's whole backup story assumes
# the managed service's point-in-time restore sits behind it.

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-lyne}"
SSH_PUBKEY="${1:-}"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root"

if [ -z "$SSH_PUBKEY" ] && [ ! -s /root/.ssh/authorized_keys ]; then
  die "No SSH public key given and root has none. Pass your public key as the
       first argument, or you will lock yourself out when password login is
       disabled a few steps from now."
fi

# ── 1. Packages ──────────────────────────────────────────────────────────────
log "Updating packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq ca-certificates curl gnupg ufw fail2ban unattended-upgrades \
                      mysql-client jq git

# ── 2. Deploy user ───────────────────────────────────────────────────────────
log "Creating the ${DEPLOY_USER} user"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG sudo "$DEPLOY_USER"

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh"
if [ -n "$SSH_PUBKEY" ]; then
  echo "$SSH_PUBKEY" > "/home/${DEPLOY_USER}/.ssh/authorized_keys"
elif [ -s /root/.ssh/authorized_keys ]; then
  cp /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"

# ── 3. SSH hardening ─────────────────────────────────────────────────────────
# Written as a drop-in rather than an edit to sshd_config, so an OS upgrade
# that replaces the main file does not silently re-enable password login.
log "Hardening SSH (keys only, no root login)"
cat > /etc/ssh/sshd_config.d/99-lyne.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
EOF
sshd -t || die "sshd config is invalid — NOT restarting. Fix it before you log out."
systemctl restart ssh 2>/dev/null || systemctl restart sshd

# ── 4. Firewall ──────────────────────────────────────────────────────────────
# 80 and 443 only, plus SSH. Nothing else — the API is reached through Caddy on
# 443, and the database is reached outbound over the VPC.
log "Configuring the firewall"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

# ── 5. fail2ban ──────────────────────────────────────────────────────────────
log "Enabling fail2ban"
cat > /etc/fail2ban/jail.d/lyne.conf <<'EOF'
[sshd]
enabled  = true
maxretry = 4
bantime  = 1h
findtime = 10m
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# ── 6. Unattended security upgrades ──────────────────────────────────────────
log "Enabling unattended security upgrades"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable --now unattended-upgrades

# ── 7. Docker ────────────────────────────────────────────────────────────────
log "Installing Docker Engine + Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
                         docker-buildx-plugin docker-compose-plugin
fi
usermod -aG docker "$DEPLOY_USER"
systemctl enable --now docker

# Cap the log growth. A chatty container on a 4GB droplet fills the disk in
# weeks, and a full disk looks exactly like an application outage.
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
systemctl restart docker

# ── 8. Swap ──────────────────────────────────────────────────────────────────
# 4GB of RAM running a Node API, a Python model worker and docker build is
# close enough to the edge that the OOM killer is a real risk. 2GB of swap is
# cheap insurance; it is not a substitute for resizing when the metrics say so.
log "Adding 2GB swap"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

# ── 9. Timezone ──────────────────────────────────────────────────────────────
# The operational day is a Jamaica day. See the comment on the db service in
# docker-compose.yml — a UTC host rolls the date at 7pm local and empties every
# live screen.
log "Setting the timezone to America/Jamaica"
timedatectl set-timezone America/Jamaica

# ── 10. Application directory ────────────────────────────────────────────────
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" /srv/lyne
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" /srv/lyne/backups

log "Done."
cat <<EOF

  Next:
    1. Log in as the deploy user and confirm it works BEFORE closing this
       session:   ssh ${DEPLOY_USER}@<droplet-ip>
    2. Clone the repository into /srv/lyne.
    3. Fill in /srv/lyne/.env from deploy/env.production.example.
    4. Run deploy/init-managed-db.sh once against the managed database.
    5. Run deploy/deploy.sh.

  Verify this box with:  bash deploy/verify.sh

EOF
