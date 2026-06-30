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

/** Localized time — hour cycle follows locale (24h ru-RU, 12h en-US). */
export function formatLocaleTime(date: Date, locale?: Locale): string {
  return date.toLocaleTimeString(tag(locale), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: getUserTimeZone(),
  });
}

/** Hour label for calendar / timeline grids (no minutes). */
export function formatLocaleHour(hour: number, locale?: Locale): string {
  const d = new Date(2000, 0, 1, hour, 0);
  return d.toLocaleTimeString(tag(locale), {
    hour: 'numeric',
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
