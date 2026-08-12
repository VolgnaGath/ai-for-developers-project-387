### Hexlet tests and linter status:
[![Actions Status](https://github.com/VolgnaGath/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/VolgnaGath/ai-for-developers-project-387/actions)

## Деплой

Приложение опубликовано на Render и доступно по адресу:
**https://ai-for-developers-project-387-njkb.onrender.com**

Docker-образ собирается из корневого `Dockerfile` (multi-stage, Node.js 24 Alpine). При запуске контейнер поднимает backend на Express и раздаёт собранный фронтенд из `FRONTEND_DIST`. Порт берётся из переменной окружения `PORT`, bind — `0.0.0.0` (`HOST`).