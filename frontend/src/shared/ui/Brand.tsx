import { Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import styles from './Brand.module.css';

export function Brand() {
  return (
    <Link to="/" className={styles.link}>
      <span className={styles.mark} aria-hidden="true">
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
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </span>
      <Text fw={700} fz="lg" className={styles.label}>
        Call Calendar
      </Text>
    </Link>
  );
}
