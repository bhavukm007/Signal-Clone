import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default async function globalTeardown() {
  const api = `${process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000'}/api/v1`;
  const cache = join(
    tmpdir(),
    `signal-playwright-sessions-${Buffer.from(api).toString('hex').slice(0, 24)}.json`,
  );
  await rm(cache, { force: true });
}
