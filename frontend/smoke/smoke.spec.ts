import { test, expect } from '@playwright/test';
import type { Dayjs } from 'dayjs';
import { todayInZone } from '../src/shared/date/timezone';

const TIMEZONE = 'Europe/Moscow';

function nextWorkingDay(from: Dayjs): Dayjs {
  let day = from.add(1, 'day');
  while (day.day() === 0 || day.day() === 6) {
    day = day.add(1, 'day');
  }
  return day;
}

const CONSULTATION_DATE = nextWorkingDay(todayInZone(TIMEZONE));
const CREATED_TYPE_DATE = nextWorkingDay(CONSULTATION_DATE);

test.describe('smoke: реальный backend', () => {
  test('гость бронирует слот, админ видит бронь, слот исчезает', async ({ page }) => {
    const guestName = 'Иван Смок';

    await page.goto('/book');
    await expect(page.getByRole('heading', { name: 'Выберите тип события' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Консультация, длительность 30 минут' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Онбординг, длительность 15 минут' }),
    ).toBeVisible();

    const date = CONSULTATION_DATE.format('YYYY-MM-DD');
    await page.goto(`/book/evt_consultation?date=${date}`);
    await expect(page.getByRole('button', { name: '09:00–09:30' })).toBeVisible();
    await page.getByRole('button', { name: '09:00–09:30' }).click();

    await expect(page.getByLabel('Имя')).toBeFocused();
    await page.getByLabel('Имя').fill(guestName);
    await page.getByLabel('Email').fill('smoke@example.com');
    await page.getByRole('button', { name: 'Забронировать' }).click();

    await expect(page).toHaveURL(/\/book\/success/);
    await expect(page.getByRole('heading', { name: 'Бронь подтверждена' })).toBeVisible();
    await expect(page.getByText(guestName)).toBeVisible();

    await page.goto('/admin/bookings');
    await expect(page.getByRole('heading', { name: 'Предстоящие встречи' })).toBeVisible();
    await expect(page.getByText(guestName)).toBeVisible();
    await expect(page.getByText('Консультация')).toBeVisible();

    await page.goto(`/book/evt_consultation?date=${date}`);
    await expect(page.getByRole('button', { name: '09:00–09:30' })).toHaveCount(0);
  });

  test('админ создаёт тип события, гость бронирует его, админ видит бронь', async ({ page }) => {
    const title = `Смоук-тип ${Date.now()}`;
    const guestName = 'Гость Смоук-типа';

    await page.goto('/admin/event-types');
    await expect(page.getByRole('heading', { name: 'Типы событий' })).toBeVisible();

    await page.getByRole('link', { name: 'Создать тип события' }).click();
    await expect(page.getByRole('heading', { name: 'Новый тип события' })).toBeVisible();

    await page.getByLabel('Название').fill(title);
    await page.getByLabel('Описание').fill('Создан в смоук-тесте');
    await page.getByText('15 минут').click();
    await page.getByRole('button', { name: 'Создать', exact: true }).click();

    await expect(page.getByText('Тип события создан')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/event-types$/);

    await page.goto('/book');
    const card = page
      .getByRole('link', { name: `${title}, длительность 15 минут` })
      .first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/book\/evt_/);

    const bookingUrl = page.url();
    const date = CREATED_TYPE_DATE.format('YYYY-MM-DD');
    await page.goto(`${bookingUrl}?date=${date}`);
    await expect(page.getByRole('group', { name: 'Календарь бронирования' })).toBeVisible();

    const slot = page.getByRole('button', { name: '09:00–09:15' });
    await expect(slot).toBeVisible();
    await slot.click();

    await expect(page.getByLabel('Имя')).toBeFocused();
    await page.getByLabel('Имя').fill(guestName);
    await page.getByLabel('Email').fill('smoke-type@example.com');
    await page.getByRole('button', { name: 'Забронировать' }).click();

    await expect(page).toHaveURL(/\/book\/success/);
    await expect(page.getByRole('heading', { name: 'Бронь подтверждена' })).toBeVisible();
    await expect(page.getByText(guestName)).toBeVisible();

    await page.goto('/admin/bookings');
    await expect(page.getByRole('heading', { name: 'Предстоящие встречи' })).toBeVisible();
    await expect(page.getByText(guestName)).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  });
});
