# RAENKO landing

Статическая витрина для направления AI-автоматизации и безопасности ботов.

## Структура

```text
/index.html
/assets/styles.css
/assets/main.js
/vercel.json
/robots.txt
/sitemap.xml
```

## Принципы

- `main` не менять без отдельного подтверждения.
- Рабочая ветка редизайна: `redesign`.
- Без серверной логики, cookies, localStorage и внешних API-запросов.
- Контакты ведут напрямую в Telegram, WhatsApp, Instagram и email.
- Security headers описаны в `vercel.json`.

## Проверка перед публикацией

1. Открыть сайт локально через обычный static server.
2. Проверить мобильную версию.
3. Проверить клики по Telegram, WhatsApp, Instagram и email.
4. Проверить заголовки после деплоя на Vercel.
5. Проверить, не остаётся ли `x-robots-tag: noindex` на production-домене.
