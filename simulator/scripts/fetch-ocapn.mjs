#!/usr/bin/env node
// Fetches the @endo/ocapn package source from the op:flush branch in
// endojs/endo and writes it to vendor/@endo/ocapn so the simulator can
// import it. The simulator targets the prototype; the package is not
// yet published to npm.

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'endojs/endo';
const REF = 'claude/implement-ocapn-flush-iisn9';
const SUBDIR = 'packages/ocapn';

const SRC_FILES = [
  'index.js',
  'src/buffer-utils.js',
  'src/cryptography.js',
  'src/selector.js',
  'src/captp/finalize.js',
  'src/captp/ocapn-tables.js',
  'src/captp/pairwise.js',
  'src/captp/refcount.js',
  'src/captp/types.js',
  'src/client/grant-tracker.js',
  'src/client/handshake.js',
  'src/client/index.js',
  'src/client/ocapn.js',
  'src/client/ref-kit.js',
  'src/client/sturdyrefs.js',
  'src/client/types.js',
  'src/client/util.js',
  'src/codecs/components.js',
  'src/codecs/descriptors.js',
  'src/codecs/ocapn-pass-style.js',
  'src/codecs/operations.js',
  'src/codecs/passable.js',
  'src/codecs/subtypes.js',
  'src/codecs/util.js',
  'src/syrup/buffer-reader.js',
  'src/syrup/buffer-writer.js',
  'src/syrup/codec.js',
  'src/syrup/compare.js',
  'src/syrup/decode.js',
  'src/syrup/encode.js',
  'src/syrup/js-representation.js',
];

const here = dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = resolve(here, '..', 'vendor', '@endo', 'ocapn');

const exists = async path => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const fetchText = async path => {
  const url = `https://raw.githubusercontent.com/${REPO}/${REF}/${SUBDIR}/${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
};

const writeText = async (path, text) => {
  const dest = resolve(VENDOR_DIR, path);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, text, 'utf-8');
};

// The upstream cryptography.js imports `randomBytes` from `node:crypto`.
// In the browser we replace it with a tiny shim using the WebCrypto API.
// @endo/hex isn't yet published to npm, so we redirect that import to a
// vendored implementation as well.
const patchSource = (path, text) => {
  let out = text;
  if (path === 'src/cryptography.js') {
    out = out.replace(
      /import\s*\{\s*randomBytes\s*\}\s*from\s*['"]node:crypto['"];?/,
      `import { randomBytes } from '../shims/random-bytes.js';`,
    );
  }
  if (path === 'src/client/util.js') {
    out = out.replace(
      /import\s*\{\s*encodeHex\s*\}\s*from\s*['"]@endo\/hex['"];?/,
      `import { encodeHex } from '../shims/hex.js';`,
    );
  }
  if (path === 'index.js') {
    // Re-export a few internals the simulator needs but the upstream
    // entry point intentionally doesn't expose. These are not stable
    // public API; the simulator just needs them to talk to the client.
    out += `
// --- simulator additions ---
export {
  encodeSwissnum,
  locationToLocationId,
} from './src/client/util.js';
`;
  }
  if (path === 'src/client/ocapn.js') {
    // Allow promises through bootstrap.deposit-gift so a third-party
    // handoff of an unresolved promise (the natural shape of a
    // forwarder chain that returns [answerPromise]) can succeed.
    // Without this, the exporter rejects the gift with "Gift must be
    // remotable" the first time a chain hop tries to ship its answer
    // promise across to a third party.
    const before =
      `      const passStyle = ocapnPassStyleOf(gift);\n` +
      `      if (passStyle !== 'remotable') {\n` +
      `        throw Error(\`\${label}: Bootstrap deposit-gift: Gift must be remotable\`);\n` +
      `      }\n`;
    const after =
      `      const passStyle = ocapnPassStyleOf(gift);\n` +
      `      if (passStyle !== 'remotable' && passStyle !== 'promise') {\n` +
      `        throw Error(\n` +
      `          \`\${label}: Bootstrap deposit-gift: Gift must be remotable or a promise (got pass-style \${passStyle})\`,\n` +
      `        );\n` +
      `      }\n`;
    if (out.includes(before)) {
      out = out.replace(before, after);
    } else if (!out.includes(`'promise'`)) {
      console.warn(
        '  ! deposit-gift patch site not found; upstream may have changed shape',
      );
    }
  }
  return out;
};

const writeShims = async () => {
  const randomShim = `// Browser-compatible randomBytes used by the simulator's vendored copy
// of @endo/ocapn. The upstream module imports this from \`node:crypto\`;
// the fetch-ocapn script rewrites that import to point here.
export const randomBytes = n => {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
};
`;
  await writeText('shims/random-bytes.js', randomShim);

  const hexShim = `// Replacement for the unpublished @endo/hex package. The vendored
// @endo/ocapn only uses encodeHex.
const HEX = '0123456789abcdef';
export const encodeHex = bytes => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    out += HEX[b >>> 4] + HEX[b & 0x0f];
  }
  return out;
};
`;
  await writeText('shims/hex.js', hexShim);
};

const writePackageJson = async () => {
  const pkg = {
    name: '@endo/ocapn',
    version: '1.0.0-vendored-flush-prototype',
    type: 'module',
    main: './index.js',
    exports: {
      '.': './index.js',
      // Netlayer subpaths intentionally omitted — the simulator
      // ships its own browser-friendly netlayer.
      './package.json': './package.json',
    },
  };
  await writeText('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
};

const writeStamp = async () => {
  await writeText('.fetch-stamp', `${REPO}#${REF}\n${new Date().toISOString()}\n`);
};

const main = async () => {
  const stampPath = resolve(VENDOR_DIR, '.fetch-stamp');
  if (await exists(stampPath)) {
    if (!process.argv.includes('--force')) {
      console.log(
        `vendored @endo/ocapn already present at ${VENDOR_DIR} (pass --force to refetch)`,
      );
      return;
    }
  }
  console.log(`Fetching @endo/ocapn from ${REPO}#${REF} ...`);
  await mkdir(VENDOR_DIR, { recursive: true });
  for (const path of SRC_FILES) {
    process.stdout.write(`  ${path} ... `);
    const text = await fetchText(path);
    await writeText(path, patchSource(path, text));
    process.stdout.write('ok\n');
  }
  await writeShims();
  await writePackageJson();
  await writeStamp();
  console.log(`Done. Vendored at ${VENDOR_DIR}`);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
