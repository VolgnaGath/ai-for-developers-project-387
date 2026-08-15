import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { todayInZone } from '../src/shared/date/timezone';

function cardByTitle(page: Page, title: string) {
  return page.getByTestId('event-type-card').filter({ has: page.getByText(title, { exact: true }) });
}

test.describe('Административный CRUD типов событий', () => {
  test('создаёт тип события', async ({ page }) => {
    await page.goto('/admin/event-types');
    await expect(page.getByRole('heading', { name: 'Типы событий' })).toBeVisible();

    await page.getByRole('link', { name: 'Создать тип события' }).click();
    await expect(page).toHaveURL(/\/admin\/event-types\/new$/);
    await expect(page.getByRole('heading', { name: 'Новый тип события' })).toBeVisible();

    await page.getByLabel('Название').fill('Разбор проекта');
    await page.getByLabel('Описание').fill('Обсудим детали проекта');
    await page.getByText('15 минут').click();
    await page.getByRole('button', { name: 'Создать', exact: true }).click();

    await expect(page.getByText('Тип события создан')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/event-types$/);

    const card = cardByTitle(page, 'Разбор проекта');
    await expect(card).toBeVisible();
    await expect(card.getByText('15 минут')).toBeVisible();
  });

  test('редактирует тип события', async ({ page }) => {
    await page.goto('/admin/event-types');
    const card = cardByTitle(page, 'Онбординг');
    await card.getByRole('link', { name: 'Редактировать' }).click();

    await expect(page).toHaveURL(/\/admin\/event-types\/event-type-onboarding\/edit$/);
    await expect(page.getByRole('heading', { name: 'Редактирование типа события' })).toBeVisible();
    await expect(page.getByLabel('Название')).toHaveValue('Онбординг');

    await page.getByLabel('Название').fill('Онбординг обновлённый');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();

    await expect(page.getByText('Изменения сохранены')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/event-types$/);
    await expect(cardByTitle(page, 'Онбординг обновлённый')).toBeVisible();
  });

  test('не даёт изменить длительность типа события с бронями', async ({ page }) => {
    await page.goto('/admin/event-types');
    const card = cardByTitle(page, 'Консультация');
    await card.getByRole('link', { name: 'Редактировать' }).click();

    await expect(page.getByRole('heading', { name: 'Редактирование типа события' })).toBeVisible();
    await page.getByText('15 минут').click();
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Нельзя изменить длительность типа события: у него есть существующие брони.',
    );
    await expect(page).toHaveURL(/\/admin\/event-types\/event-type-consultation\/edit$/);
  });

  test('не даёт удалить тип события с бронями', async ({ page }) => {
    await page.goto('/admin/event-types');
    const card = cardByTitle(page, 'Консультация');
    await card.getByRole('button', { name: 'Удалить' }).click();

    await expect(page.getByRole('dialog')).toContainText('Удалить тип события?');
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click();

    await expect(page.getByText('Удаление невозможно')).toBeVisible();
    await expect(cardByTitle(page, 'Консультация')).toBeVisible();
  });

  test('удаляет тип события без броней', async ({ page }) => {
    await page.goto('/admin/event-types');
    const card = cardByTitle(page, 'Онбординг');
    await card.getByRole('button', { name: 'Удалить' }).click();

    await expect(page.getByRole('dialog')).toContainText('Удалить тип события?');
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click();

    await expect(page.getByText('Тип события удалён')).toBeVisible();
    await expect(cardByTitle(page, 'Онбординг')).toHaveCount(0);
    await expect(cardByTitle(page, 'Консультация')).toBeVisible();
  });
});

test.describe('Административный список встреч', () => {
  test('переходит в админку из шапки публичной страницы', async ({ page }) => {
    await page.goto('/');
    const adminLink = page.getByRole('link', { name: 'Панель управления' });
    await expect(adminLink).toBeVisible();

    await adminLink.click();
    await expect(page).toHaveURL(/\/admin\/bookings$/);
    await expect(page.getByRole('heading', { name: 'Предстоящие встречи' })).toBeVisible();
  });

  test('показывает предстоящие встречи', async ({ page }) => {
    await page.goto('/admin/bookings');
    await expect(page.getByRole('heading', { name: 'Предстоящие встречи' })).toBeVisible();
    await expect(page.getByText('Иван Петров')).toBeVisible();
    await expect(page.getByText('Консультация')).toBeVisible();
    await expect(page.getByText('30 минут')).toBeVisible();
  });

  test('фильтрует встречи по диапазону дат «от/до»', async ({ page }) => {
    const today = todayInZone('Europe/Moscow');
    const bookingDay = today.add(1, 'day').format('YYYY-MM-DD');
    const future = today.add(7, 'day').format('YYYY-MM-DD');
    const past = today.subtract(7, 'day').format('YYYY-MM-DD');

    await page.goto('/admin/bookings');
    await expect(page.getByText('Иван Петров')).toBeVisible();

    await page.getByLabel('От').fill(future);
    await expect(page).toHaveURL(new RegExp(`from=${future}`));
    await expect(page.getByText('Иван Петров')).toHaveCount(0);

    await page.getByLabel('От').fill(bookingDay);
    await expect(page.getByText('Иван Петров')).toBeVisible();

    await page.getByLabel('До').fill(past);
    await expect(page.getByText('Иван Петров')).toHaveCount(0);

    await page.getByLabel('До').fill('');
    await expect(page.getByText('Иван Петров')).toBeVisible();
  });
});
