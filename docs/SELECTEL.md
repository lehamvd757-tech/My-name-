# Перенос raenko.pro с Vercel на Selectel

Статический сайт. Схема та же, что у ipraenko.ru: nginx, релизы в `/var/www/raenko/releases/<sha>`, симлинк `current`, откат переключением ссылки.

## Что нужно от владельца (выдаёт только он)
1. Сервер Selectel (Ubuntu 22.04/24.04, 1 vCPU / 1 ГБ достаточно) с белым IPv4. Можно использовать существующий VPS: конфиг самодостаточный и не затрагивает другие сайты.
2. Пользователь для деплоя с SSH-ключом и правом записи в `/var/www/raenko`.
3. В GitHub (Settings → Secrets and variables → Actions):
   - secret `DEPLOY_HOST`, secret `DEPLOY_USER`, secret `DEPLOY_SSH_KEY` (приватный ключ деплоя);
   - variable `DEPLOY_HOST_FINGERPRINT` — `ssh-keyscan -t ed25519 <host> | ssh-keygen -lf - -E sha256`.
4. Доступ к DNS домена raenko.pro.

## Подготовка сервера (один раз)
```bash
apt update && apt install -y nginx certbot
install -d -o deploy -g deploy /var/www/raenko/releases /var/www/letsencrypt
cp deploy/nginx/raenko.pro.conf /etc/nginx/conf.d/raenko.pro.conf
```
Сертификат нужен до включения блока `listen 443`. Порядок: временно оставить только блок `listen 80`, выпустить сертификат
`certbot certonly --webroot -w /var/www/letsencrypt -d raenko.pro -d www.raenko.pro`, затем вернуть полный конфиг, `nginx -t && systemctl reload nginx`.
Автопродление: `certbot renew` по таймеру (ставится вместе с пакетом); после обновления выполнять `systemctl reload nginx`.

## Первый деплой без переключения DNS
1. Actions → Deploy raenko.pro to Selectel → Run workflow (ветка `main`).
2. Проверка до смены DNS: `curl -sI --resolve raenko.pro:443:<IP> https://raenko.pro/` — ожидаем 200, CSP, `cache-control: no-cache`.
3. Открыть сайт с локальным `hosts` (`<IP> raenko.pro`) и проверить визуально, включая сцену главного экрана.

## Переключение DNS
1. За сутки до переключения снизить TTL записей A/AAAA/CNAME до 300 с.
2. Записи: `raenko.pro A <IP>`, `www.raenko.pro A <IP>` (или CNAME на apex). Старые записи Vercel удалить, AAAA — только если сервер имеет IPv6.
3. Не удалять проект Vercel минимум 7 суток: это мгновенный откат.

## Откат
- На Selectel: `ln -sfn /var/www/raenko/releases/<предыдущий sha> /var/www/raenko/current.rollback && mv -Tf /var/www/raenko/current.rollback /var/www/raenko/current`.
- На Vercel: вернуть прежние DNS-записи (при TTL 300 с откат занимает до 5 минут).

## Проверки после переключения
- Заголовки: CSP, nosniff, Referrer-Policy, Permissions-Policy, HSTS.
- `www` отдаёт 301 на apex; `http` отдаёт 301 на https.
- LCP ≤ 2,5 с, INP ≤ 200 мс, CLS ≤ 0,1 (для РФ-аудитории ожидается улучшение TTFB относительно Vercel).
- Сертификат: срок действия и автопродление (`certbot renew --dry-run`).

## Отличия от Vercel
- HSTS включён явно (на Vercel его добавляла платформа).
- Кэш: файлы с версией в имени (`-a1`, `-a2`) — год, `immutable`; `index.html`, `styles.css`, `main.js`, `scene.js` — `no-cache` (проверка по ETag). При смене содержимого файла с версией в имени нужно менять версию в имени.
- Служебные пути (`tools/`, `deploy/`, `docs/`, `vercel.json`, `README.md`) наружу не отдаются; в релиз они и так не попадают.
