import { Alert, Button, SimpleGrid, Skeleton, Text } from '@mantine/core';
import type { Slot } from '../../shared/api/bookings';
import { formatTime } from '../../shared/date/timezone';
import styles from './SlotList.module.css';

interface SlotListProps {
  slots: Slot[];
  timezone: string;
  isToday: boolean;
  isPending: boolean;
  hasError: boolean;
  onSelectSlot: (slot: Slot) => void;
  onRetry: () => void;
}

export function SlotList({
  slots,
  timezone,
  isToday,
  isPending,
  hasError,
  onSelectSlot,
  onRetry,
}: SlotListProps) {
  return (
    <div aria-live="polite" aria-busy={isPending} className={styles.root}>
      {isPending ? (
        <SimpleGrid cols={2} spacing="sm">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={40} radius="md" />
          ))}
        </SimpleGrid>
      ) : null}

      {hasError ? (
        <Alert color="red" title="Не удалось загрузить слоты" variant="light">
          <Text size="sm" mb="sm">
            Не удалось загрузить свободные слоты. Попробуйте ещё раз.
          </Text>
          <Button size="xs" onClick={onRetry}>
            Повторить
          </Button>
        </Alert>
      ) : null}

      {!isPending && !hasError && slots.length === 0 ? (
        <Text c="dimmed" className={styles.empty}>
          {isToday
            ? 'Свободные слоты на сегодня закончились. Выберите другой день.'
            : 'На этот день нет свободных слотов.'}
        </Text>
      ) : null}

      {!isPending && !hasError && slots.length > 0 ? (
        <SimpleGrid cols={2} spacing="sm">
          {slots.map((slot) => (
            <Button
              key={slot.start}
              variant="light"
              color="gray"
              className={styles.slotButton}
              onClick={() => onSelectSlot(slot)}
            >
              {formatTime(slot.start, timezone)}–{formatTime(slot.end, timezone)}
            </Button>
          ))}
        </SimpleGrid>
      ) : null}
    </div>
  );
}
