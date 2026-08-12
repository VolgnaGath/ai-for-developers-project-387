import { useEffect, useRef } from 'react';
import { Alert, Button, Group, SegmentedControl, Stack, Text, Textarea, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';

export interface EventTypeFormValues {
  title: string;
  description: string;
  durationMinutes: 15 | 30;
}

interface EventTypeFormProps {
  form: UseFormReturnType<EventTypeFormValues>;
  isSubmitting: boolean;
  submitError: string | null;
  submitLabel: string;
  onSubmit: (values: EventTypeFormValues) => void;
  onCancel: () => void;
}

export function EventTypeForm({
  form,
  isSubmitting,
  submitError,
  submitLabel,
  onSubmit,
  onCancel,
}: EventTypeFormProps) {
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <form onSubmit={form.onSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        {submitError ? (
          <Alert color="red" variant="light" role="alert">
            {submitError}
          </Alert>
        ) : null}

        <TextInput
          ref={titleRef}
          label="Название"
          placeholder="Например, Консультация"
          withAsterisk
          {...form.getInputProps('title')}
        />

        <Textarea
          label="Описание"
          placeholder="Короткое описание звонка"
          autosize
          minRows={3}
          {...form.getInputProps('description')}
        />

        <div>
          <Text component="label" size="sm" fw={500} mb={6} display="block">
            Длительность встречи
          </Text>
          <SegmentedControl
            fullWidth
            value={String(form.values.durationMinutes)}
            onChange={(value) =>
              form.setFieldValue('durationMinutes', value === '15' ? 15 : 30)
            }
            data={[
              { value: '15', label: '15 минут' },
              { value: '30', label: '30 минут' },
            ]}
          />
        </div>

        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={onCancel}>
            Отмена
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
