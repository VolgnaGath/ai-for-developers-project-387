import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Modal,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDocumentTitle } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { deleteEventType, listEventTypes } from '../../shared/api/eventTypes';
import type { EventType } from '../../shared/api/eventTypes';
import { isApiError, NetworkError } from '../../shared/api/errors';

export default function AdminEventTypesPage() {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<EventType | null>(null);

  useDocumentTitle('Типы событий — Call Calendar');

  const query = useQuery({
    queryKey: ['admin-event-types'],
    queryFn: listEventTypes,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEventType(id),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-event-types'] });
      queryClient.invalidateQueries({ queryKey: ['public-event-types'] });
      notifications.show({ color: 'green', title: 'Тип события удалён', message: '' });
    },
    onError: (error) => {
      setDeleteTarget(null);
      if (isApiError(error) && error.code === 'event_type_has_bookings') {
        notifications.show({ color: 'red', title: 'Удаление невозможно', message: error.message });
        return;
      }
      const message =
        error instanceof NetworkError
          ? error.message
          : 'Не удалось удалить тип события. Попробуйте ещё раз.';
      notifications.show({ color: 'red', title: 'Ошибка удаления', message });
    },
  });

  return (
    <Container size={1120} py="xl">
      <Group justify="space-between" align="center" mb="xl" wrap="wrap" gap="sm">
        <div>
          <Title order={1} mb={4}>
            Типы событий
          </Title>
          <Text c="dimmed">Управление типами звонков, доступных гостям для бронирования.</Text>
        </div>
        <Button component={Link} to="/admin/event-types/new">
          Создать тип события
        </Button>
      </Group>

      {query.isPending ? (
        <Stack gap="md">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} height={88} radius="md" />
          ))}
        </Stack>
      ) : null}

      {query.isError ? (
        <Alert color="red" title="Не удалось загрузить типы событий" variant="light">
          <Text mb="sm">{errorMessage(query.error)}</Text>
          <Button size="xs" onClick={() => query.refetch()}>
            Повторить
          </Button>
        </Alert>
      ) : null}

      {query.isSuccess && query.data.length === 0 ? (
        <Alert title="Нет типов событий" variant="light">
          <Text mb="sm">
            Создайте первый тип события, чтобы гости могли бронировать звонки.
          </Text>
          <Button component={Link} to="/admin/event-types/new" size="xs">
            Создать тип события
          </Button>
        </Alert>
      ) : null}

      {query.isSuccess && query.data.length > 0 ? (
        <Stack gap="md">
          {query.data.map((eventType) => (
            <Card key={eventType.id} withBorder data-testid="event-type-card">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div>
                  <Text fw={600} fz="lg">
                    {eventType.title}
                  </Text>
                  {eventType.description ? (
                    <Text c="dimmed" size="sm" mt={4}>
                      {eventType.description}
                    </Text>
                  ) : null}
                </div>
                <Group gap="xs" wrap="wrap">
                  <Badge variant="light" color="orange" size="lg">
                    {formatDuration(eventType.durationMinutes)}
                  </Badge>
                  <Button
                    variant="light"
                    size="sm"
                    component={Link}
                    to={`/admin/event-types/${eventType.id}/edit`}
                  >
                    Редактировать
                  </Button>
                  <Button
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => setDeleteTarget(eventType)}
                  >
                    Удалить
                  </Button>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      ) : null}

      <Modal
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Удалить тип события?"
        centered
      >
        {deleteTarget ? (
          <>
            <Text mb="lg">
              Тип события «{deleteTarget.title}» будет удалён. Гости больше не смогут бронировать
              звонки этого типа.
            </Text>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => setDeleteTarget(null)}>
                Отмена
              </Button>
              <Button
                color="red"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
              >
                Удалить
              </Button>
            </Group>
          </>
        ) : null}
      </Modal>
    </Container>
  );
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
