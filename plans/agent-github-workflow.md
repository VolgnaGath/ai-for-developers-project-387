# План: агентская разработка в цикле GitHub (Call Calendar)

## 1. Цель

Встроить агента (OpenCode) в реальный цикл разработки репозитория: **issue → triage/разбор → PR → ревью и доработки → регулярные ночные проверки по расписанию**. Все действия агента выполняются в GitHub Actions; коммиты, ветки, PR и комментарии приходят «от агента» (интерактив — от имени OpenCode GitHub App, triage/ночные прогоны — от `github-actions[bot]` через GITHUB_TOKEN).

**Готовые артефакты процесса (критерий приёмки):**

1. Ответ агента в issue (разбор задачи).
2. Пример triage/разбора задачи (автоматический комментарий при открытии issue).
3. PR с правками агента + доработки после ревью (комментарий `/oc` к строкам).
4. Scheduled workflow с отчётом ночной проверки (Lighthouse: JSON-артефакт + issue при регрессии).

## 2. Текущее состояние

- Репозиторий `VolgnaGath/ai-for-developers-project-387`, ветвление PR→main (squash), Conventional Commits, release-please.
- CI: `.github/workflows/ci.yml` (TypeSpec, синхронность generated, typecheck, unit/integration, build, e2e, smoke) и `.github/workflows/hexlet-check.yml` — **не трогаем**.
- Приложение: frontend (Vite+React+Mantine), backend (Express, in-memory), контракт в `main.tsp`; задеплоено на Render.
- Локально уже подключён opencode с провайдером Zen (`opencode/`).

## 3. Этап 0 — настройка интеграции

1. **GitHub App**: установить OpenCode GitHub App на репозиторий (автоматически делает `opencode github install`, либо вручную через `github.com/apps/opencode-agent`).
2. **Секрет**: получить Zen API-ключ (opencode.ai/auth) и добавить в `Settings → Secrets → Actions` как `OPENCODE_API_KEY`.
3. **Модель**: `opencode/big-pickle` — бесплатная модель Zen (0 $/1M токенов). Оговорки: free-период ограничен и у бесплатных моделей есть rate limits; смена на платную модель — это правка одного `model:` в каждом workflow + имя ключа.
4. **AGENTS.md**: добавить раздел «Работа в GitHub Actions»: читать `CONTEXT.md` перед любыми правками; коммиты — Conventional Commits; ветки `opencode/…`; в runner'е запускать `npm run typecheck` и `npm test`, e2e/smoke гоняет `ci.yml` после открытия PR; в PR указывать связь с issue. **Запрет**: не редактировать `.github/workflows/` (включая opencode-воркфлоу) — репортить, а не чинить. `OPENCODE_PERMISSION` не ограничиваем — bash нужен для `npm ci`/`npm test`.
5. **Шаблон issue** (`.github/ISSUE_TEMPLATE/`): bug_report (шаги воспроизведения, ожидаемое поведение, критерии приёмки) и feature_request — чтобы в агента попадали качественные входные данные.
6. **Метки триажа**: пред-создать `gh label create feature` и `gh label create triage` (`bug` уже существует) — без них агент не сможет проставить метки (GitHub API упадёт на несуществующей).

## 4. Workflow-файлы (создаются в `.github/workflows/`)

### 4.1 `opencode.yml` — интерактивная работа по комментариям

- Триггеры: `issue_comment` и `pull_request_review_comment` (тип `created`), фильтр по `/oc` или `/opencode` в тексте.
- **Ограничение вызова**: комментарий только от коллабораторов (`author_association` ∈ OWNER/MEMBER/COLLABORATOR) и не от ботов (`!contains(github.event.comment.user.login, '[bot]')`) — репозиторий публичный, иначе любой прохожий запустит код агента с правами App; бот-фильтр также защищает от self-trigger циклов (ответы агента — тоже `issue_comment`-события, они могут цитировать `/oc`).
- `concurrency: group: opencode-${{ github.event.issue.number || github.event.pull_request.number }}` — последний `/oc` отменяет предыдущий, гонки за ветку `opencode/…` исключены.
- Разрешения: `id-token: write`; `actions/checkout@v6` с `persist-credentials: false`; перед шагом OpenCode — `actions/setup-node@v5` (Node 24) + `corepack enable` + `npm ci` (чтобы агент мог выполнять `npm run typecheck`/`npm test` на актуальном окружении).
- Шаг `anomalyco/opencode/github@latest` с `model: opencode/big-pickle`, `share: false` и `env: OPENCODE_API_KEY`. Аутентификация — App-токен через OIDC (id-token), GITHUB_TOKEN не используется.
- Режим строгий (без `continue-on-error`): сбой или лимиты модели видны в Actions, а не маскируются.
- Покрывает: `/oc explain` в issue, `/oc fix` (ветка `opencode/…`, PR с ссылкой на issue), комментарии к общему обсуждению PR и к конкретным строкам (контекст файла/строки приходит автоматически).

