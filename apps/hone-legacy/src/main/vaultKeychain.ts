// vaultKeychain.ts — OS-encrypted persistence для vault passphrase.
//
// Параллель к keychain.ts (auth-сессия) — тот же паттерн safeStorage +
// дисковый backing-файл, но отдельный файл `vault.bin` чтобы logout не
// дёргал vault и наоборот.
//
// Threat model:
//   - Wrapper key (safeStorage) = OS user keychain (macOS Keychain / Windows
//     DPAPI / Linux secret-service). Привязан к OS-юзеру; physical access
//     ноута + знание OS-password нужно чтобы расшифровать.
//   - Plaintext passphrase ↔ derive key (PBKDF2 200k) ↔ AES-256-GCM key.
//   - Если safeStorage unavailable (Linux без gnome-keyring) — passSave
//     no-op'ит, юзер просто не получит auto-unlock; ввод passphrase каждый
//     раз. Это acceptable degradation, не утечка.

import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const filename = 'vault.bin';

function vaultPath(): string {
  return join(app.getPath('userData'), filename);
}

export async function loadVaultPassphrase(): Promise<string | null> {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const buf = await fs.readFile(vaultPath());
    const raw = safeStorage.decryptString(buf);
    if (!raw) return null;
    return raw;
  } catch {
    // ENOENT, decrypt error, OS-юзер сменил password → fresh start.
    return null;
  }
}

export async function saveVaultPassphrase(passphrase: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    // Silent no-op — caller получит null на passLoad, попросит ввести
    // passphrase. Лучше degraded UX чем plaintext leak в файл.
    return;
  }
  const enc = safeStorage.encryptString(passphrase);
  const dst = vaultPath();
  const tmp = `${dst}.tmp`;
  await fs.writeFile(tmp, enc, { mode: 0o600 });
  await fs.rename(tmp, dst);
}

export async function clearVaultPassphrase(): Promise<void> {
  try {
    await fs.unlink(vaultPath());
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
