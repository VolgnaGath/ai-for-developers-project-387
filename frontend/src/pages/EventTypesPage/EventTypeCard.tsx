import { Badge, Box, Card, Group, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { EventType } from '../../shared/api/eventTypes';
import styles from './EventTypesPage.module.css';

export function EventTypeCard({ eventType }: { eventType: EventType }) {
  return (
    <Card
      component={Link}
      to={`/book/${eventType.id}`}
      className={styles.card}
      aria-label={`${eventType.title}, длительность ${formatDuration(eventType.durationMinutes)}`}
    >
      <Group justify="space-between" wrap="wrap">
        <Box>
          <Text fw={600} fz="lg">
            {eventType.title}
          </Text>
          {eventType.description ? (
            <Text c="dimmed" size="sm" mt={4} className={styles.description}>
              {eventType.description}
            </Text>
          ) : null}
        </Box>
        <Group gap="xs" wrap="nowrap">
          <Badge variant="light" color="orange" size="lg">
            {formatDuration(eventType.durationMinutes)}
          </Badge>
          <span className={styles.chevron} aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </Group>
      </Group>
    </Card>
  );
}

function formatDuration(minutes: number): string {
  return `${minutes} минут`;
}