### 4.2 `opencode-triage.yml` — автотриаж новых issues

- Триггер: `issues: opened`; условие — автор не бот (`!endsWith(…, '[bot]')`): свои cron-issue агент не разбирает, полный разбор уже в самом issue.
- Триаж **открыт всем авторам** (read-only витрина для внешних issue): агент только комментирует и ставит метки, промпт-инъекция в тексте issue ограничена словами комментария. Если позже понадобится жёстче — один фильтр по `author_association` в `if`.
- Аутентификация: `use_github_token: true`, permissions `issues: write`, `contents: read` (GITHUB_TOKEN, а не App — явные минимальные права, не зависят от настроек App).
- Метки пред-созданы на Этапе 0: `bug`/`feature` + `triage`.
- Обязателен `prompt`: прочитать issue и контекст репозитория, оставить один комментарий — резюме, затронутые компоненты, вероятные причины, предложенный следующий шаг; проставить метки (`bug`/`feature`/`triage`). Код не менять.

### 4.3 `opencode-lighthouse.yml` — ночная проверка производительности

- Триггеры: `schedule` (`0 1 * * *`, 01:00 UTC) + `workflow_dispatch` для ручного запуска и отладки.
- Аутентификация: `use_github_token: true`, permissions `issues: write`, `contents: read` (cron-задача запускается без пользователя). **Агент никогда не пушит в `main`** — прямые пуши запрещены AGENTS.md, бейзлайн правит только человек через PR.
- Шаги: checkout → Node 24 → **warm-up** `curl` + пауза перед прогоном (Render free-tier усыпает контейнер; холодный старт в 01:00 UTC исказил бы метрики) → `npx lighthouse https://ai-for-developers-project-387-njkb.onrender.com --output=json` с `CHROME_PATH` и `--chrome-flags="--no-sandbox"` → загрузка `lighthouse-report.json` как artifact (**всегда**, независимо от наличия регрессии) → шаг OpenCode.
- `continue-on-error: true` — ночной прогон не шумит красным статусом при сбоях/лимитах модели.
- Промпт OpenCode: сравнить **баллы категорий** (performance/accessibility/seo/best-practices — первичный сигнал) и **LCP/CLS/INP** (вторично, чувствительны к холодному старту) с `docs/performance-baseline.md`; при деградации >10% или просадке категории создать issue в форме bug_report: метрики до/после, ссылка на артефакт, рекомендации; метка `bug` (метку `performance` не заводим). Иначе — не создавать. **Если baseline отсутствует — issue не создавать, только отчитаться. При недоступности модели — завершиться.**
- **Бейзлайн** `docs/performance-baseline.md`: markdown-таблица с полями `date`, `url`, `performance`, `accessibility`, `seo`, `best-practices`, `lcp_ms`, `cls`, `inp_ms` и пометкой, что метрики сняты при холодном старте. Фиксированный снапшот из первого ручного (`workflow_dispatch`) прогона; обновляется только осознанным PR человека — чтобы порог не «дрейфовал» вместе с хостингом.

Ревью PR — только по требованию: отдельный auto-review workflow не добавляем (по решению), работа через `opencode.yml` (комментарии к PR/строкам).

## 5. План разработки — бэклог задач для агента (создаются как issues)

**Фичи:**

- **F1. `.ics`-приглашение на странице подтверждения брони** — кнопка «Добавить в календарь» на `/book/success`, генерация iCalendar на фронте из данных `Booking` (UI-подпись, никаких новых API).
- **F2. Фильтр диапазона дат в «Предстоящих встречах»** — админка `/admin/bookings`: контролы `from`/`to`; backend `listBookings` уже поддерживает обе границы — правки только на фронте (+ MSW/e2e).

**Баги:**

- **B1. «Сегодня» и окно бронирования устаревают при долго открытой вкладке** — «сегодня» вычисляется из `todayInZone()` при рендере; вкладка, оставшаяся открытой за полночь (в таймзоне конфига), продолжает показывать старый день и окно 14 дней. Исправление: пересчёт даты по смене календарного дня (timer + `visibilitychange`/`focus`), сброс выбранной даты за пределы окна.
- **B2. A11y-замечания из ночного Lighthouse-отчёта** — по результатам первого прогона Lighthouse: контраст текста, видимый focus, aria-атрибуты в календаре/списке слотов. Issue формулируется по конкретным находкам из отчёта (связывает cron-проверку с циклом разработки).

