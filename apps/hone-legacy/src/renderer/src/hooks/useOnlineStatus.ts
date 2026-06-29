// useOnlineStatus — реактивно следит за navigator.onLine + window.online/offline
// events. Возвращает true если internet connection доступен (по browser-данным).
//
// КАВЕАТЫ:
// - navigator.onLine точно знает только когда interface DOWN (Wi-Fi отключили,
//   ethernet выдернули). Не детектит «captive portal» / «DNS failure» / «server
//   unreachable» — для этого нужен probe (отдельный механизм). Этого пока
//   достаточно: 90% юзер-кейсов «положил laptop в сумку, поезд → tunnel» и
//   «выкл WiFi роутер» покрываются.
// - В Electron window.navigator.onLine есть и работает.
//
// Использование:
//   const online = useOnlineStatus();
//   <button disabled={!online} title={online ? 'Share' : 'Offline'}>...</button>
import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return online;
}
