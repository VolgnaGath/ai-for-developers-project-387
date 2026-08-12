import { Alert, Button, Card, Container, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useDocumentTitle } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { getConfig } from '../../shared/api/bookings';
import type { Booking } from '../../shared/api/bookings';
import { formatDateTime, formatTime } from '../../shared/date/timezone';
import styles from './BookingSuccessPage.module.css';

export default function BookingSuccessPage() {
  useDocumentTitle('Бронь подтверждена — Call Calendar');
  const location = useLocation();
  const booking = (location.state as { booking?: Booking } | null)?.booking;
  const configQuery = useQuery({ queryKey: ['config'], queryFn: getConfig });

  if (!booking || !booking.id) {
    return <Navigate to="/book" replace />;
  }

  const timezone = configQuery.data?.timezone ?? 'UTC';

  return (
    <Container size={1120} py="xl">
      <Card className={styles.card}>
        <span className={styles.check} aria-hidden="true">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </span>

        <Title order={1} mt="md" mb="xs">
          Бронь подтверждена
        </Title>
        <Text c="dimmed" mb="lg">
          Встреча запланирована. Мы сохранили ваши данные.
        </Text>

        {configQuery.isError ? (
          <Alert color="red" title="Не удалось загрузить время встречи" variant="light" mb="lg">
            <Text mb="sm">
              Мы не смогли отобразить время в таймзоне владельца. Попробуйте ещё раз.
            </Text>
            <Button size="xs" onClick={() => configQuery.refetch()}>
              Повторить
            </Button>
          </Alert>
        ) : null}

        <Stack gap="xs" className={styles.details}>
          {configQuery.isPending ? (
            <Skeleton height={22} width="50%" />
          ) : (
            <Detail
              label="Дата и время"
              value={
                configQuery.isError
                  ? booking.start
                  : `${formatDateTime(booking.start, timezone)}–${formatTime(booking.end, timezone)}`
              }
            />
          )}
          <Detail label="Имя" value={booking.guestName} />
          {booking.guestEmail ? <Detail label="Email" value={booking.guestEmail} /> : null}
        </Stack>

        <Group mt="xl">
          <Button component={Link} to="/book">
            Забронировать ещё
          </Button>
        </Group>
      </Card>
    </Container>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="lg" wrap="wrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={500} ta="right">
        {value}
      </Text>
    </Group>
  );
}
