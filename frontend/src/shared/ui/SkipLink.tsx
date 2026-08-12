import styles from './SkipLink.module.css';

export function SkipLink() {
  return (
    <a href="#main-content" className={styles.skipLink}>
      Перейти к содержимому
    </a>
  );
}
