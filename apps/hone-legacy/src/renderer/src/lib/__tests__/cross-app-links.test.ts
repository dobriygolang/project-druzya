import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../api/config', () => ({
  WEB_BASE_URL: 'https://druz9.test',
  API_BASE_URL: 'https://api.druz9.test',
  DEV_BEARER_TOKEN: null,
  PRO_UPGRADE_URL_BASE: 'https://druz9.test/upgrade',
  PRO_BYOK_URL: 'https://druz9.test/byok',
}));

interface BridgeShell {
  openExternal: (url: string) => Promise<void>;
}
interface BridgeAttached {
  shell?: BridgeShell;
}
interface WindowWithBridge {
  hone?: BridgeAttached;
}
const winBridge = window as unknown as WindowWithBridge;

const opened: string[] = [];
const openExternalMock = vi.fn((url: string) => {
  opened.push(url);
  return Promise.resolve();
});
const windowOpenMock = vi.fn();

beforeEach(() => {
  opened.length = 0;
  openExternalMock.mockClear();
  windowOpenMock.mockClear();
  winBridge.hone = { shell: { openExternal: openExternalMock } };
  window.open = windowOpenMock as typeof window.open;
});

afterEach(() => {
  delete winBridge.hone;
});

describe('cross-app-links — URL building', () => {
  it('openDruz9Web → /welcome with source=hone', async () => {
    const { openDruz9Web } = await import('../cross-app-links');
    openDruz9Web();
    const u = new URL(opened[0]);
    expect(u.pathname).toBe('/welcome');
    expect(u.searchParams.get('source')).toBe('hone');
  });

  it('openWebBilling → /pricing', async () => {
    const { openWebBilling } = await import('../cross-app-links');
    openWebBilling();
    expect(new URL(opened[0]).pathname).toBe('/pricing');
  });

  it('openWebLiveRoom with roomId → /live/<id>', async () => {
    const { openWebLiveRoom } = await import('../cross-app-links');
    openWebLiveRoom({ roomId: 'room-42' });
    expect(new URL(opened[0]).pathname).toBe('/live/room-42');
    openWebLiveRoom();
    expect(new URL(opened[1]).pathname).toBe('/live/new');
  });

  it('openCueInstall → /cue/download', async () => {
    const { openCueInstall } = await import('../cross-app-links');
    openCueInstall();
    expect(new URL(opened[0]).pathname).toBe('/cue/download');
  });
});

describe('cross-app-links — dispatch', () => {
  it('use bridge.shell.openExternal when present', async () => {
    const { openDruz9Web } = await import('../cross-app-links');
    openDruz9Web();
    expect(openExternalMock).toHaveBeenCalledTimes(1);
    expect(windowOpenMock).not.toHaveBeenCalled();
  });

  it('fallback to window.open when bridge absent', async () => {
    delete winBridge.hone;
    const { openDruz9Web } = await import('../cross-app-links');
    openDruz9Web();
    expect(windowOpenMock).toHaveBeenCalledTimes(1);
  });
});
