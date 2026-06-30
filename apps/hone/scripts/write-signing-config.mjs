#!/usr/bin/env node
/**
 * Writes src-tauri/signing.ci.json from CI secrets (never commit that file).
 * Used by .github/workflows/hone-release.yml before `tauri build`.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'src-tauri', 'signing.ci.json');
const bundle = {};

const winThumb = process.env.WINDOWS_CERTIFICATE_THUMBPRINT?.trim();
if (winThumb) {
  bundle.windows = {
    certificateThumbprint: winThumb,
    digestAlgorithm: 'sha256',
    timestampUrl: 'http://timestamp.digicert.com',
  };
}

const appleIdentity = process.env.APPLE_SIGNING_IDENTITY?.trim();
if (appleIdentity) {
  bundle.macOS = { signingIdentity: appleIdentity };
}

if (Object.keys(bundle).length === 0) {
  if (fs.existsSync(out)) fs.unlinkSync(out);
  console.log('write-signing-config: no signing env vars, skipping overlay');
  process.exit(0);
}

fs.writeFileSync(out, `${JSON.stringify({ bundle }, null, 2)}\n`);
console.log(`write-signing-config: wrote ${path.relative(root, out)}`);
