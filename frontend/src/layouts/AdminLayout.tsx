import { Container, Group } from '@mantine/core';
import { NavLink, Outlet } from 'react-router-dom';
import { Brand } from '../shared/ui/Brand';
import { SkipLink } from '../shared/ui/SkipLink';
import { Main } from '../shared/ui/Main';
import styles from './AdminLayout.module.css';

const navItems = [
  { to: '/admin/bookings', label: 'Встречи', end: false },
  { to: '/admin/event-types', label: 'Типы событий', end: false },
];

export default function AdminLayout() {
  return (
    <div className={styles.root}>
      <SkipLink />
      <header className={styles.header}>
        <Container size={1120} className={styles.headerInner}>
          <Brand />
          <Group gap="xs" component="nav" aria-label="Администрирование" wrap="wrap">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? styles.navLinkActive : styles.navLink
                }
              >
                {item.label}
              </NavLink>
            ))}
          </Group>
        </Container>
      </header>
      <Main>
        <Outlet />
      </Main>
    </div>
  );
}
