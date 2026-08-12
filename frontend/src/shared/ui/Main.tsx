import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './Main.module.css';

export function Main({ children }: { children: ReactNode }) {
  const location = useLocation();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <main ref={ref} id="main-content" tabIndex={-1} className={styles.main}>
      {children}
    </main>
  );
}
