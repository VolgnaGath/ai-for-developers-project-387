import { Button, Container } from '@mantine/core';
import { Outlet, Link } from 'react-router-dom';
import { Brand } from '../shared/ui/Brand';
import { SkipLink } from '../shared/ui/SkipLink';
import { Main } from '../shared/ui/Main';
import styles from './PublicLayout.module.css';

export default function PublicLayout() {
  return (
    <div className={styles.root}>
      <SkipLink />
      <header className={styles.header}>
        <Container size={1120} className={styles.headerInner}>
          <Brand />
          <Button component={Link} to="/admin" variant="light" size="sm">
            Панель управления
          </Button>
        </Container>
      </header>
      <Main>
        <Outlet />
      </Main>
    </div>
  );
}
