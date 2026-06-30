// TrafficLightsHover — невидимая горячая зона в левом верхнем углу.
// Mouseenter показывает macOS traffic-light кнопки (close / minimise / zoom),
// mouseleave прячет. Главное окно стартует с setWindowButtonVisibility(false).
//
// Прежняя версия имела race condition: hideTimer хранился в локальной let
// и обнулялся на каждом ре-рендере (старый таймер успевал скрыть кнопки
// посреди следующего hover'а), а IPC вызовы шли на каждый event без
// дедупликации — даже когда state уже совпадал. Когда macOS-нативные
// traffic-light кнопки появлялись поверх нашего React-div, движение мыши
// с одной кнопки на другую генерировало ложный mouseleave (cursor
// «уходит» с div под нативный widget) → таймер на скрытие → кнопки
// мигали / прыгали.
//
// Фикс: useRef для таймера (стабилен между рендерами), глобальный
// mousemove-listener считает hit-test по screen-coord (не зависит от
// нативных оверлеев), и memo'изация текущего state — IPC вызывается
// только при реальной смене visible/hidden.
import { memo, useEffect, useRef, type CSSProperties } from 'react';

// Hover-зона. ВАЖНО: должна совпадать с inline-style ниже — оба значения
// используются и React-onMouseEnter (как fallback), и глобальным mousemove.
const ZONE_WIDTH = 140;
const ZONE_HEIGHT = 56;

// Задержка перед скрытием. 350ms — комфортный буфер чтобы юзер успел
// довести курсор от Wordmark'а до кнопки и не дёргать show/hide на
// транзитном движении мыши.
const HIDE_DELAY_MS = 350;

const ZONE_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: ZONE_WIDTH,
  height: ZONE_HEIGHT,
  zIndex: 5,
  pointerEvents: 'none',
  WebkitAppRegion: 'no-drag',
} as CSSProperties;

export const TrafficLightsHover = memo(function TrafficLightsHover() {
  const hideTimerRef = useRef<number | null>(null);
  const visibleRef = useRef(false);

  useEffect(() => {
    function setVisible(next: boolean): void {
      if (visibleRef.current === next) return; // dedupe — IPC не шлём впустую
      visibleRef.current = next;
      void window.hone?.window.setTrafficLights(next);
    }

    function clearHideTimer(): void {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }

    function scheduleHide(): void {
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null;
        setVisible(false);
      }, HIDE_DELAY_MS);
    }

    // Hit-test по screen coords — не зависит от того, какой widget сейчас
    // нарисован поверх (нативные buttons macOS не передают mouseleave в
    // React-div, поэтому полагаться на onMouseLeave недостаточно).
    function onMove(e: MouseEvent): void {
      const inside = e.clientX >= 0 && e.clientX < ZONE_WIDTH && e.clientY >= 0 && e.clientY < ZONE_HEIGHT;
      if (inside) {
        clearHideTimer();
        setVisible(true);
      } else if (visibleRef.current) {
        // Только если уже видны — иначе зря таймер плодим.
        if (hideTimerRef.current === null) scheduleHide();
      }
    }

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      clearHideTimer();
      void window.hone?.window.setTrafficLights(false);
    };
  }, []);

  return <div style={ZONE_STYLE} />;
});
