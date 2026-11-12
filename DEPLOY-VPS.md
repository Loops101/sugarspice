# Deploying on a Linux VPS (Truehost Cloud VPS or any Ubuntu server)

The setup script installs everything, starts the shop, adds free HTTPS and sets up daily backups. It targets a fresh **Ubuntu 22.04 / 24.04** (or Debian 12) server with 1 vCPU and 1 GB RAM.

## Before you start

1. Buy the VPS and choose **Ubuntu 24.04** (or 22.04) as the operating system.
2. Buy your domain (for example `sugarspice.co.ke`) and add a DNS **A record** pointing the domain to the VPS's IP address. Wait until `ping yourdomain` shows that IP (minutes to a few hours).
3. Log in to the server: `ssh root@YOUR_SERVER_IP` (Windows 10/11 has `ssh` built in; PuTTY also works).

## Install

On your computer, zip is already made. Copy it to the server and run the script:

    scp sugar-spice-couture-store.zip root@YOUR_SERVER_IP:/root/
    ssh root@YOUR_SERVER_IP
    apt-get update && apt-get install -y unzip
    unzip sugar-spice-couture-store.zip && cd store
    DOMAIN=yourdomain.co.ke EMAIL=you@example.com ADMIN_EMAIL=you@example.com bash deploy/setup.sh

The script prints your owner password at the end (shown once). Then open `https://yourdomain.co.ke/admin`, sign in and change the password under **My account**.

Optional: set your own password with `ADMIN_PASSWORD=...` in front of the command.

## What it sets up

| Piece | Details |
|---|---|
| App | Runs as an unprivileged `shop` user in `/opt/shop/app`; restarts by itself if it crashes or the server reboots |
| Data | `/var/lib/shop` (orders, products, users, photos). Only the `shop` user can read it |
| Settings | `/etc/shop.env` (secrets, M-Pesa keys). Edit it, then `systemctl restart shop` |
| Web server | Nginx in front, with login and API rate limits and a 6 MB upload cap |
| HTTPS | Free Let's Encrypt certificate, renewed automatically |
| Firewall | Only SSH, HTTP and HTTPS are open; `fail2ban` blocks repeated bad SSH logins |
| Updates | Security updates install automatically |
| Backups | Every night at 02:30 to `/var/backups/shop`, 14 days kept |

## Do these after it is running

1. **Copy backups off the server.** A backup on the same machine does not survive losing the machine. From your computer, weekly:
   `scp root@YOUR_SERVER_IP:/var/backups/shop/shop-LATEST.tar.gz .`
   (Or ask your host for snapshot backups on the VPS.)
2. **Use SSH keys instead of passwords.** Add your key (`ssh-copy-id root@YOUR_SERVER_IP`), confirm key login works, then set `PasswordAuthentication no` in `/etc/ssh/sshd_config` and run `systemctl restart ssh`. Do not close your current session until the key login is tested.
3. **Add Cloudflare (free) in front of the domain** if you want faster loading from Kenya and extra protection.
4. **Test restoring a backup once**, before you need it:
   `systemctl stop shop && tar -xzf /var/backups/shop/shop-XXXX.tar.gz -C /var/lib/shop && chown -R shop:shop /var/lib/shop && systemctl start shop`

## Everyday commands

| Task | Command |
|---|---|
| Is the shop running? | `systemctl status shop` |
| See recent errors | `journalctl -u shop -n 50 --no-pager` |
| Restart | `systemctl restart shop` |
| Update to a new version | Upload the new zip, unzip it, and run the same `setup.sh` command again (your data and settings stay) |
| Run a backup now | `shop-backup` |
| Reset the owner password | `cd /opt/shop/app && sudo -u shop env $(cat /etc/shop.env | grep -v '^#' | xargs) npm run reset-admin -- "NewPassword123"` |

## Going live with M-Pesa

Fill in the `MPESA_*` lines in `/etc/shop.env` (the README explains each), keep `PUBLIC_URL` as your https address, then `systemctl restart shop`. Safaricom only needs to reach `https://yourdomain/api/payments/mpesa/callback/<secret>`. Test in the sandbox first.

Hosts sometimes block outgoing traffic or specific ports. If M-Pesa requests fail, run `curl -sS https://sandbox.safaricom.co.ke` on the server; any response (even an error page) means outgoing HTTPS works.

## Security notes

- Keep the server updated (automatic for security patches) and do not install anything else on it.
- Never share `/etc/shop.env`. It holds your session secret and payment keys.
- The shop stores data in one file. That is fine for a small shop; if you grow, ask for the PostgreSQL version.
