import "@typespec/http";

using TypeSpec.Http;

/**
 * Календарь звонков (MVP).
 *
 * Скоуп v1: без авторизации, без личных кабинетов, без внешних интеграций.
 * Владелец календаря — один заранее заданный профиль (админская часть).
 * Гость бронирует слоты без аккаунта и без входа.
 *
 * Доступность (рабочие часы, таймзона, шаг сетки, окно бронирования) —
 * фиксированный конфиг приложения, а не ресурс API (вариант A).
 * Наружу из конфига выставляется только `GET /config` для рендера календаря.
 */
@service(#{ title: "Call Calendar" })
namespace CallCalendar;

// ─────────────────────────────── Модели ───────────────────────────────

/** Тип события, которым управляет владелец. */
@example(
  #{
    id: "evt_consultation",
    title: "Консультация",
    description: "Короткий созвон, чтобы обсудить ваш вопрос.",
    durationMinutes: 30,
  },
)
model EventType {
  /** Идентификатор. Генерируется сервером. */
  id: string;

  title: string;
  description?: string;

  /** Длительность встречи. В v1 — только два режима. */
  durationMinutes: 15 | 30;
}

/**
 * Тело запроса на создание/изменение типа события.
 * Без `id` — его проставляет сервер; пользователь задаёт только нейминг.
 */
model EventTypeInput {
  @minLength(1)
  @maxLength(100)
  title: string;

  @maxLength(1000)
  description?: string;

  durationMinutes: 15 | 30;
}

/** Статус брони. В v1 — только подтверждённые: отмены/переноса нет. */
enum BookingStatus {
  confirmed,
}

/** Бронирование гостя. */
@example(
  #{
    id: "bk_001",
    eventTypeId: "evt_consultation",
    guestName: "Анна Иванова",
    guestEmail: "anna@example.com",
    start: utcDateTime.fromISO("2026-08-10T09:00:00+03:00"),
    end: utcDateTime.fromISO("2026-08-10T09:30:00+03:00"),
    status: BookingStatus.confirmed,
    createdAt: utcDateTime.fromISO("2026-08-05T10:00:00Z"),
  },
)
model Booking {
  id: string;
  eventTypeId: string;

  @minLength(1)
  guestName: string;

  @format("email")
  guestEmail?: string;

  start: utcDateTime;

  /** = `start` + `durationMinutes` типа события. Проставляет сервер. */
  end: utcDateTime;

  status: BookingStatus;
  createdAt: utcDateTime;
}

/** Корректный email. Сохраняется в исходном регистре, без lowercase. */
@format("email")
@maxLength(254)
scalar Email extends string;

/**
 * Пустая или состоящая только из пробелов строка.
 * Позволяет клиенту передать "заглушку" для email/описания:
 * backend после trim превращает её в отсутствие значения.
 */
@pattern("^\\s*$")
@maxLength(254)
scalar BlankString extends string;

/** Тело запроса на бронирование. */
model BookingInput {
  eventTypeId: string;

  /** Начало выбранного слота. Должно совпасть с одним из свободных слотов. */
  start: utcDateTime;

  @minLength(1)
  @maxLength(100)
  guestName: string;

  /** Пустая/whitespace-строка допустима только здесь — backend нормализует её в отсутствие поля. */
  guestEmail?: BlankString | Email;
}

/** Вычисляемый свободный слот (не хранится, только читается гостем). */
@example(
  #{
    start: utcDateTime.fromISO("2026-08-10T09:00:00+03:00"),
    end: utcDateTime.fromISO("2026-08-10T09:15:00+03:00"),
  },
)
model Slot {
  /** Начало слота. Смежные слоты допустимы: [start, end). */
  start: utcDateTime;

  end: utcDateTime;
}

/** Рабочие часы владельца — фиксированная часть конфига доступности. */
model WorkingHours {
  /** Дни недели приёма (1 = Пн … 7 = Вс). */
  days: int32[];

  /** Начало рабочего окна в таймзоне конфига, например "09:00". */
  start: string;

  /** Конец рабочего окна в таймзоне конфига, например "18:00". */
  end: string;
}

