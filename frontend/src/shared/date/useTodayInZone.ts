import { useEffect, useState } from 'react';
import { msUntilNextMidnight, nowInZone, plainDateKey, todayInZone } from './timezone';

const SCHEDULE_BUFFER_MS = 1000;

export function useTodayInZone(timezone: string | undefined): string | null {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    if (!timezone) return;
    let timer: number | undefined;

    const recompute = () => {
      setToday(plainDateKey(todayInZone(timezone)));
    };

    const schedule = () => {
      window.clearTimeout(timer);
      const delay = msUntilNextMidnight(nowInZone(timezone)) + SCHEDULE_BUFFER_MS;
      timer = window.setTimeout(() => {
        recompute();
        schedule();
      }, delay);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        recompute();
        schedule();
      }
    };

    const handleFocus = () => {
      recompute();
      schedule();
    };

    recompute();
    schedule();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [timezone]);

  if (timezone && today === null) {
    return plainDateKey(todayInZone(timezone));
  }
  return today;
}
