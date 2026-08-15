import { useMemo } from 'react';
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Skeleton,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import { useDocumentTitle } from '@mantine/hooks';
import { useSearchParams } from 'react-router-dom';
import { getConfig, listBookings } from '../../shared/api/bookings';
import { listEventTypes } from '../../shared/api/eventTypes';
import { isApiError, NetworkError } from '../../shared/api/errors';
import {
  formatDateTime,
  isValidPlainDate,
  plainDateKey,
  todayInZone,
} from '../../shared/date/timezone';

export default function AdminBookingsPage() {
  useDocumentTitle('Предстоящие встречи — Call Calendar');
  const [searchParams, setSearchParams] = useSearchParams();
  const configQuery = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const config = configQuery.data;

  const eventTypesQuery = useQuery({
    queryKey: ['admin-event-types'],
    queryFn: listEventTypes,
  });

  const todayKey = useMemo(
    () => (config ? plainDateKey(todayInZone(config.timezone)) : null),
    [config],
  );

  const urlFrom = useMemo(() => validDateParam(searchParams.get('from')), [searchParams]);
  const urlTo = useMemo(() => validDateParam(searchParams.get('to')), [searchParams]);

  const from = urlFrom ?? todayKey;

  const bookingsQuery = useQuery({
    queryKey: ['admin-bookings', from, urlTo],
    queryFn: () => listBookings({ from: from ?? undefined, to: urlTo ?? undefined }),
    enabled: Boolean(config),
  });

  const eventTypesById = useMemo(() => {
    const byId = new Map<string, { title: string; durationMinutes: number }>();
    for (const eventType of eventTypesQuery.data ?? []) {
      byId.set(eventType.id, {
        title: eventType.title,
        durationMinutes: eventType.durationMinutes,
      });
    }
    return byId;
  }, [eventTypesQuery.data]);

  const sortedBookings = useMemo(() => {
    if (!bookingsQuery.data) return [];
    return [...bookingsQuery.data].sort((a, b) => a.start.localeCompare(b.start));
  }, [bookingsQuery.data]);

  const isLoading = configQuery.isPending || eventTypesQuery.isPending || bookingsQuery.isPending;
  const isError =
    configQuery.isError || eventTypesQuery.isError || bookingsQuery.isError;

  if (isLoading) {
    return (
      <Container size={1120} py="xl">
        <Skeleton height={28} width={240} mb="sm" />
        <Skeleton height={16} width={320} mb="xl" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height={44} mb="xs" radius="md" />
        ))}
      </Container>
    );
  }

  if (isError) {
    const error = configQuery.error ?? eventTypesQuery.error ?? bookingsQuery.error;
    return (
      <Container size={1120} py="xl">
        <Alert
          color="red"
          title="Не удалось загрузить встречи"
          variant="light"
        >
          <Text mb="sm">{errorMessage(error)}</Text>
          <Button
            size="xs"
            onClick={() => {
              configQuery.refetch();
              eventTypesQuery.refetch();
              bookingsQuery.refetch();
            }}
          >
            Повторить
          </Button>
        </Alert>
      </Container>
    );
  }

  const handleDateChange = (key: 'from' | 'to', value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value && isValidPlainDate(value)) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  const handleReset = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('from');
    next.delete('to');
    setSearchParams(next);
  };

  const isFiltered = urlFrom !== null || urlTo !== null;

  return (
    <Container size={1120} py="xl">
      <Title order={1} mb="sm">
        Предстоящие встречи
      </Title>
      <Text c="dimmed" mb="xl">
        Список бронирований всех типов событий. По умолчанию — от «сегодня» и далее; фильтром
        «от»/«до» можно задать диапазон дат.
      </Text>

      <Group align="flex-end" mb="md">
        <DateInput
          label="От"
          placeholder="ГГГГ-ММ-ДД"
          valueFormat="YYYY-MM-DD"
          value={urlFrom}
          onChange={(value) => handleDateChange('from', value)}
          clearable
          miw={180}
        />
        <DateInput
          label="До"
          placeholder="ГГГГ-ММ-ДД"
          valueFormat="YYYY-MM-DD"
          value={urlTo}
          onChange={(value) => handleDateChange('to', value)}
          clearable
          miw={180}
        />
        <Button variant="default" onClick={handleReset} disabled={!isFiltered}>
          Сбросить
        </Button>
      </Group>

      {sortedBookings.length === 0 ? (
        <Alert title="Нет встреч в выбранном диапазоне" variant="light">
          <Text mb="sm">
            {isFiltered
              ? 'По выбранному диапазону дат нет бронирований.'
              : 'Пока гости не забронировали ни одного слота.'}
          </Text>
        </Alert>
      ) : (
        <Table.ScrollContainer minWidth={640} type="native">
          <Table withColumnBorders highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Дата и время</Table.Th>
                <Table.Th>Гость</Table.Th>
                <Table.Th>Тип события</Table.Th>
                <Table.Th>Длительность</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedBookings.map((booking) => {
                const eventType = eventTypesById.get(booking.eventTypeId);
                return (
                  <Table.Tr key={booking.id}>
                    <Table.Td>
                      {config ? formatDateTime(booking.start, config.timezone) : booking.start}
                    </Table.Td>
                    <Table.Td>{booking.guestName}</Table.Td>
                    <Table.Td>
                      {eventType ? (
                        eventType.title
                      ) : (
                        <Text component="span" c="dimmed">
                          {booking.eventTypeId}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {eventType ? (
                        <Badge variant="light" color="orange">
                          {formatDuration(eventType.durationMinutes)}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Container>
  );
}

function validDateParam(value: string | null): string | null {
  return value && isValidPlainDate(value) ? value : null;
}

function errorMessage(error: unknown): string {
  if (isApiError(error) || error instanceof NetworkError) {
    return error.message;
  }
  return 'Не удалось выполнить запрос. Попробуйте ещё раз.';
}

function formatDuration(minutes: number): string {
  return `${minutes} минут`;
}
