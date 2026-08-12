import { useEffect, useRef, useState } from 'react';
import { Alert, Anchor, Button, Card, Container, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDocumentTitle } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createEventType, getEventType, updateEventType } from '../../shared/api/eventTypes';
import { isApiError, NetworkError } from '../../shared/api/errors';
import { EventTypeForm } from '../../features/event-types/EventTypeForm';
import type { EventTypeFormValues } from '../../features/event-types/EventTypeForm';
import { validateEventTypeForm } from '../../features/event-types/eventTypeValidation';
import styles from './AdminEventTypeFormPage.module.css';

export default function AdminEventTypeFormPage() {
  const { eventTypeId } = useParams();
  const isEdit = Boolean(eventTypeId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initializedRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useDocumentTitle(
    isEdit ? 'Редактирование типа события — Call Calendar' : 'Новый тип события — Call Calendar',
  );

  const eventTypeQuery = useQuery({
    queryKey: ['admin-event-type', eventTypeId],
    queryFn: () => getEventType(eventTypeId!),
    enabled: isEdit,
    retry: 0,
  });
  const eventType = eventTypeQuery.data;

  const form = useForm<EventTypeFormValues>({
    initialValues: { title: '', description: '', durationMinutes: 30 },
    validate: validateEventTypeForm,
  });

  useEffect(() => {
    if (isEdit && eventType && !initializedRef.current) {
      initializedRef.current = true;
      form.setValues({
        title: eventType.title,
        description: eventType.description ?? '',
        durationMinutes: eventType.durationMinutes,
      });
    }
  }, [isEdit, eventType, form]);

  const mutation = useMutation({
    mutationFn: (values: EventTypeFormValues) => {
      const input = {
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        durationMinutes: values.durationMinutes,
      };
      return isEdit ? updateEventType(eventTypeId!, input) : createEventType(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-event-types'] });
      queryClient.invalidateQueries({ queryKey: ['public-event-types'] });
      if (isEdit && eventTypeId) {
        queryClient.invalidateQueries({ queryKey: ['admin-event-type', eventTypeId] });
        queryClient.invalidateQueries({ queryKey: ['event-type', eventTypeId] });
      }
      notifications.show({
        color: 'green',
        title: isEdit ? 'Изменения сохранены' : 'Тип события создан',
        message: '',
      });
      navigate('/admin/event-types');
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'not_found') {
        setNotFound(true);
        return;
      }
      if (isApiError(error) && error.code === 'event_type_duration_locked') {
        setSubmitError(error.message);
        return;
      }
      setSubmitError(
        error instanceof NetworkError
          ? error.message
          : 'Не удалось сохранить тип события. Попробуйте ещё раз.',
      );
    },
  });

  const handleSubmit = (values: EventTypeFormValues) => {
    setSubmitError(null);
    mutation.mutate(values);
  };

  if (notFound || (eventTypeQuery.isError && isApiError(eventTypeQuery.error) && eventTypeQuery.error.code === 'not_found')) {
    return (
      <Container size={1120} py="xl">
        <Card className={styles.stateCard}>
          <Title order={2} mb="xs">
            Тип события не найден
          </Title>
          <Text c="dimmed" mb="lg">
            Возможно, тип события был удалён или ссылка устарела.
          </Text>
          <Button component={Link} to="/admin/event-types">
            К списку типов событий
          </Button>
        </Card>
      </Container>
    );
  }

  if (isEdit && eventTypeQuery.isError) {
    return (
      <Container size={1120} py="xl">
        <Alert color="red" title="Не удалось загрузить тип события" variant="light">
          <Text mb="sm">
            {isApiError(eventTypeQuery.error) || eventTypeQuery.error instanceof NetworkError
              ? eventTypeQuery.error.message
              : 'Не удалось выполнить запрос. Попробуйте ещё раз.'}
          </Text>
          <Button size="xs" onClick={() => eventTypeQuery.refetch()}>
            Повторить
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container size={1120} py="xl">
      <Anchor component={Link} to="/admin/event-types" size="sm">
        &#8592; Типы событий
      </Anchor>
      <Title order={1} mt="md" mb="xl">
        {isEdit ? 'Редактирование типа события' : 'Новый тип события'}
      </Title>

      {isEdit && eventTypeQuery.isPending ? (
        <Card className={styles.formCard}>
          <Stack gap="md">
            <Skeleton height={44} />
            <Skeleton height={100} />
            <Skeleton height={40} width="60%" />
          </Stack>
        </Card>
      ) : (
        <Card className={styles.formCard}>
          <EventTypeForm
            form={form}
            isSubmitting={mutation.isPending}
            submitError={submitError}
            submitLabel={isEdit ? 'Сохранить' : 'Создать'}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/admin/event-types')}
          />
        </Card>
      )}
    </Container>
  );
}
