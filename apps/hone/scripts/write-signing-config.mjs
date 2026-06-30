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
const onCi = process.env.CI === 'true';
const runnerOs = process.env.RUNNER_OS ?? '';
const codeSigning = process.env.HONE_CODE_SIGNING === 'true';

const winThumb = codeSigning ? process.env.WINDOWS_CERTIFICATE_THUMBPRINT?.trim() : '';
if (winThumb) {
  bundle.windows = {
    certificateThumbprint: winThumb,
    digestAlgorithm: 'sha256',
    timestampUrl: 'http://timestamp.digicert.com',
  };
}

const appleIdentity = codeSigning ? process.env.APPLE_SIGNING_IDENTITY?.trim() : '';
if (appleIdentity) {
  bundle.macOS = { signingIdentity: appleIdentity };
} else if (onCi && runnerOs === 'macOS') {
  bundle.macOS = { signingIdentity: '-' };
}

if (Object.keys(bundle).length === 0) {
  if (fs.existsSync(out)) fs.unlinkSync(out);
  console.log('write-signing-config: no signing overlay needed');
  process.exit(0);
}

fs.writeFileSync(out, `${JSON.stringify({ bundle }, null, 2)}\n`);
console.log(`write-signing-config: wrote ${path.relative(root, out)}`);
