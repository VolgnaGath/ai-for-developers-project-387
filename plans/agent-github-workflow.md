# План: агентская разработка в цикле GitHub (Call Calendar)

## 1. Цель

Встроить агента (OpenCode) в реальный цикл разработки репозитория: **issue → triage/разбор → PR → ревью и доработки → регулярные ночные проверки по расписанию**. Все действия агента выполняются в GitHub Actions от имени OpenCode GitHub App; коммиты, ветки, PR и комментарии приходят «от агента».

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
4. **AGENTS.md**: добавить раздел «Работа в GitHub Actions»: читать `CONTEXT.md` перед любыми правками; коммиты — Conventional Commits; ветки `opencode/…`; перед открытием PR — `npm run typecheck` и `npm test`; в PR указывать связь с issue.
5. **Шаблон issue** (`.github/ISSUE_TEMPLATE/`): bug_report (шаги воспроизведения, ожидаемое поведение, критерии приёмки) и feature_request — чтобы в агента попадали качественные входные данные.

## 4. Workflow-файлы (создаются в `.github/workflows/`)

### 4.1 `opencode.yml` — интерактивная работа по комментариям

- Триггеры: `issue_comment` и `pull_request_review_comment` (тип `created`), фильтр по `/oc` или `/opencode` в тексте.
- Разрешения: `id-token: write`; `actions/checkout@v6` с `persist-credentials: false`; шаг `anomalyco/opencode/github@latest` с `model: opencode/big-pickle` и `env: OPENCODE_API_KEY`.
- Покрывает: `/oc explain` в issue, `/oc fix` (ветка `opencode/…`, PR с ссылкой на issue), комментарии к общему обсуждению PR и к конкретным строкам (контекст файла/строки приходит автоматически).

### 4.2 `opencode-triage.yml` — автотриаж новых issues

- Триггер: `issues: opened`; условие — автор не бот (`!endsWith(…, '[bot]')`), чтобы агент не разбирал собственные issue из cron.
- Обязателен `prompt`: прочитать issue и контекст репозитория, оставить один комментарий — резюме, затронутые компоненты, вероятные причины, предложенный следующий шаг; проставить метки (`bug`/`feature`/`triage`). Код не менять.

### 4.3 `opencode-lighthouse.yml` — ночная проверка производительности

- Триггеры: `schedule` (`0 1 * * *`, 01:00 UTC) + `workflow_dispatch` для ручного запуска и отладки.
- Разрешения: `id-token: write`, `contents: write`, `pull-requests: write`, `issues: write` (cron-задача запускается без пользователя).
- Шаги: checkout → Node 24 → `npx lighthouse https://ai-for-developers-project-387-njkb.onrender.com --output=json` (категории performance/accessibility/seo/best-practices) → загрузка `lighthouse-report.json` как artifact → шаг OpenCode с `prompt`: сравнить LCP/CLS/INP и баллы категорий с `docs/performance-baseline.md`; при деградации >10% или просадке категории создать issue с метриками и рекомендациями, иначе — не создавать.
- **Бейзлайн**: `docs/performance-baseline.md` заполняется значениями из первого ручного (`workflow_dispatch`) прогона.

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
4. **Ночная проверка**: `opencode-lighthouse.yml` в 01:00 UTC генерирует отчёт, публикует артефакт и создаёт issue при регрессии → issue попадает в цикл через triage.

## 7. Проверка результата (чек-лист)

- [ ] GitHub App установлен; секрет `OPENCODE_API_KEY` добавлен; `model: opencode/big-pickle`.
- [ ] Все три workflow созданы и замержены в `main`; Actions запускаются.
- [ ] Артефакт 1: ответ агента в issue (`/oc explain`).
- [ ] Артефакт 2: автотриаж нового issue.
- [ ] Артефакт 3: PR агента по задаче из §5 + доработка после ревью-комментария `/oc`, CI зелёный.
- [ ] Артефакт 4: ручной (`workflow_dispatch`) прогон Lighthouse → JSON-артефакт, `docs/performance-baseline.md`, issue-регрессия при необходимости.
- [ ] `hexlet-check.yml` и `ci.yml` не изменены.

## 8. Риски и ограничения

- **Бизнес-контекст**: агент не знает домен → требования формулировать в issue явно (шаблоны §3.5).
- **Качество входа**: «garbage in, garbage out» → шаблоны issue + критерии приёмки.
- **Стоимость/лимиты**: бесплатная модель ограничена по времени и rate limits; при росте нагрузки — смена `model` на платную (одна строка в каждом workflow).
- **Безопасность**: ключи только в Secrets; минимальные permissions per-workflow; в публичных проектах ограничить право комментариев для вызова агента.
- **Сложные задачи**: декомпозировать на несколько issues, а не отдавать агенту один огромный.
