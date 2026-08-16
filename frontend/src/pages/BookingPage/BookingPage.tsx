import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDocumentTitle } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { getConfig, listSlots, createBooking } from '../../shared/api/bookings';
import type { BookingInput, PublicConfig, Slot } from '../../shared/api/bookings';
import { viewEventType } from '../../shared/api/eventTypes';
import { isApiError, NetworkError } from '../../shared/api/errors';
import {
  isValidPlainDate,
  isInWindow,
  parsePlainDate,
  visibleGridRange,
} from '../../shared/date/timezone';
import { useTodayInZone } from '../../shared/date/useTodayInZone';
import { CalendarPicker } from '../../features/booking/CalendarPicker';
import { SlotList } from '../../features/booking/SlotList';
import { BookingForm } from '../../features/booking/BookingForm';
import type { BookingFormValues } from '../../features/booking/BookingForm';
import { validateBookingForm } from '../../features/booking/bookingValidation';
import { groupSlotsByDay } from '../../features/booking/slots';
import { useSlotsRefresh } from '../../features/booking/useSlotsRefresh';
import styles from './BookingPage.module.css';

export default function BookingPage() {
  const { eventTypeId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  useDocumentTitle('Бронирование звонка — Call Calendar');

  const configQuery = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const config = configQuery.data;

  const eventTypeQuery = useQuery({
    queryKey: ['event-type', eventTypeId],
    queryFn: () => viewEventType(eventTypeId),
    enabled: Boolean(eventTypeId),
    retry: 0,
  });
  const eventType = eventTypeQuery.data;

  const timezone = config?.timezone;

  const today = useTodayInZone(timezone);

  const selectedDate = useMemo(() => {
    if (!config || !today) return null;
    const param = searchParams.get('date');
    if (!param || !isValidPlainDate(param)) return today;
    const day = parsePlainDate(param, config.timezone);
    if (!isInWindow(day, config.timezone, config.bookingWindowDays)) return today;
    return param;
  }, [config, today, searchParams]);

  const [visibleMonth, setVisibleMonth] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!config || !today) return;
    const param = searchParams.get('date');
    if (!param || !isValidPlainDate(param)) return;
    const day = parsePlainDate(param, config.timezone);
    if (isInWindow(day, config.timezone, config.bookingWindowDays)) return;
    setSelectedSlot(null);
    setSlotError(null);
    const next = new URLSearchParams(searchParams);
    next.set('date', today);
    setSearchParams(next, { replace: true });
  }, [config, today, searchParams, setSearchParams]);

  useEffect(() => {
    if (!visibleMonth && selectedDate) {
      setVisibleMonth(`${selectedDate.slice(0, 7)}-01`);
    }
  }, [visibleMonth, selectedDate]);

  const gridRange = useMemo(
    () => (visibleMonth && timezone ? visibleGridRange(visibleMonth, timezone) : null),
    [visibleMonth, timezone],
  );

  const slotsQuery = useQuery({
    queryKey: ['slots', eventTypeId, gridRange?.from, gridRange?.to],
    queryFn: () => listSlots(eventTypeId, gridRange!.from, gridRange!.to),
    enabled: Boolean(eventType && timezone && gridRange),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  useSlotsRefresh(eventTypeId, slotsQuery.data, timezone);

  const slotsByDay = useMemo(
    () => (timezone && slotsQuery.data ? groupSlotsByDay(slotsQuery.data, timezone) : new Map<string, Slot[]>()),
    [slotsQuery.data, timezone],
  );

  const daysWithSlots = useMemo(() => new Set(slotsByDay.keys()), [slotsByDay]);
  const daySlots = useMemo(
    () => (selectedDate ? (slotsByDay.get(selectedDate) ?? []) : []),
    [selectedDate, slotsByDay],
  );

  const slotsLoading = !eventType || !config || !gridRange || slotsQuery.isPending;

  const form = useForm<BookingFormValues>({
    initialValues: { guestName: '', guestEmail: '' },
    validate: validateBookingForm,
  });

  const bookingMutation = useMutation({
    mutationFn: (input: BookingInput) => createBooking(input),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['slots', eventTypeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      navigate('/book/success', { state: { booking } });
    },
    onError: (error) => {
      if (isApiError(error)) {
        if (error.code === 'not_found') {
          navigate('/book', { replace: true });
          return;
        }
        if (error.code === 'slot_unavailable') {
          setSelectedSlot(null);
          setSlotError(error.message);
          queryClient.invalidateQueries({ queryKey: ['slots', eventTypeId] });
          return;
        }
        if (error.code === 'invalid_slot') {
          setSelectedSlot(null);
          setSlotError(error.message);
          return;
        }
      }
      setSubmitError(
        error instanceof NetworkError
          ? error.message
          : 'Не удалось выполнить бронирование. Попробуйте ещё раз.',
      );
    },
  });

  const handleSelectDate = (date: string) => {
    setSelectedSlot(null);
    setSlotError(null);
    setSubmitError(null);
    const next = new URLSearchParams(searchParams);
    next.set('date', date);
    setSearchParams(next);
  };

  const handleChangeMonth = (month: string) => {
    setVisibleMonth(month);
    if (!timezone || !today || !selectedDate) return;
    const range = visibleGridRange(month, timezone);
    if (selectedDate < range.from || selectedDate > range.to) {
      setSelectedSlot(null);
      const next = new URLSearchParams(searchParams);
      next.set('date', today);
      setSearchParams(next, { replace: true });
    }
  };

  const handleSelectSlot = (slot: Slot) => {
    setSlotError(null);
    setSubmitError(null);
    setSelectedSlot(slot);
  };

  const handleSubmit = (values: BookingFormValues) => {
    if (!selectedSlot) return;
    setSlotError(null);
    setSubmitError(null);
    bookingMutation.mutate({
      eventTypeId,
      start: selectedSlot.start,
      guestName: values.guestName.trim(),
      guestEmail: values.guestEmail.trim() || undefined,
    });
  };

  const notFound =
    (eventTypeQuery.isError && isApiError(eventTypeQuery.error) && eventTypeQuery.error.code === 'not_found') ||
    (slotsQuery.isError && isApiError(slotsQuery.error) && slotsQuery.error.code === 'not_found');

  if (notFound) {
    return (
      <Container size={1120} py="xl">
        <Card className={styles.stateCard}>
          <Title order={2} mb="xs">
            Тип события не найден
          </Title>
          <Text c="dimmed" mb="lg">
            Возможно, тип события был удалён или ссылка устарела.
          </Text>
          <Button component={Link} to="/book">
            Выбрать другой тип события
          </Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container size={1120} py="xl">
      {configQuery.isError || eventTypeQuery.isError ? (
        <Card className={styles.stateCard}>
          <Alert
            color="red"
            title="Не удалось загрузить страницу бронирования"
            variant="light"
            mb="md"
          >
            <Text mb="sm">Проверьте соединение и попробуйте ещё раз.</Text>
            <Button
              size="xs"
              onClick={() => {
                configQuery.refetch();
                eventTypeQuery.refetch();
              }}
            >
              Повторить
            </Button>
          </Alert>
        </Card>
      ) : (
        <div>
          {eventType ? (
            <div>
              <Anchor component={Link} to="/book" size="sm">
                &#8592; Все типы событий
              </Anchor>
              <Title order={1} mt="md">
                {eventType.title}
              </Title>
              {eventType.description ? (
                <Text c="dimmed" mt="sm">
                  {eventType.description}
                </Text>
              ) : null}
              <Badge variant="light" color="orange" mt="md">
                {eventType.durationMinutes} минут
              </Badge>
            </div>
          ) : (
            <Stack gap="sm" mb="xl">
              <Skeleton height={24} width="60%" />
              <Skeleton height={16} width="90%" />
              <Skeleton height={16} width="70%" />
            </Stack>
          )}

        <Grid gutter="xl" mt="xl">
          <Grid.Col span={{ base: 12, lg: 5 }}>
            <Card className={styles.columnCard}>
              {config ? (
                <CalendarPicker
                  timezone={config.timezone}
                  windowDays={config.bookingWindowDays}
                  selectedDate={selectedDate ?? ''}
                  today={today ?? ''}
                  daysWithSlots={daysWithSlots}
                  visibleMonth={visibleMonth ?? selectedDate ?? ''}
                  onChangeMonth={handleChangeMonth}
                  onSelectDate={handleSelectDate}
                />
              ) : (
                <Skeleton height={300} radius="md" />
              )}
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 7 }}>
            <Card className={styles.columnCard}>
              <Text fw={600} mb={4}>
                {selectedSlot ? 'Ваш выбор' : 'Свободные слоты'}
              </Text>
              {selectedDate ? (
                <Text size="sm" c="dimmed" mb="md">
                  {formatSelectedDate(selectedDate, config)}
                </Text>
              ) : null}

              {slotError ? (
                <Alert color="red" variant="light" mb="md" role="alert">
                  {slotError}
                </Alert>
              ) : null}

              {selectedSlot ? (
                <BookingForm
                  form={form}
                  slot={selectedSlot}
                  timezone={config?.timezone ?? 'UTC'}
                  isSubmitting={bookingMutation.isPending}
                  submitError={submitError}
                  onSubmit={handleSubmit}
                  onBack={() => setSelectedSlot(null)}
                />
              ) : (
                <SlotList
                  slots={daySlots}
                  timezone={config?.timezone ?? 'UTC'}
                  isToday={Boolean(today && selectedDate && selectedDate === today)}
                  isPending={slotsLoading}
                  hasError={slotsQuery.isError}
                  onSelectSlot={handleSelectSlot}
                  onRetry={() => slotsQuery.refetch()}
                />
              )}
            </Card>
          </Grid.Col>
        </Grid>
        </div>
      )}
    </Container>
  );
}

function formatSelectedDate(date: string, config: PublicConfig | undefined): string {
  if (!config) return '';
  const day = parsePlainDate(date, config.timezone);
  const label = day.format('dddd, D MMMM');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
