// StatsOverlay — Stats как floating right-aside поверх HomePage. Карточки
// stagger'ом slide-from-right, не full-page modal — юзер видит фон/timer
// и не теряет контекст.
//
// Cards (по порядку):
//   1. Focus Activity   — heatmap + 5-dot intensity legend top-right
//   2. Current Streak   — large «N days» + «Longest: M» + smooth curve
//   3. Focused Time     — bar-chart за 7 дней + LAST 7 DAYS + Mon/20 labels
//   4. Insights         — 4-cell grid: avg, total sessions, focused days, hrs
//
// Закрытие — Esc / S hotkey (управляется родителем) / клик по ESC button.
import { useEffect, useMemo, useState } from 'react';
import { ConnectError, Code } from '@connectrpc/connect';

import { useT, useLocale, type TFunc } from '@d9-i18n';

import { getStats, padToSevenDays, type HoneStats, type FocusDay } from '@features/focus/api/focusClient';
import { formatWeekdayShort } from '@pages/TaskBoard/lib/dates';
import { readDailyGoalMin } from '@shared/model/prefs';

interface FetchState {
  status: 'loading' | 'ok' | 'error';
  data: HoneStats | null;
  errorCode: Code | null;
  errorMsg: string | null;
}

const INITIAL: FetchState = { status: 'loading', data: null, errorCode: null, errorMsg: null };

const BIG_NUMBER_STYLE: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: 'var(--ink)',
};

const BASELINE_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 5,
};

export function StatsOverlayCards({ onClose: _onClose, closing = false }: { onClose: () => void; closing?: boolean }) {
  const t = useT();
  const [locale] = useLocale();
  const [state, setState] = useState<FetchState>(INITIAL);
  void _onClose;

  useEffect(() => {
    let cancelled = false;
    getStats()
      .then((data) => {
        if (cancelled) return;
        setState({ status: 'ok', data, errorCode: null, errorMsg: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const ce = ConnectError.from(err);
        setState({
          status: 'error',
          data: null,
          errorCode: ce.code,
          errorMsg: ce.rawMessage || ce.message,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = state.data;
  // Backend возвращает ТОЛЬКО дни с focus (если юзер 6 дней не работал,
  // прилетает 1 запись). UI должен показывать 7 столбиков всегда — pad'им
  // empty-days с seconds=0 чтобы visual был стабилен «понедельник…воскресенье».
  // Memoize: padToSevenDays строит 7-элементный массив + new Date(); без memo
  // re-aллоцируется каждый render-pass overlay'а (например при animTick child'ов).
  const lastSeven = useMemo(() => padToSevenDays(data?.lastSevenDays ?? []), [data]);
  const sparkSeries = useMemo(() => lastSeven.map((d) => d.seconds), [lastSeven]);

  return (
    <>
      {/* RIGHT column: 4 stacked cards */}
      <aside
        style={{
          position: 'absolute',
          right: 32,
          top: 56,
          // bottom=130 раньше "ел" нижние ~130px и Insights-карточка
          // обрезалась если у юзера невысокий window. 24 — достаточный
          // воздух от bottom edge'а; всё что не помещается — scroll.
          bottom: 24,
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 12,
          pointerEvents: 'auto',
          overflow: 'auto',
          // Padding-bottom гарантирует последняя карточка имеет breathing
          // space перед scroll-end (без него Insights казался обрезанным
          // даже когда был fully visible — visual perception bias).
          paddingBottom: 24,
        }}
      >
        {/* 1. Focus Activity */}
        <div className={closing ? 'slide-to-right' : 'slide-from-right'} style={{ animationDelay: closing ? '120ms' : '0ms' }}>
          <BigCard>
            <CardHead title={t('hone.stats.focus_activity')} right={<HeatmapLegend />} />
            <ReferenceHeatmap days={data?.heatmap ?? []} />
          </BigCard>
        </div>

        {/* 2. Current Streak */}
        <div className={closing ? 'slide-to-right' : 'slide-from-right'} style={{ animationDelay: closing ? '80ms' : '80ms' }}>
          <BigCard>
            <CardHead title={t('hone.stats.current_streak')} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'end',
                gap: 18,
                marginTop: 4,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                  <span
                    style={{
                      fontSize: 32,
                      fontWeight: 600,
                      letterSpacing: '-0.03em',
                      lineHeight: 1,
                      color: 'var(--ink)',
                    }}
                  >
                    {data?.currentStreakDays ?? 0}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-40)' }}>{t('hone.stats.days')}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-40)' }}>
                  {t('hone.stats.longest')}{' '}
                  <span style={{ color: 'var(--ink-90)' }}>{data?.longestStreakDays ?? 0}</span>
                </div>
              </div>
              <StreakCurve points={sparkSeries} />
            </div>
          </BigCard>
        </div>

        {/* 3. Focused Time */}
        <div className={closing ? 'slide-to-right' : 'slide-from-right'} style={{ animationDelay: closing ? '40ms' : '160ms' }}>
          <BigCard>
            <CardHead
              title={t('hone.stats.focused_time')}
              right={<MetaLabel>{t('hone.stats.last_7_days').toUpperCase()}</MetaLabel>}
            />
            <ReferenceBars days={lastSeven} locale={locale} />
          </BigCard>
        </div>

        {/* 4. Insights */}
        <div className={closing ? 'slide-to-right' : 'slide-from-right'} style={{ animationDelay: closing ? '0ms' : '240ms' }}>
          <BigCard>
            <CardHead title={t('hone.stats.insights')} />
            <InsightsGrid data={data} t={t} />
          </BigCard>
        </div>

        {state.status === 'error' && state.errorCode === Code.Unauthenticated && (
          <div
            className={`mono hone-stats-card hone-stats-notice ${closing ? 'slide-to-right' : 'slide-from-right'}`}
            style={{ animationDelay: closing ? '0ms' : '320ms' }}
          >
            {t('hone.stats.sign_in_required').toUpperCase()}
          </div>
        )}
      </aside>

    </>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────────

function BigCard({ children }: { children: React.ReactNode }) {
  return <section className="hone-stats-card">{children}</section>;
}

function CardHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 14,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
        }}
      >
        {title}
      </h3>
      {right}
    </div>
  );
}

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 9.5,
        letterSpacing: '0.08em',
        color: 'var(--ink-40)',
      }}
    >
      {children}
    </span>
  );
}

