import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Slot } from '../../shared/api/bookings';
import { nowInZone } from '../../shared/date/timezone';
import { nextSlotsRefreshDelay } from './slots';

const TIMER_BUFFER_MS = 1000;

/**
 * Держит кэш слотов в синхронизации с «текущим моментом» сервера: к старту
 * ближайшего будущего слота или к ближайшей полуночи в таймзоне конфига
 * инвалидирует `['slots', eventTypeId]` и перепланирует таймер. Между этими
 * моментами ответ сервера не меняется, поэтому периодические запросы не нужны.
 */
export function useSlotsRefresh(
  eventTypeId: string,
  slots: Slot[] | undefined,
  timezone: string | undefined,
) {
  const queryClient = useQueryClient();
  const latest = useRef({ slots, timezone });
  latest.current = { slots, timezone };

  useEffect(() => {
    if (!timezone) return;
    let timer: number | undefined;

    const schedule = () => {
      window.clearTimeout(timer);
      const { slots: list, timezone: tz } = latest.current;
      if (!tz) return;
      const delay = nextSlotsRefreshDelay(list ?? [], nowInZone(tz)) + TIMER_BUFFER_MS;
      timer = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['slots', eventTypeId] });
        schedule();
      }, delay);
    };

    schedule();
    return () => {
      window.clearTimeout(timer);
    };
  }, [eventTypeId, queryClient, slots, timezone]);
}
