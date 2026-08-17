# AGENTS.md

Call Calendar — бронирование звонков: владелец публикует типы событий, гости бронируют слоты без аккаунта. Перед любой работой читай `CONTEXT.md` (глоссарий доменных терминов): домен — на русском, код и API — на английском.

## Структура

- **API-контракт** — TypeSpec: `main.tsp` → `npm run generate` → `tsp-output/schema/openapi.yaml` (закоммичен). После правок `main.tsp` перегенерируй и закоммить и сгенерированный файл.
- **Backend** — npm workspace `backend/` (Express 5, TypeScript/ESM, router и типы генерятся из OpenAPI в `backend/src/generated/`). Хранилище in-memory (`store.ts`), все данные теряются при перезапуске. Стартует с двумя предзаполненными типами событий: `evt_consultation` (30 мин) и `evt_onboarding` (15 мин). Ключевые файлы: `config.ts` (хардкод `PublicConfig`: Europe/Moscow, Пн-Пт 09:00-18:00, шаг 15 мин, окно 14 дней), `calendar.ts` (генерация слотов через Temporal API), `handlers.ts` (обработчики маршрутов).
- **Фронтенд** — npm workspace `frontend/` (Vite + React 19 + Mantine 8 + React Router + TanStack Query). Вход: `frontend/src/main.tsx`; маршруты: `frontend/src/app/router.tsx`; страницы: `frontend/src/pages/`; фичи: `frontend/src/features/` (booking, event-types); API-клиент и общие модули: `frontend/src/shared/`.
- **Документация** — `CONTEXT.md` (глоссарий доменных терминов); `docs/adr/` — ADR (в т.ч. вся календарная логика живёт в `PublicConfig.timezone`); `docs/TESTING.md` — стратегия тестирования и пользовательские сценарии; `plans/` — планы разработки.
- **Деплой** — `Dockerfile` (multi-stage: сборка frontend + backend, runtime — Node 24 с нативной поддержкой TS). Деплой на Render.
- **Opencode** — `opencode.json` — MCP-плагин Render для деплоя; `.opencode/` — плагин `@opencode-ai/plugin`.

## Команды (из корня)

- `npm run dev` — Vite dev на порту 5173 (`strictPort`; порт занят — не запустится, не меняй порт).
- `npm run typecheck` — проверка типов фронта и backend.
- `npm run build` — прод-сборка фронта (`tsc -b && vite build`) и backend (`tsc -b`).
- `npm test` — тесты фронта (Vitest) и backend (Vitest + Supertest, unit и HTTP integration).
- `npm run e2e` — Playwright e2e (поднимает отдельный Vite на 5199, MSW перехватывает запросы; браузеры ставит `npx playwright install chromium`).
- `npm run e2e:smoke` — Playwright smoke с реальным backend без MSW: поднимает backend (`backend/`, порт 4020) и Vite на 5199 с `VITE_API_BASE_URL` на backend; генерирует бронь и проверяет её в админке. Чистый прогон: retries выключены, чтобы не «загрязнять» in-memory Map повторами.
- `npm run check` — компиляция TypeSpec без генерации.
- `npm run generate` — генерация OpenAPI из `main.tsp`.
- `npm run check:generated` — перегенерация TypeSpec, backend-кодгена и frontend-типов и проверка, что нет diff.
- `npm run api:mock` — мок-сервер Prism (`prism mock tsp-output/schema/openapi.yaml -p 4010`), совпадает с `VITE_API_BASE_URL` в `.env.example`.

## Готовые ловушки

