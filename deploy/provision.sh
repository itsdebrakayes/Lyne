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

# Node 20 LTS. deploy.sh builds the admin PWA on the host, so this is a hard
# requirement of deploying, not a convenience — see section 7b.
NODE_VERSION="${NODE_VERSION:-v20.20.2}"

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

# ── 2b. What ${DEPLOY_USER} may do as root ───────────────────────────────────
# ${DEPLOY_USER} is created with --disabled-password and added to the sudo group.
# Those two facts together mean it CANNOT actually sudo: the account has no
# password, PAM has nothing to authenticate, and `sudo` fails. Root SSH login is
# switched off in the next section. So after this script, the only route to a
# root shell on this box is the DigitalOcean web console.
#
# That is deliberate, and it is documented in deploy/README.md so it is not
# discovered at a bad moment. But it is worth being honest about how much
# security it actually buys: ${DEPLOY_USER} is in the `docker` group, and anyone
# who can run docker can start a privileged container with the host filesystem
# mounted and be root in one command. Withholding sudo does not contain a
# compromise of this account — it only slows down the person operating the box.
#
# So rather than blanket NOPASSWD (no real gain, and it hides the above) or
# nothing at all (verify.sh reports false failures forever), one narrow rule:
# the two READ-ONLY commands the hardening checklist needs and cannot run
# unprivileged. Neither changes anything.
log "Allowing ${DEPLOY_USER} the read-only root checks verify.sh needs"
cat > "/etc/sudoers.d/90-${DEPLOY_USER}-verify" <<EOF
# Read-only checks for deploy/verify.sh. Nothing here modifies the system.
# Full root is the DigitalOcean web console by design — see deploy/README.md.
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/sbin/ufw status, /usr/sbin/ufw status verbose, /usr/sbin/sshd -T
EOF
chmod 440 "/etc/sudoers.d/90-${DEPLOY_USER}-verify"
# A malformed sudoers file can lock root out of sudo entirely, so it is checked
# before it is left in place, and removed rather than kept if it does not parse.
visudo -cf "/etc/sudoers.d/90-${DEPLOY_USER}-verify" >/dev/null \
  || { rm -f "/etc/sudoers.d/90-${DEPLOY_USER}-verify"; die "the sudoers drop-in did not parse and has been removed"; }

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

# ── 7b. Node.js ──────────────────────────────────────────────────────────────
# deploy.sh builds the admin PWA ON THE HOST (`npm ci && npx vite build`),
# because apps/admin-desktop's own `npm run build` also runs electron-builder,
# which wants a desktop toolchain this droplet does not have. So the droplet
# needs npm — and a droplet provisioned without it fails at the admin build with
# "npm: command not found", several steps after the point you would look.
#
# The official tarball rather than NodeSource: one fewer third-party apt
# repository with root-equivalent trust on this box, and the checksum is
# verified below against the signed SHASUMS256.txt from nodejs.org.
#
# Installed into /usr/local so every user has it, including root for
# maintenance. (It was first installed by hand under ~lyne/.local/node on the
# live droplet; this is the same version, where a fresh box will find it.)
log "Installing Node.js ${NODE_VERSION}"
if [ "$(node --version 2>/dev/null || echo none)" != "${NODE_VERSION}" ]; then
  case "$(dpkg --print-architecture)" in
    amd64) NODE_ARCH=x64 ;;
    arm64) NODE_ARCH=arm64 ;;
    *) die "unsupported architecture $(dpkg --print-architecture) for a Node tarball install" ;;
  esac

  NODE_TGZ="node-${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
  NODE_TMP="$(mktemp -d)"
  trap 'rm -rf "$NODE_TMP"' EXIT

  curl -fsSL -o "${NODE_TMP}/${NODE_TGZ}" \
    "https://nodejs.org/dist/${NODE_VERSION}/${NODE_TGZ}" \
    || die "could not download ${NODE_TGZ} from nodejs.org"
  curl -fsSL -o "${NODE_TMP}/SHASUMS256.txt" \
    "https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt" \
    || die "could not download the Node checksum file"

  # Verify BEFORE unpacking. An unverified tarball unpacked into /usr/local is
  # arbitrary code with root's permissions.
  ( cd "$NODE_TMP" && grep " ${NODE_TGZ}\$" SHASUMS256.txt | sha256sum -c - ) \
    || die "the Node tarball failed its checksum — do NOT unpack it. Retry, and if it fails again stop and investigate."

  tar -xJf "${NODE_TMP}/${NODE_TGZ}" -C /usr/local --strip-components=1 \
      --exclude CHANGELOG.md --exclude LICENSE --exclude README.md
  rm -rf "$NODE_TMP"
  trap - EXIT
fi

command -v node >/dev/null || die "Node installed but is not on PATH"
printf '    node %s, npm %s\n' "$(node --version)" "$(npm --version)"

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
