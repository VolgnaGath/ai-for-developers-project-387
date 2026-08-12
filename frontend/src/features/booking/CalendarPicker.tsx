import { Group, Text, UnstyledButton } from '@mantine/core';
import { Month } from '@mantine/dates';
import {
  canGoForward,
  formatMonthLabel,
  isInWindow,
  parsePlainDate,
  plainDateKey,
} from '../../shared/date/timezone';
import styles from './CalendarPicker.module.css';

interface CalendarPickerProps {
  timezone: string;
  windowDays: number;
  selectedDate: string;
  today: string;
  daysWithSlots: Set<string>;
  visibleMonth: string;
  onChangeMonth: (month: string) => void;
  onSelectDate: (date: string) => void;
}

export function CalendarPicker({
  timezone,
  windowDays,
  selectedDate,
  today,
  daysWithSlots,
  visibleMonth,
  onChangeMonth,
  onSelectDate,
}: CalendarPickerProps) {
  const goPrevMonth = () => {
    const next = parsePlainDate(visibleMonth, timezone).subtract(1, 'month').startOf('month');
    onChangeMonth(plainDateKey(next));
  };

  const goNextMonth = () => {
    const next = parsePlainDate(visibleMonth, timezone).add(1, 'month').startOf('month');
    onChangeMonth(plainDateKey(next));
  };

  return (
    <div role="group" aria-label="Календарь бронирования">
      <Group justify="space-between" mb="xs" gap={4}>
        <UnstyledButton
          className={styles.navButton}
          onClick={goPrevMonth}
          aria-label="Предыдущий месяц"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </UnstyledButton>
        <Text fw={600} tt="capitalize" className={styles.monthLabel}>
          {formatMonthLabel(visibleMonth)}
        </Text>
        <UnstyledButton
          className={styles.navButton}
          onClick={goNextMonth}
          disabled={!canGoForward(visibleMonth, timezone, windowDays)}
          aria-label="Следующий месяц"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </UnstyledButton>
      </Group>

      <Month
        month={visibleMonth}
        firstDayOfWeek={1}
        getDayProps={(date) => ({
          selected: date === selectedDate,
          disabled: !isInWindow(parsePlainDate(date, timezone), timezone, windowDays),
          className: [
            styles.day,
            date === today ? styles.today : null,
            daysWithSlots.has(date) ? styles.hasSlots : null,
          ]
            .filter(Boolean)
            .join(' '),
          onClick: () => onSelectDate(date),
        })}
        renderDay={(date) => (
          <span className={styles.dayContent}>
            <span>{Number(date.slice(-2))}</span>
            {daysWithSlots.has(date) ? <span className={styles.dot} aria-hidden="true" /> : null}
          </span>
        )}
      />

      <Text size="xs" c="dimmed" mt="sm">
        Время: {timezone}
      </Text>
    </div>
  );
}
