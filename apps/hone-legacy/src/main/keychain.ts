// keychain.ts — обёртка над Electron safeStorage с дисковым backing-файлом.
//
// Почему safeStorage, а не keytar:
//   keytar требует native build (node-gyp + Python) — на Phase 5a это
//   вешало `npm install` на 15+ минут на чистой машине. safeStorage
//   встроен в Electron 15+, использует те же OS-API'ы (macOS Keychain /
//   gnome-keyring / Windows Credential Vault) через приложение, без
//   native deps.
//
// «druz9-auth-token». Из-за potential auth-loss риск для уже
// залогиненных юзеров делаем отдельным миграционным PR'ом. Текущий
// flow: оба приложения логинят пользователя через web-OAuth (druz9://
// deep-link), каждый держит свой токен; функционально работает.
//
// safeStorage шифрует/расшифровывает строку в Buffer. Шифр привязан к
// аккаунту OS-юзера, переносить файл между машинами/юзерами бесполезно
// — расшифровать на другой машине нельзя. Это и нужно.
//
// Почему дисковый backing: safeStorage — синхронный, но stateless. Сама
// строка храним в файле app.getPath('userData')/auth.bin. Чистится только
// на logout / при невозможности расшифровать.

import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import type { AuthSession } from '@shared/ipc';

const filename = 'auth.bin';

function authPath(): string {
  return join(app.getPath('userData'), filename);
}

// load расшифровывает файл если он есть. Возвращает null когда:
//   - файла нет (новый юзер);
//   - safeStorage не доступен (Linux без gnome-keyring/kwallet);
//   - файл повреждён или ключ изменился (например, OS-юзер сменил пароль
//     на машинах где safeStorage привязан к нему).
export async function loadSession(): Promise<AuthSession | null> {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }
    const buf = await fs.readFile(authPath());
    const raw = safeStorage.decryptString(buf);
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.accessToken || !parsed.userId) return null;
    return parsed;
  } catch {
    // ENOENT, decrypt error, или невалидный JSON — все ведут к "fresh start".
    return null;
  }
}

// save шифрует и пишет атомарно (write-then-rename) чтобы парциальный
// рестарт не оставил половинный файл.
export async function saveSession(session: AuthSession): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('keychain.save: safeStorage not available on this OS');
  }
  const json = JSON.stringify(session);
  const enc = safeStorage.encryptString(json);
  const dst = authPath();
  const tmp = `${dst}.tmp`;
  await fs.writeFile(tmp, enc, { mode: 0o600 });
  await fs.rename(tmp, dst);
}

// clear удаляет файл. Игнорирует ENOENT — logout без сессии тоже валиден.
export async function clearSession(): Promise<void> {
  try {
    await fs.unlink(authPath());
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