// ─── Heatmap legend (5 dots, increasing brightness) ──────────────────────

function HeatmapLegend() {
  const opacities = [0.08, 0.18, 0.32, 0.5, 0.95];
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {opacities.map((o, i) => (
        <span
          key={i}
          style={{
            width: 9,
            height: 9,
            borderRadius: 2,
            background: `rgb(var(--ink-rgb) / ${o})`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Reference Heatmap — 7×N grid, opacity по бакетам ────────────────────

const HEATMAP_CELLS = 7 * 16; // ужали до 16 колонок чтобы влезло в 320px aside

function ReferenceHeatmap({ days }: { days: FocusDay[] }) {
  // 112 cells × `new Date` clone — non-trivial без memo, особенно когда
  // sibling карточки рендерятся (animTick changes etc). Pure-функция от
  // `days`, кешируем по identity.
  const cells = useMemo(() => {
    const bySeconds = new Map(days.map((d) => [d.date, d.seconds]));
    const todayISO = days.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
    const anchor = new Date(`${todayISO}T00:00:00Z`);
    const out: { iso: string; seconds: number; isToday: boolean }[] = [];
    for (let i = HEATMAP_CELLS - 1; i >= 0; i--) {
      const d = new Date(anchor);
      d.setUTCDate(anchor.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push({ iso, seconds: bySeconds.get(iso) ?? 0, isToday: iso === todayISO });
    }
    return out;
  }, [days]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'repeat(7, 1fr)',
        gridAutoFlow: 'column',
        gridAutoColumns: '1fr',
        gap: 3,
      }}
    >
      {cells.map((c) => (
        <span
          key={c.iso}
          title={`${c.iso} · ${Math.round(c.seconds / 60)}m`}
          style={{
            aspectRatio: '1/1',
            borderRadius: 2,
            background: c.isToday
              ? 'rgb(var(--ink-rgb) / 0.95)'
              : `rgb(var(--ink-rgb) / ${heatmapOpacity(c.seconds)})`,
          }}
        />
      ))}
    </div>
  );
}

function heatmapOpacity(seconds: number): number {
  if (seconds <= 0) return 0.04;
  if (seconds < 600) return 0.12;
  if (seconds < 1800) return 0.22;
  if (seconds < 3600) return 0.36;
  if (seconds < 7200) return 0.52;
  return 0.78;
}

// ─── Streak curve sparkline (Catmull-Rom → Bezier) ───────────────────────

function StreakCurve({ points }: { points: number[] }) {
  // Draw-on entrance: path animates via stroke-dashoffset от full-length
  // до 0. Mountain-style motion. Mirror'ит bars-anim из ReferenceBars.
  const [animTick, setAnimTick] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setAnimTick(1), 50);
    return () => window.clearTimeout(t);
  }, []);
  const W = 120;
  const H = 42;
  if (points.length < 2) {
    return <svg width={W} height={H} style={{ display: 'block' }} />;
  }
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = Math.max(1, max - min);
  const xy = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - ((p - min) / span) * (H - 6) - 3;
    return [x, y] as [number, number];
  });
  let path = `M${xy[0]![0].toFixed(1)} ${xy[0]![1].toFixed(1)}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[Math.max(0, i - 1)]!;
    const p1 = xy[i]!;
    const p2 = xy[i + 1]!;
    const p3 = xy[Math.min(xy.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    path += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  // Длина path'а (приблизительно) для анимации stroke-dashoffset. Мы не
  // знаем точную длину без getTotalLength, но 3*W достаточно — strokeDasharray
  // длиннее path всё равно работает: dasharray=L+ дёт нам ОДИН непрерывный
  // штрих. Анимируем offset от L+ до 0.
  const dashLen = W * 3;
  // Area-fill path — закрытая фигура (curve + bottom line) чтобы под кривой
  // был тонкий «волновой» градиент. Раньше при near-zero данных curve была
  // почти невидимой; теперь fill под ней даёт явный visual signal.
  const areaPath = path + ` L${W} ${H} L0 ${H} Z`;
  const gradId = 'streak-curve-fill';
  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--ink-rgb) / 0.45)" />
          <stop offset="100%" stopColor="rgb(var(--ink-rgb) / 0)" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#${gradId})`}
        opacity={animTick === 0 ? 0 : 1}
        style={{ transition: 'opacity var(--motion-dur-cinematic) var(--motion-ease-standard) 200ms' }}
      />
      <path
        d={path}
        fill="none"
        stroke="rgb(var(--ink-rgb) / 0.95)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray={dashLen}
        strokeDashoffset={animTick === 0 ? dashLen : 0}
        style={{ transition: 'stroke-dashoffset var(--motion-dur-cinematic) var(--motion-ease-standard)' }}
      />
    </svg>
  );
}

