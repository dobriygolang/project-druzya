import { getLocale, localeToBcp47, type Locale } from '@d9-i18n';

/** IANA timezone from the OS / browser (e.g. Europe/Moscow). */
export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function tag(locale?: Locale): string {
  return localeToBcp47(locale ?? getLocale());
}

/**
 * Whether the OS clock prefers 24-hour time, independent of the app's UI
 * language. macOS/Windows "24-Hour Time" is exposed through the runtime's
 * default `hourCycle`; we honor it so an English UI still shows 23:55 when the
 * machine is set to 24-hour. Returns `undefined` when it can't be determined
 * (then the locale's own convention is used).
 */
function systemPrefers24Hour(): boolean | undefined {
  try {
    const hourCycle = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
    }).resolvedOptions().hourCycle;
    if (hourCycle === 'h23' || hourCycle === 'h24') return true;
    if (hourCycle === 'h11' || hourCycle === 'h12') return false;
  } catch {
    /* fall through */
  }
  return undefined;
}

/** `hour12` override that follows the OS clock setting (undefined = leave to locale). */
function hour12Override(): boolean | undefined {
  const pref = systemPrefers24Hour();
  return pref === undefined ? undefined : !pref;
}

/** Localized time — language follows the app locale, 12/24h follows the OS clock. */
export function formatLocaleTime(date: Date, locale?: Locale): string {
  return date.toLocaleTimeString(tag(locale), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: hour12Override(),
    timeZone: getUserTimeZone(),
  });
}

/** Hour label for calendar / timeline grids (no minutes). */
export function formatLocaleHour(hour: number, locale?: Locale): string {
  const d = new Date(2000, 0, 1, hour, 0);
  return d.toLocaleTimeString(tag(locale), {
    hour: 'numeric',
    hour12: hour12Override(),
    timeZone: getUserTimeZone(),
  });
}

export function formatLocaleDate(
  date: Date,
  locale?: Locale,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return date.toLocaleDateString(tag(locale), {
    timeZone: getUserTimeZone(),
    ...options,
  });
}

/** JS `getDay()` value for the first column of a week (0 = Sun … 6 = Sat). */
export function getFirstDayOfWeek(locale?: Locale): number {
  const t = tag(locale);
  try {
    const info = (new Intl.Locale(t) as Intl.Locale & { weekInfo?: { firstDay?: number } }).weekInfo;
    if (info?.firstDay != null) {
      // ICU: 1 = Monday … 7 = Sunday
      return info.firstDay === 7 ? 0 : info.firstDay;
    }
  } catch {
    /* weekInfo unsupported */
  }
  return t.startsWith('ru') ? 1 : 0;
}

export function startOfLocaleWeek(d: Date, locale?: Locale): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const first = getFirstDayOfWeek(locale);
  const diff = (date.getDay() - first + 7) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

export function monthGridStartOffset(firstOfMonth: Date, locale?: Locale): number {
  const first = getFirstDayOfWeek(locale);
  return (firstOfMonth.getDay() - first + 7) % 7;
}

/** Human-readable timezone name in the user's locale. */
export function formatTimeZoneLabel(timeZone: string, locale?: Locale): string {
  try {
    const parts = new Intl.DateTimeFormat(tag(locale), {
      timeZone,
      timeZoneName: 'longGeneric',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}
