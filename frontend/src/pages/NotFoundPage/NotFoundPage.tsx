import { Button, Center, Container, Stack, Text, Title } from '@mantine/core';
import { useDocumentTitle } from '@mantine/hooks';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  useDocumentTitle('Страница не найдена — Call Calendar');
  return (
    <Container size={1120} py="xl">
      <Center h="60vh">
        <Stack align="center" gap="xs">
          <Title order={1}>404</Title>
          <Text c="dimmed">Страница не найдена</Text>
          <Button component={Link} to="/" variant="subtle">
            На главную
          </Button>
        </Stack>
      </Center>
    </Container>
  );
}