Каждая задача — отдельный issue по шаблону: описание, шаги воспроизведения, ожидаемое поведение, критерии приёмки, команды проверки (`npm run typecheck`, `npm test`, `npm run e2e`).

## 6. Сценарии работы агента

1. **Issue → разбор**: открываем issue → `opencode-triage.yml` комментирует (артефакт «triage»); при необходимости `/oc explain`.
2. **Issue → исправление → PR**: комментарий `/oc fix this` в issue → агент создаёт ветку `opencode/…`, реализует, открывает PR (Conventional Commits, связь с issue). CI в `ci.yml` проверяет PR.
3. **Ревью и доработки**: ревьюер оставляет комментарий к строке с `/oc` → агент коммитит правку в ту же ветку PR → PR повторно проходит CI → squash-merge.
4. **Ночная проверка**: `opencode-lighthouse.yml` в 01:00 UTC генерирует отчёт, публикует артефакт и создаёт issue при регрессии → issue виден в бэклоге (триаж cron-issues не разбирает); решение по нему — через комментарий `/oc` человека.

## 7. Проверка результата (чек-лист)

- [x] GitHub App установлен (installation id 153520440, app_slug `opencode-agent`); секрет `OPENCODE_API_KEY` добавлен; `model: opencode/big-pickle`.
- [x] Метки `feature`/`triage` созданы (Этап 0).
- [x] `opencode.yml`: `share: false`, concurrency-guard, ограничение триггера коллабораторами + бот-фильтр, setup-node (Node 24) + `npm ci` перед шагом OpenCode. **Отклонение**: после первого прогона переведён на `use_github_token: true` (PR #19) из-за upstream-бага anomalyco/opencode#37823 (новый immutable OIDC `sub` ломает обмен App-токеном на репозиториях, созданных после 2026-07-15; `Failed to parse JSON` → `p.rest`). Комментарии приходят от `github-actions[bot]`, а не от App; при фиксе upstream — вернуть App-аутентификацию.
- [x] `opencode-triage.yml` и `opencode-lighthouse.yml`: `use_github_token: true` с минимальными permissions.
- [x] `opencode-lighthouse.yml`: warm-up, artifact всегда, `continue-on-error: true`.
- [x] Все три workflow созданы и замержены в `main`; Actions запускаются (opencode и triage — зелёные прогоны; lighthouse — ещё не запускался).
- [x] Артефакт 1: ответ агента в issue (`/oc explain`) — разбор B1 в issue #7.
- [x] Артефакт 2: автотриаж нового issue — issue #17 (комментарий + метки `bug`/`triage`).
- [ ] Артефакт 3: PR агента по задаче из §5 (B1) + доработка после ревью-комментария `/oc`, CI зелёный.
- [ ] Артефакт 4: ручной (`workflow_dispatch`) прогон Lighthouse → JSON-артефакт, `docs/performance-baseline.md` создан и закоммичен PR-ом человека, issue-регрессия при необходимости.
- [x] Проверено, что падение Render MCP без `RENDER_API_TOKEN` в runner'е некритично (зелёный интерактивный прогон без упоминаний MCP в логе).
- [x] `hexlet-check.yml` и `ci.yml` не изменены.

## 8. Риски и ограничения

- **Бизнес-контекст**: агент не знает домен → требования формулировать в issue явно (шаблоны §3.5).
- **Качество входа**: «garbage in, garbage out» → шаблоны issue + критерии приёмки.
- **Публичный репозиторий**: вызов интерактивного агента ограничен коллабораторами (Q1), self-trigger исключён бот-фильтром; триаж — read-only (комментарий + метки) и открыт всем, промпт-инъекция ограничена словами комментария.
- **Холодный старт Render**: контейнер free-tier усыпает, ночной прогон в 01:00 UTC почти гарантированно холодный → LCP/INP искажены; первичный сигнал — баллы категорий + warm-up; бейзлайн фиксированный, не дрейфует с хостингом.
- **Render MCP в CI**: `opencode.json` подключает Render MCP с `{env:RENDER_API_TOKEN}`, в runner'е токена нет → попытка подключения падает при каждом запуске; проверить безвредность на первом артефактном прогоне, токен в CI не заводить.
- **Стоимость/лимиты**: бесплатная модель ограничена по времени и rate limits; интерактив fail loudly, nightly `continue-on-error`; при росте нагрузки — смена `model` на платную (одна строка в каждом workflow).
- **Безопасность**: ключи только в Secrets; минимальные permissions per-workflow (GITHUB_TOKEN для triage/lighthouse и — временно, до фикса #37823 — для интерактива; App — для интерактива после фикса upstream).
- **Сложные задачи**: декомпозировать на несколько issues, а не отдавать агенту один огромный.
