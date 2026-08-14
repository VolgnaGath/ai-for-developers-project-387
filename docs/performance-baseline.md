# Performance baseline

Фиксированный снапшот метрик Lighthouse из первого ручного прогона `opencode-lighthouse.yml` (`workflow_dispatch`, run 31839420731). Метрики сняты при **холодном старте** Render-контейнера (free tier, контейнер усыпает): LCP может быть завышен, первичный сигнал регрессии — баллы категорий.

Бейзлайн обновляется только осознанным PR человека — чтобы порог не «дрейфовал» вместе с хостингом.

| date | url | performance | accessibility | seo | best-practices | lcp_ms | cls | inp_ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-14 | https://ai-for-developers-project-387-njkb.onrender.com | 96 | 91 | 82 | 100 | 2222 | 0 | n/a |

INP (interaction-to-next-paint) отсутствует (`n/a`): во время аудита на странице не было взаимодействий. Если в отчёте INP появится — сравнивать с ним, иначе игнорировать.