// ─── Reference Bars ──────────────────────────────────────────────────────

function ReferenceBars({ days, locale }: { days: FocusDay[]; locale: 'en' | 'ru' }) {
  // Mount-anim: bars стартуют на 0 и растут до final-height после первого
  // paint'а. Mirror «mountain motion» style как у StreakCurve, только тут
  // эффект — растущие колонки. Без этого bars появляются instantly и
  // выглядят статично; user'у нужно «расцветание».
  const [animTick, setAnimTick] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setAnimTick(1), 30);
    return () => window.clearTimeout(t);
  }, []);

  const todayISO = days.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
  // Absolute scale: 24h = 100% bar-height. Раньше был relative-max (max
  // bucket в данных = 100%) — 3 часа в один день рендерились full-height,
  // юзер не мог сравнить с другим днём. Теперь абсолютная шкала: 3 часа =
  // 12.5% bar height; 8 часов = 33%; 24 часа = 100%. Юзер видит реальную
  // долю focused-time от 24h.
  const FULL_DAY_SECONDS = 24 * 60 * 60;
  const maxSeconds = FULL_DAY_SECONDS;
  const MAX_H = 90;
  const MIN_H = 10;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${days.length || 7}, 1fr)`,
        gap: 8,
        alignItems: 'end',
        height: MAX_H + 44,
      }}
    >
      {days.map((d, i) => {
        const ratio = d.seconds / maxSeconds;
        const targetH = d.seconds > 0 ? MIN_H + ratio * (MAX_H - MIN_H) : MIN_H;
        // animTick=0 → bars at 0, после mount'а tick=1 → растут до target.
        // staggered delay чтобы bars росли по очереди, не все вместе.
        const h = animTick === 0 ? 0 : targetH;
        const isToday = d.date === todayISO;
        return (
          <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: '100%', height: MAX_H, display: 'flex', alignItems: 'flex-end' }}>
              <div
                style={{
                  width: '100%',
                  height: h,
                  background: isToday ? 'rgb(var(--ink-rgb) / 0.95)' : 'var(--ink-tint-16)',
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  transition: `height var(--motion-dur-xxlarge) var(--motion-ease-standard) ${i * 60}ms`,
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: isToday ? 'var(--ink)' : 'var(--ink-60)',
                }}
              >
                {formatWeekdayShort(d.date, locale)}
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--ink-40)' }}>
                {dayOfMonth(d.date)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function dayOfMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return String(d.getUTCDate());
}

// ─── Insights grid ───────────────────────────────────────────────────────

// InsightsGrid — redesigned. Раньше было 4 одинаковых number-cell'а
// (avg / total sessions / focused days / total hrs) — мёртвая статика.
// Теперь 4 РАЗНЫХ виджета, каждый показывает что-то полезное:
//
//   1. Streak progress ring   — circular goal=14 days, fill = current
//   2. Compare with last week — this-week-hrs vs last-week-hrs ± delta
//   3. Goal-meter             — daily goal (default 2h) + progress today
//   4. Best hour heatmap      — when you focus most (24×1 grid)
//
// Daily goal живёт в localStorage `hone:daily-focus-goal-min` (default 120).
// Pure-client computation — heavy work уже сделана reader'ом, тут только
// derive'аем из существующего HoneStats.

function InsightsGrid({ data, t }: { data: HoneStats | null; t: TFunc }) {
  // ── Streak ring: goal 14 days (free-tier soft target)
  const STREAK_GOAL = 14;
  // Daily goal: localStorage settable, default 2h (120min). readDailyGoalMin
  // — sync localStorage read; cheap but держим за useMemo ради consistency
  // (без deps: re-evaluate'ится только при mount/re-render всего InsightsGrid).
  const dailyGoalMin = readDailyGoalMin();

  // Heavy block: reduces по heatmap (90+ дней) + 14-step Date loop + 2x
  // build'ы Map. Без memo вызывается каждый раз когда родитель re-render'ит
  // (StatsOverlay re-render'ится при animTick child'ов через context/state).
  const derived = useMemo(() => {
    const heatmap = data?.heatmap ?? [];
    const lastSeven = data?.lastSevenDays ?? [];
    const todayISO = lastSeven.at(-1)?.date ?? new Date().toISOString().slice(0, 10);

    // ── Compare-week: текущая неделя (last 7) vs prev 7
    const thisWeekSec = lastSeven.reduce((s, d) => s + d.seconds, 0);
    const heatmapByISO = new Map(heatmap.map((d) => [d.date, d]));
    const prevWeekISOs: string[] = [];
    {
      const t = new Date(`${todayISO}T00:00:00Z`);
      for (let i = 7; i < 14; i++) {
        const d = new Date(t);
        d.setUTCDate(t.getUTCDate() - i);
        prevWeekISOs.push(d.toISOString().slice(0, 10));
      }
    }
    const prevWeekSec = prevWeekISOs.reduce(
      (s, iso) => s + (heatmapByISO.get(iso)?.seconds ?? 0),
      0,
    );
    const weekDeltaPct = prevWeekSec > 0
      ? Math.round(((thisWeekSec - prevWeekSec) / prevWeekSec) * 100)
      : (thisWeekSec > 0 ? 100 : 0);

    const streakPct = Math.min(100, ((data?.currentStreakDays ?? 0) / STREAK_GOAL) * 100);

    const todaySec = lastSeven.find((d) => d.date === todayISO)?.seconds ?? 0;
    const todayMin = Math.round(todaySec / 60);

    // ── Avg session length — полезный «качественный» сигнал. Streak меряет
    // консистентность, Compare-week — общий объём, Goal-meter — сегодня. Avg
    // session length показывает: ты делаешь короткие 25-min pomodoro или
    // длинные deep-work блоки. Считаем над heatmap window (90+ days) для
    // стабильности — week'ом было бы очень шумно при низком N.
    let totalSecondsAll = 0;
    let totalSessionsAll = 0;
    for (const d of heatmap) {
      totalSecondsAll += d.seconds;
      totalSessionsAll += d.sessions || 0;
    }
    const avgSessionMin = totalSessionsAll > 0
      ? Math.round(totalSecondsAll / totalSessionsAll / 60)
      : 0;

    return {
      thisWeekSec,
      prevWeekSec,
      weekDeltaPct,
      streakPct,
      todayMin,
      totalSessionsAll,
      avgSessionMin,
    };
  }, [data]);

  const { thisWeekSec, prevWeekSec, weekDeltaPct, streakPct, todayMin, totalSessionsAll, avgSessionMin } = derived;
  const goalPct = Math.min(100, (todayMin / Math.max(1, dailyGoalMin)) * 100);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px 14px',
        marginTop: 2,
      }}
    >
      <StreakRingCell streakDays={data?.currentStreakDays ?? 0} pct={streakPct} goal={STREAK_GOAL} t={t} />
      <CompareWeekCell thisHrs={thisWeekSec / 3600} prevHrs={prevWeekSec / 3600} deltaPct={weekDeltaPct} t={t} />
      <GoalMeterCell todayMin={todayMin} goalMin={dailyGoalMin} pct={goalPct} t={t} />
      <SimpleStatCell
        value={String(avgSessionMin)}
        unit="min"
        label={t('hone.stats.avg_session')}
        sub={
          totalSessionsAll > 0
            ? t('hone.stats.sessions_total', { n: totalSessionsAll })
            : t('hone.stats.no_data_yet')
        }
      />
    </div>
  );
}

// ─── Streak ring (SVG circular progress) ─────────────────────────────────

function StreakRingCell({
  streakDays,
  pct,
  goal,
  t,
}: {
  streakDays: number;
  pct: number;
  goal: number;
  t: TFunc;
}) {
  const SIZE = 56;
  const STROKE = 4;
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;
  // Anim: dasharray от пустого к pct
  const [animTick, setAnimTick] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setAnimTick(1), 60);
    return () => window.clearTimeout(id);
  }, []);
  const offset = animTick === 0 ? C : C - (C * pct) / 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={SIZE} height={SIZE} style={{ flexShrink: 0 }}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--ink-tint-08)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="rgb(var(--ink-rgb) / 0.95)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: 'stroke-dashoffset var(--motion-dur-cinematic) var(--motion-ease-standard)' }}
        />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={BIG_NUMBER_STYLE}>
            {streakDays}
          </span>
          <span style={{ fontSize: 10, color: 'var(--ink-40)' }}>{t('hone.stats.days_of_goal', { goal })}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink-40)' }}>{t('hone.stats.streak_goal')}</div>
      </div>
    </div>
  );
}

// ─── Compare with last week ──────────────────────────────────────────────

function CompareWeekCell({
  thisHrs,
  prevHrs,
  deltaPct,
  t,
}: {
  thisHrs: number;
  prevHrs: number;
  deltaPct: number;
  t: TFunc;
}) {
  const isUp = deltaPct >= 0;
  const tone = isUp ? 'var(--ink)' : 'var(--red)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={BASELINE_ROW}>
        <span style={BIG_NUMBER_STYLE}>
          {thisHrs.toFixed(1)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--ink-40)' }}>{t('hone.stats.hrs')}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: tone, marginLeft: 4 }}>
          {isUp ? '↑' : '↓'} {Math.abs(deltaPct)}%
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-40)' }}>
        {t('hone.stats.vs_last_week', { hrs: prevHrs.toFixed(1) })}
      </div>
    </div>
  );
}

// ─── Daily goal meter ────────────────────────────────────────────────────

function GoalMeterCell({
  todayMin,
  goalMin,
  pct,
  t,
}: {
  todayMin: number;
  goalMin: number;
  pct: number;
  t: TFunc;
}) {
  const reached = pct >= 100;
  const tone = reached ? 'var(--ink)' : 'rgb(var(--ink-rgb) / 0.85)';
  const [animTick, setAnimTick] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setAnimTick(1), 80);
    return () => window.clearTimeout(id);
  }, []);
  const w = animTick === 0 ? 0 : pct;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={BASELINE_ROW}>
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: tone }}>
          {todayMin}
        </span>
        <span style={{ fontSize: 10, color: 'var(--ink-40)' }}>{t('hone.stats.min_today', { goal: goalMin })}</span>
      </div>
      <div
        aria-hidden
        style={{
          height: 4,
          borderRadius: 2,
          background: 'var(--ink-tint-06)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${w}%`,
            background: tone,
            transition: 'width var(--motion-dur-cinematic) var(--motion-ease-standard)',
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-40)' }}>{t('hone.stats.daily_goal')}</div>
    </div>
  );
}

// ─── Best weekday ────────────────────────────────────────────────────────

// SimpleStatCell — generic «N unit / label / sub» tile. Заменил BestWeekday
// (дублировал данные heatmap'а).
function SimpleStatCell({ value, unit, label, sub }: { value: string; unit?: string; label: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={BASELINE_ROW}>
        <span style={BIG_NUMBER_STYLE}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 10, color: 'var(--ink-40)' }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-40)' }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--ink-20)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}


