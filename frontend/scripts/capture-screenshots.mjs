import { spawnSync } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

const frontend = process.cwd();
const screenshots = resolve(frontend, 'test-results', 'screenshots');
const cli = resolve(frontend, 'node_modules', '@playwright', 'test', 'cli.js');
const run = spawnSync(
  process.execPath,
  [cli, 'test', 'e2e/layout.spec.ts', 'e2e/mobile-panels.spec.ts'],
  {
    cwd: frontend,
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_SCREENSHOT_DIR: join(screenshots, 'parity'),
    },
  },
);
if (run.status !== 0) process.exit(run.status ?? 1);

const curated = [
  ['parity', 'light-375-conversation-list.png'],
  ['parity', 'dark-375-chat.png'],
  ['parity', 'light-1280-group-info.png'],
  ['parity', 'dark-1280-settings.png'],
  ['parity', 'light-375-new-chat.png'],
  ['mobile', '390-light-chat-list.png'],
  ['mobile', '412-dark-info.png'],
];
const destination = resolve(frontend, '..', 'docs', 'screenshots', 'curated');
await mkdir(destination, { recursive: true });
for (const [folder, name] of curated) {
  const source = join(screenshots, folder, name);
  const target = join(destination, name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}
console.log(`Copied ${curated.length} curated screenshots to ${destination}`);