/** Публичная часть конфига доступности — нужна фронту для рендера календаря. */
@example(
  #{
    timezone: "Europe/Moscow",
    bookingWindowDays: 14,
    slotStepMinutes: 15,
    workingHours: #{
      days: #[1, 2, 3, 4, 5],
      start: "09:00",
      end: "18:00",
    },
  },
)
model PublicConfig {
  /** Например, "Europe/Moscow". */
  timezone: string;

  /** Окно бронирования: сегодня и следующие 13 календарных дат в таймзоне конфига. */
  bookingWindowDays: int32;

  /** Шаг сетки свободных слотов в минутах, в v1 — 15. */
  slotStepMinutes: int32;

  workingHours: WorkingHours;
}

// ─────────────────────────────── Ошибки ───────────────────────────────

@error
@example(#{ statusCode: 404, code: "not_found" })
model NotFound {
  @statusCode statusCode: 404;
  code: "not_found";
}

/** Слот уже занят к моменту брони (в т.ч. гонка двух гостей за один слот). */
@error
@example(#{ statusCode: 409, code: "slot_unavailable" })
model SlotUnavailable {
  @statusCode statusCode: 409;
  code: "slot_unavailable";
}

/**
 * `start` синтаксически корректен, но не является базовым кандидатом:
 * не бьётся с сеткой слотов, лежит вне окна бронирования или рабочих часов.
 * Malformed-поля тела запроса — это `400`, а не `422`.
 */
@error
@example(#{ statusCode: 422, code: "invalid_slot" })
model InvalidSlot {
  @statusCode statusCode: 422;
  code: "invalid_slot";
}

/** Нельзя удалить тип события, у которого есть существующие брони. */
@error
@example(#{ statusCode: 409, code: "event_type_has_bookings" })
model EventTypeHasBookings {
  @statusCode statusCode: 409;
  code: "event_type_has_bookings";
}

/**
 * Нельзя изменить длительность типа события, у которого есть существующие брони.
 * Название и описание менять можно; `durationMinutes` — нет.
 */
@error
@example(#{ statusCode: 409, code: "event_type_duration_locked" })
model EventTypeDurationLocked {
  @statusCode statusCode: 409;
  code: "event_type_duration_locked";
}

/**
 * Malformed JSON, отсутствующие или неверные поля, неверные query-параметры
 * и диапазон `from` > `to` в `listSlots`.
 */
@error
@example(#{ statusCode: 400, code: "bad_request" })
model BadRequest {
  @statusCode statusCode: 400;
  code: "bad_request";
}

/** Превышен лимит тела запроса (стандартный лимит `express.json()` в 100kb). */
@error
@example(#{ statusCode: 413, code: "payload_too_large" })
model PayloadTooLarge {
  @statusCode statusCode: 413;
  code: "payload_too_large";
}

/** Неожиданная внутренняя ошибка. Технические детали клиенту не раскрываются. */
@error
@example(#{ statusCode: 500, code: "internal_error" })
model InternalError {
  @statusCode statusCode: 500;
  code: "internal_error";
}

// ────────────────────── Владелец (админская часть) ──────────────────────

@route("/admin/event-types")
@get
op listEventTypes(): EventType[] | InternalError;

@route("/admin/event-types")
@post
op createEventType(@body body: EventTypeInput): EventType | BadRequest | InternalError;

@route("/admin/event-types/{id}")
@get
op getEventType(@path id: string): EventType | NotFound | InternalError;

@route("/admin/event-types/{id}")
@put
op updateEventType(
  @path id: string,
  @body body: EventTypeInput,
): EventType | NotFound | BadRequest | EventTypeDurationLocked | InternalError;

/**
 * Удалить тип события.
 * 409 — у типа события есть брони, удаление заблокировано.
 */
@route("/admin/event-types/{id}")
@delete
op deleteEventType(@path id: string): void | NotFound | EventTypeHasBookings | InternalError;

/**
 * Страница предстоящих встреч — общий список бронирований всех типов.
 *
 * `from` и `to` — включительные календарные даты в таймзоне конфига.
 * Диапазон `from` > `to` не является ошибкой: фильтр вырождается в пустой результат.
 */
@route("/admin/bookings")
@get
op listBookings(
  @query from?: plainDate,
  @query to?: plainDate,
): Booking[] | BadRequest | InternalError;

// ────────────────────── Гость (публичная часть) ──────────────────────

@route("/config")
@get
op getConfig(): PublicConfig | InternalError;

/** Витрина видов брони: название, описание, длительность. */
@route("/event-types")
@get
op browseEventTypes(): EventType[] | InternalError;

@route("/event-types/{id}")
@get
op viewEventType(@path id: string): EventType | NotFound | InternalError;

/**
 * Свободные слоты для типа события в диапазоне дат.
 *
 * `from` и `to` — включительные календарные даты, трактуются в таймзоне конфига
 * (`PublicConfig.timezone`). `from` > `to` — ошибка `400`.
 * Сервер пересекает [from, to] с окном бронирования (сегодня и следующие 13 дат
 * в таймзоне конфига) и рабочими часами из конфига, нарезает по длительности
 * типа события с шагом `slotStepMinutes` и вычитает пересечения с бронями.
 * Занятость владельца общая между всеми типами событий: любая бронь блокирует
 * пересекающиеся слоты любого типа. Слоты смежные допустимы: [start, end).
 * Диапазон, целиком лежащий вне окна бронирования, возвращает `200 []`.
 *
 * Пример ответа ниже нужен мок-серверу Prism. Даты статичны и со временем
 * выходят из окна бронирования — это ограничение Prism; stateful и негативные
 * сценарии покрывает MSW.
 */
@route("/event-types/{id}/slots")
@get
@opExample(
  #{
    returnType: #[
      #{
        start: utcDateTime.fromISO("2026-08-10T09:00:00+03:00"),
        end: utcDateTime.fromISO("2026-08-10T09:15:00+03:00"),
      },
      #{
        start: utcDateTime.fromISO("2026-08-10T09:15:00+03:00"),
        end: utcDateTime.fromISO("2026-08-10T09:30:00+03:00"),
      },
      #{
        start: utcDateTime.fromISO("2026-08-10T10:00:00+03:00"),
        end: utcDateTime.fromISO("2026-08-10T10:15:00+03:00"),
      },
      #{
        start: utcDateTime.fromISO("2026-08-11T09:00:00+03:00"),
        end: utcDateTime.fromISO("2026-08-11T09:15:00+03:00"),
      },
      #{
        start: utcDateTime.fromISO("2026-08-11T11:00:00+03:00"),
        end: utcDateTime.fromISO("2026-08-11T11:15:00+03:00"),
      },
    ],
  },
)
op listSlots(
  @path id: string,
  @query from: plainDate,
  @query to: plainDate,
): Slot[] | BadRequest | NotFound | InternalError;

/**
 * Создать бронь на выбранный слот.
 *
 * Сервер не доверяет клиенту и заново проверяет свободность `start`:
 *   400 — malformed тело/поля (проверяет router), 404 — нет типа события,
 *   422 — `start` синтаксически корректен, но не является базовым кандидатом
 *        (вне сетки, окна или рабочих часов),
 *   409 — базовый кандидат корректен, но слот уже занят (в т.ч. гонка гостей);
 *        занятость владельца общая между всеми типами событий.
 * При успехе `end`, `status: confirmed` и `createdAt` проставляет сервер.
 * Входной timestamp принимается с любым корректным offset (сравнение как момент
 * времени); ответные timestamps сериализуются в UTC с `Z`.
 */
@route("/bookings")
@post
op createBooking(
  @body body: BookingInput,
): Booking | BadRequest | NotFound | SlotUnavailable | InvalidSlot | InternalError;

// ─────────────────────────────── Система ───────────────────────────────

/** Ответ health check. */
model HealthResponse {
  status: "ok";
}

/** Готовность процесса. Внешних зависимостей в v1 нет. */
@route("/health")
@get
op health(): HealthResponse | InternalError;
