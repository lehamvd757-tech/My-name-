#!/usr/bin/env bash
# Первичная настройка хостинга raenko.pro на сервере Selectel. Запускать под root.
#   bash setup-raenko.sh prepare        — пользователь, каталоги, временный vhost :80
#   bash setup-raenko.sh certificate    — сертификат (DNS-проверка; трафик пока идёт на Vercel)
#   bash setup-raenko.sh enable         — боевой vhost :443 (после сертификата)
#   bash setup-raenko.sh post-cutover   — после смены DNS: продление сертификата через webroot
# Скрипт идемпотентен. Любое изменение nginx проверяется "nginx -t"; при ошибке прежний конфиг возвращается.
# Трогает ТОЛЬКО: пользователь raenko-deploy, /var/www/raenko, /var/www/letsencrypt,
# /etc/nginx/sites-available|enabled/raenko.pro, сертификат raenko.pro. Чужие сайты не затрагиваются.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Запустите под root (sudo -i)"; exit 1; }

USER_NAME=raenko-deploy
WEBROOT=/var/www/raenko
ACME_ROOT=/var/www/letsencrypt
VHOST=/etc/nginx/sites-available/raenko.pro
ENABLED=/etc/nginx/sites-enabled/raenko.pro
CERT=/etc/letsencrypt/live/raenko.pro/fullchain.pem
HOOK_DIR=/tmp/raenko-acme
DEPLOY_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPHFRM2Oxm3csBf0k0mpWrAoA3OKFQ1IKkkWp04Ru8qd raenko-deploy@github-actions'

nginx_apply() {  # $1 — путь к новому vhost; при неудаче откат
  local new="$1" backup="" prepared; prepared="$(mktemp)"
  # Без IPv6 на сервере строки "listen [::]" ломают nginx -t, поэтому убираем их.
  if [ -e /proc/net/if_inet6 ]; then cp "$new" "$prepared"; else grep -v 'listen \[::\]' "$new" > "$prepared"; fi
  new="$prepared"
  [ -f "$VHOST" ] && { backup="$(mktemp)"; cp -a "$VHOST" "$backup"; }
  install -m 644 "$new" "$VHOST"
  ln -sfn "$VHOST" "$ENABLED"
  if nginx -t 2>/tmp/raenko-nginx-test.log; then
    systemctl reload nginx
    echo "nginx перезагружен"
  else
    echo "nginx -t не прошёл, откат:"; cat /tmp/raenko-nginx-test.log
    if [ -n "$backup" ]; then install -m 644 "$backup" "$VHOST"; else rm -f "$VHOST" "$ENABLED"; fi
    exit 1
  fi
}

step_prepare() {
  id "$USER_NAME" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$USER_NAME"
  passwd -l "$USER_NAME" >/dev/null
  install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" "/home/$USER_NAME/.ssh"
  printf '%s\n' "$DEPLOY_PUBKEY" > "/home/$USER_NAME/.ssh/authorized_keys"
  chown "$USER_NAME:$USER_NAME" "/home/$USER_NAME/.ssh/authorized_keys"; chmod 600 "/home/$USER_NAME/.ssh/authorized_keys"
  install -d -m 755 -o "$USER_NAME" -g "$USER_NAME" "$WEBROOT" "$WEBROOT/releases"
  install -d -m 755 "$ACME_ROOT"
  if [ ! -e "$WEBROOT/current" ]; then
    install -d -o "$USER_NAME" -g "$USER_NAME" "$WEBROOT/releases/bootstrap"
    printf '<!doctype html><title>raenko.pro</title><p>ok</p>\n' > "$WEBROOT/releases/bootstrap/index.html"
    chown "$USER_NAME:$USER_NAME" "$WEBROOT/releases/bootstrap/index.html"
    ln -sfn "$WEBROOT/releases/bootstrap" "$WEBROOT/current"; chown -h "$USER_NAME:$USER_NAME" "$WEBROOT/current"
  fi
  command -v certbot >/dev/null || { apt-get update -q && apt-get install -y -q certbot; }
  local tmp; tmp="$(mktemp)"
  cat > "$tmp" <<'CONF'
# Временный vhost: только HTTP. Боевой конфиг ставится шагом "enable".
server {
    listen 80;
    listen [::]:80;
    server_name raenko.pro www.raenko.pro;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { root /var/www/raenko/current; try_files $uri $uri/ =404; }
}
CONF
  nginx_apply "$tmp"
  echo "Готово: prepare"
}

step_certificate() {
  [ -f "$CERT" ] && { echo "Сертификат уже есть"; return; }
  install -d -m 1777 "$HOOK_DIR"
  cat > /usr/local/sbin/raenko-acme-auth <<'HOOK'
#!/usr/bin/env bash
# Вызывается certbot по разу на каждый домен: дописывает значение TXT в /tmp/raenko-acme/txt и ждёт файл ready (до 20 минут).
set -eu
d=/tmp/raenko-acme
printf '%s\n' "$CERTBOT_VALIDATION" >> "$d/txt"; chmod 666 "$d/txt"
# Флаг ready одноразовый: после него удаляется, чтобы второй вызов (www) снова ждал свою запись.
for i in $(seq 1 240); do [ -e "$d/ready" ] && { rm -f "$d/ready"; exit 0; }; sleep 5; done
echo "Таймаут ожидания DNS-записи"; exit 1
HOOK
  chmod 755 /usr/local/sbin/raenko-acme-auth
  rm -f "$HOOK_DIR/txt" "$HOOK_DIR/ready"
  # Вывод и лог certbot копируются в /tmp (читаемо для диагностики без root).
  trap 'cp -f /var/log/letsencrypt/letsencrypt.log /tmp/raenko-letsencrypt.log 2>/dev/null; chmod 644 /tmp/raenko-letsencrypt.log /tmp/raenko-certbot.out 2>/dev/null || true' EXIT
  certbot certonly --manual --preferred-challenges dns --manual-auth-hook /usr/local/sbin/raenko-acme-auth \
    --non-interactive --agree-tos --register-unsafely-without-email --cert-name raenko.pro -d raenko.pro -d www.raenko.pro 2>&1 | tee /tmp/raenko-certbot.out
  rm -rf "$HOOK_DIR" /usr/local/sbin/raenko-acme-auth
  echo "Готово: certificate"
}

step_enable() {
  [ -f "$CERT" ] || { echo "Нет сертификата — сначала certificate"; exit 1; }
  local conf; conf="$(dirname "$(readlink -f "$0")")/../nginx/raenko.pro.conf"
  [ -f "$conf" ] || conf="/root/raenko.pro.conf"
  [ -f "$conf" ] || { echo "Не найден raenko.pro.conf"; exit 1; }
  nginx_apply "$conf"
  echo "Готово: enable"
}

step_post_cutover() {
  certbot reconfigure --cert-name raenko.pro --authenticator webroot --webroot-path "$ACME_ROOT" --non-interactive
  certbot renew --cert-name raenko.pro --dry-run
  install -d /etc/letsencrypt/renewal-hooks/deploy
  printf '#!/bin/sh\nnginx -t && systemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
  chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
  echo "Готово: post-cutover (продление через webroot, dry-run успешен)"
}

case "${1:-}" in
  prepare) step_prepare ;;
  certificate) step_certificate ;;
  enable) step_enable ;;
  post-cutover) step_post_cutover ;;
  *) sed -n 2,7p "$0"; exit 2 ;;
esac
