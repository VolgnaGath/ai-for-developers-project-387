import { useEffect, useRef } from 'react';
import { Alert, Anchor, Button, Stack, Text, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { Slot } from '../../shared/api/bookings';
import { formatDateTime, formatTime } from '../../shared/date/timezone';

export interface BookingFormValues {
  guestName: string;
  guestEmail: string;
}

interface BookingFormProps {
  form: UseFormReturnType<BookingFormValues>;
  slot: Slot;
  timezone: string;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (values: BookingFormValues) => void;
  onBack: () => void;
}

export function BookingForm({
  form,
  slot,
  timezone,
  isSubmitting,
  submitError,
  onSubmit,
  onBack,
}: BookingFormProps) {
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  return (
    <form onSubmit={form.onSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <div>
          <Anchor component="button" type="button" onClick={onBack} size="sm">
            &#8592; Выбрать другой слот
          </Anchor>
          <Text size="sm" c="dimmed" mt={4}>
            {formatDateTime(slot.start, timezone)}&ndash;{formatTime(slot.end, timezone)}
          </Text>
        </div>

        {submitError ? (
          <Alert color="red" variant="light" role="alert">
            {submitError}
          </Alert>
        ) : null}

        <TextInput
          ref={nameRef}
          label="Имя"
          placeholder="Как к вам обращаться"
          withAsterisk
          {...form.getInputProps('guestName')}
        />

        <TextInput
          label="Email"
          placeholder="name@example.com"
          {...form.getInputProps('guestEmail')}
        />

        <Button type="submit" loading={isSubmitting} fullWidth>
          Забронировать
        </Button>
      </Stack>
    </form>
  );
}
