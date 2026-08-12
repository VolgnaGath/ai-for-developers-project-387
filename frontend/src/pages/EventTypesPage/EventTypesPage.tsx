import {
  Alert,
  Button,
  Container,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useDocumentTitle } from '@mantine/hooks';
import { browseEventTypes } from '../../shared/api/eventTypes';
import { isApiError, NetworkError } from '../../shared/api/errors';
import { EventTypeCard } from './EventTypeCard';
import styles from './EventTypesPage.module.css';

export default function EventTypesPage() {
  useDocumentTitle('Выбор типа события — Call Calendar');
  const query = useQuery({
    queryKey: ['public-event-types'],
    queryFn: browseEventTypes,
  });

  return (
    <Container size={1120} py="xl">
      <Title order={1} mb="sm">
        Выберите тип события
      </Title>
      <Text c="dimmed" mb="xl">
        Один владелец публикует типы звонков — выберите подходящий, чтобы посмотреть свободные
        слоты.
      </Text>

      {query.isPending ? (
        <Stack gap="md">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} height={88} radius="md" />
          ))}
        </Stack>
      ) : null}

      {query.isError ? (
        <Alert
          color="red"
          title="Не удалось загрузить типы событий"
          variant="light"
          className={styles.alert}
        >
          <Text mb="sm">{errorMessage(query.error)}</Text>
          <Button size="xs" onClick={() => query.refetch()}>
            Повторить
          </Button>
        </Alert>
      ) : null}

      {query.isSuccess && query.data.length === 0 ? (
        <Alert title="Нет доступных типов событий" variant="light" className={styles.alert}>
          <Text mb="sm">Владелец ещё не опубликовал типы событий. Попробуйте зайти позже.</Text>
        </Alert>
      ) : null}

      {query.isSuccess && query.data.length > 0 ? (
        <Stack gap="md">
          {query.data.map((eventType) => (
            <EventTypeCard key={eventType.id} eventType={eventType} />
          ))}
        </Stack>
      ) : null}
    </Container>
  );
}

function errorMessage(error: unknown): string {
  if (isApiError(error) || error instanceof NetworkError) {
    return error.message;
  }
  return 'Не удалось выполнить запрос. Попробуйте ещё раз.';
}
