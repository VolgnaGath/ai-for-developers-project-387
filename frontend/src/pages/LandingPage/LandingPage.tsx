import { Button, Container, Group, Text, Title } from '@mantine/core';
import { useDocumentTitle } from '@mantine/hooks';
import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css';

export default function LandingPage() {
  useDocumentTitle('Call Calendar — бронирование звонков');
  return (
    <div className={styles.root}>
      <Container size={1120} className={styles.inner}>
        <Title order={1} className={styles.title}>
          Планируйте звонки без переписки
        </Title>
        <Text c="dimmed" size="lg" className={styles.subtitle}>
          Выберите свободное время — и получите ссылку на встречу.
        </Text>
        <Group mt="xl">
          <Button component={Link} to="/book" size="lg">
            Забронировать звонок
          </Button>
        </Group>
      </Container>
    </div>
  );
}
