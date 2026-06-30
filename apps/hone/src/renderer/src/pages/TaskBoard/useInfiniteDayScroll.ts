import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { buildDayWindow, toDayKey, type DayKey } from './lib/dates';

export const DAY_COL_WIDTH = 254;
export const DAY_COL_GAP = 10;
export const DAY_COL_STRIDE = DAY_COL_WIDTH + DAY_COL_GAP;

const INITIAL_PAST = 14;
const INITIAL_FUTURE = 21;
const BATCH = 14;
const EDGE_THRESHOLD_COLS = 3;
const FAR_FROM_TODAY_COLS = 7;
const SCROLL_IDLE_MS = 150;

interface UseInfiniteDayScrollResult {
  days: DayKey[];
  scrollRef: React.RefObject<HTMLDivElement>;
  showBackToToday: boolean;
  scrollToToday: () => void;
  ensureDayVisible: (dayKey: string) => void;
  expandRangeForDayKeys: (dayKeys: string[]) => void;
}

export function useInfiniteDayScroll(today: Date): UseInfiniteDayScrollResult {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rangeStart, setRangeStart] = useState(-INITIAL_PAST);
  const [rangeEnd, setRangeEnd] = useState(INITIAL_FUTURE);
  const [showBackToToday, setShowBackToToday] = useState(false);
  const [returningToToday, setReturningToToday] = useState(false);

  const scrollAdjustRef = useRef(0);
  const loadingPastRef = useRef(false);
  const loadingFutureRef = useRef(false);
  const didInitialScrollRef = useRef(false);
  const pendingScrollTodayRef = useRef(false);
  const pendingScrollDayKeyRef = useRef<string | null>(null);
  const returningToTodayRef = useRef(false);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const scrollSettledRef = useRef(true);
  const farFromTodayRef = useRef(false);

  const todayKey = toDayKey(today);

  const days = useMemo(
    () => buildDayWindow(today, -rangeStart, rangeEnd),
    [today, rangeStart, rangeEnd],
  );

  const todayIndex = useMemo(
    () => days.findIndex((d) => d.key === todayKey),
    [days, todayKey],
  );

  const syncBackButton = useCallback(() => {
    const el = scrollRef.current;
    if (!el || todayIndex < 0 || returningToTodayRef.current) {
      setShowBackToToday(false);
      farFromTodayRef.current = false;
      return;
    }
    const todayLeft = todayIndex * DAY_COL_STRIDE;
    const viewCenter = el.scrollLeft + el.clientWidth / 2;
    const todayCenter = todayLeft + DAY_COL_WIDTH / 2;
    const dayOffset = Math.round((viewCenter - todayCenter) / DAY_COL_STRIDE);
    const far = Math.abs(dayOffset) >= FAR_FROM_TODAY_COLS;
    farFromTodayRef.current = far;
    const next = far && scrollSettledRef.current;
    setShowBackToToday((prev) => (prev === next ? prev : next));
  }, [todayIndex]);

  const scheduleBackButtonSync = useCallback(() => {
    if (scrollIdleTimerRef.current !== null) {
      window.clearTimeout(scrollIdleTimerRef.current);
    }
    scrollSettledRef.current = false;
    setShowBackToToday(false);

    scrollIdleTimerRef.current = window.setTimeout(() => {
      scrollIdleTimerRef.current = null;
      scrollSettledRef.current = true;
      syncBackButton();
    }, SCROLL_IDLE_MS);
  }, [syncBackButton]);

  const extendPast = useCallback(() => {
    if (loadingPastRef.current) return;
    loadingPastRef.current = true;
    scrollAdjustRef.current += BATCH * DAY_COL_STRIDE;
    setRangeStart((s) => s - BATCH);
  }, []);

  const extendFuture = useCallback(() => {
    if (loadingFutureRef.current) return;
    loadingFutureRef.current = true;
    setRangeEnd((e) => e + BATCH);
  }, []);

  const scrollToDayIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el || index < 0) return;
    el.scrollTo({
      left: Math.max(0, index * DAY_COL_STRIDE - el.clientWidth * 0.35),
      behavior,
    });
  }, []);

  const scrollToToday = useCallback(() => {
    returningToTodayRef.current = true;
    setReturningToToday(true);
    setShowBackToToday(false);
    farFromTodayRef.current = false;
    pendingScrollTodayRef.current = true;
    pendingScrollDayKeyRef.current = null;
    setRangeStart(-INITIAL_PAST);
    setRangeEnd(INITIAL_FUTURE);
  }, []);

  const ensureDayVisible = useCallback(
    (dayKey: string) => {
      if (returningToTodayRef.current) return;
      const target = parseDayKeySafe(dayKey);
      if (!target) return;
      const offset = dayOffsetFrom(today, target);
      setRangeStart((s) => Math.min(s, offset - BATCH));
      setRangeEnd((e) => Math.max(e, offset + BATCH));
      pendingScrollTodayRef.current = false;
      pendingScrollDayKeyRef.current = dayKey;
    },
    [today],
  );

  const expandRangeForDayKeys = useCallback(
    (dayKeys: string[]) => {
      if (dayKeys.length === 0 || returningToTodayRef.current) return;
      let minOffset = 0;
      let maxOffset = 0;
      let hasOffset = false;
      for (const dayKey of dayKeys) {
        const target = parseDayKeySafe(dayKey);
        if (!target) continue;
        const offset = dayOffsetFrom(today, target);
        if (!hasOffset) {
          minOffset = offset;
          maxOffset = offset;
          hasOffset = true;
        } else {
          minOffset = Math.min(minOffset, offset);
          maxOffset = Math.max(maxOffset, offset);
        }
      }
      if (!hasOffset) return;
      setRangeStart((s) => Math.min(s, minOffset - BATCH));
      setRangeEnd((e) => Math.max(e, maxOffset + BATCH));
    },
    [today],
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (scrollAdjustRef.current !== 0) {
      el.scrollLeft += scrollAdjustRef.current;
      scrollAdjustRef.current = 0;
      loadingPastRef.current = false;
    }

    if (loadingFutureRef.current) {
      loadingFutureRef.current = false;
    }

    if (!didInitialScrollRef.current && todayIndex >= 0) {
      scrollToDayIndex(todayIndex, 'auto');
      didInitialScrollRef.current = true;
      syncBackButton();
      return;
    }

    if (pendingScrollTodayRef.current && todayIndex >= 0) {
      scrollToDayIndex(todayIndex, 'auto');
      pendingScrollTodayRef.current = false;
      returningToTodayRef.current = false;
      setReturningToToday(false);
      scrollSettledRef.current = true;
      syncBackButton();
      return;
    }

    if (pendingScrollDayKeyRef.current) {
      const idx = days.findIndex((d) => d.key === pendingScrollDayKeyRef.current);
      if (idx >= 0) {
        scrollToDayIndex(idx, 'auto');
        pendingScrollDayKeyRef.current = null;
        syncBackButton();
      }
    }
  }, [days, todayIndex, scrollToDayIndex, syncBackButton]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      scheduleBackButtonSync();

      if (returningToTodayRef.current) return;

      const threshold = EDGE_THRESHOLD_COLS * DAY_COL_STRIDE;
      if (el.scrollLeft < threshold) {
        extendPast();
      } else if (el.scrollLeft + el.clientWidth > el.scrollWidth - threshold) {
        extendFuture();
      }
    };

    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (scrollIdleTimerRef.current !== null) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }
    };
  }, [scheduleBackButtonSync, extendPast, extendFuture, days.length]);

  return {
    days,
    scrollRef,
    showBackToToday: showBackToToday && !returningToToday,
    scrollToToday,
    ensureDayVisible,
    expandRangeForDayKeys,
  };
}

function parseDayKeySafe(key: string): Date | null {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function dayOffsetFrom(anchor: Date, target: Date): number {
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((t.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}