- Адрес API задаётся только через `VITE_API_BASE_URL` (`frontend/.env.example`); Vite-прокси нет — прод-сборка работает с отдельно запущенным backend. Backend принимает env: `PORT` (по умолчанию 4010), `HOST` (127.0.0.1), `FRONTEND_ORIGIN` (http://localhost:5173), `FRONTEND_DIST` (опционально, путь к собранным статикам frontend для SPA-fallback).
- Мок-сервер Prism (`npm run api:mock`, порт 4010) работает на примерах из `main.tsp` (`@example`/`@opExample`). Это ограничение Prism: примеры слотов статичны и со временем выходят из окна бронирования; stateful/негативные сценарии покрыты MSW в e2e (`frontend/src/test/mocks/handlers.ts`). Новые примеры добавляй в `main.tsp` и перегенерируй OpenAPI.
- **Нет lint.** Тесты: Vitest (юниты) и Playwright+MSW (e2e). Проверка после правок: `npm run typecheck` + `npm run check`; для фронта — ещё `npm test` и `npm run e2e`.
- Не создавай ручные копии типов `EventType`/`Booking`/`Slot` — они генерятся из OpenAPI и ре-экспортируются из `shared/api`.
- `.github/workflows/hexlet-check.yml` — системный CI Hexlet, не редактируй его и README-бейдж; тесты Hexlet идут на каждый push. Отдельный CI `.github/workflows/ci.yml` (Node.js 24) проверяет TypeSpec, синхронность generated-файлов, typecheck, unit/integration-тесты, прод-сборку и Playwright (e2e + real-backend smoke). `.github/workflows/release.yml` — release-please: на push в `main` открывает или обновляет release-PR с changelog и предложенной версией (только при коммитах `feat`/`fix`/`deps`).
- Пользовательские сценарии и уровни тестов зафиксированы в `docs/TESTING.md`.
- Админка (`/admin/*`) доступна без аутентификации — осознанное решение для MVP.

## Рабочий процесс

- Все изменения — через pull request в `main`; прямых пушей в `main` нет.
- Ветка — короткая, с префиксом типа коммита: `feat/`, `fix/`, `docs/`, `ci/`, `test/` и т.п.
- Каждое изменение — отдельный commit; сообщения — по Conventional Commits (см. «Коммиты»).
- Перед открытием PR: `npm run typecheck`; при изменении логики — `npm test`; при изменении фронта — `npm run e2e`; при изменении пути бронирования с реальным backend — `npm run e2e:smoke`; при изменении `main.tsp` — `npm run check` и `npm run generate`.
- Открыть PR в `main`, дождаться зелёного CI, затем merge.
- Merge — squash: заголовок PR (становится squash-коммитом) — тоже Conventional Commits сообщение.
- Release-PR от release-please мерджим без ручных правок — он бампает версию, обновляет changelog и тегает релиз.

## Коммиты

Сообщения коммитов — по спецификации Conventional Commits: `type(scope): subject`. Агент пишет коммиты по этому же формату.

- Допустимые типы: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `perf`, `style`, `build`.
- Subject — на английском, в инфинитиве, без точки в конце; scope — по желанию.
- Тело — по желанию: что и почему менялось, ссылки на PR/issue.
- Примеры: `feat: add guest booking form`, `fix: return 409 on double booking`, `test: cover slot conflicts`, `ci: add release-please`, `docs: describe user scenarios`.
- Релиз-PR открывает только коммит `feat`, `fix` или `deps`; для 0.x действует bump-minor-pre-major: `feat` → минорная версия, `fix` → патч. `docs`, `test`, `ci`, `chore`, `refactor` релиз не триггерят, но попадают в changelog при ближайшем релизе, вызванном другим коммитом.

## Работа в GitHub Actions

Запуски агента в GitHub Actions: интерактив по `/oc`-комментариям, автотриаж новых issues, ночная проверка Lighthouse.

- Перед любыми правками читай `CONTEXT.md`.
- Коммиты — Conventional Commits (см. «Коммиты»), ветки — `opencode/…`.
- Проверка в runner: `npm run typecheck` и `npm test`; e2e/smoke после открытия PR гоняет `ci.yml` — в runner их не запускай.
- В описании PR указывай связь с issue (`Closes #N`).
- **Запрет**: не редактируй `.github/workflows/` (включая opencode-воркфлоу) — если видишь в них проблему, отчитайся комментарием, а не чини.
- `OPENCODE_PERMISSION` не ограничен: bash нужен для `npm ci`/`npm test`.
