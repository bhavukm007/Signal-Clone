import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { api, createDirect, login, openChat, phone } from './chatTestHelpers';

test('authenticated image and PDF downloads preserve names and bytes', async ({ browser }) => {
  const [alice, bob, outsider] = await Promise.all([
    login(phone()),
    login(phone()),
    login(phone()),
  ]);
  const chat = await createDirect(alice, bob.user.id);
  const headers = { Authorization: `Bearer ${alice.token}` };
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=',
    'base64',
  );
  const pdf = Buffer.from('%PDF-1.7\nSignal attachment test\n%%EOF', 'utf8');
  const uploads = [
    { name: 'tiny.png', type: 'image/png', bytes: png },
    { name: 'report.pdf', type: 'application/pdf', bytes: pdf },
  ];
  const created: Array<{ url: string; id: string; file_name: string }> = [];
  for (const upload of uploads) {
    const form = new FormData();
    form.set('file', new Blob([upload.bytes], { type: upload.type }), upload.name);
    const uploaded = await fetch(`${api}/uploads`, { method: 'POST', headers, body: form });
    expect(uploaded.ok).toBeTruthy();
    const attachment = (await uploaded.json()) as { id: string; url: string; file_name: string };
    created.push(attachment);
    const message = await fetch(`${api}/conversations/${chat.id}/messages`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        client_message_id: `download-${upload.name}`,
        attachment_ids: [attachment.id],
      }),
    });
    expect(message.ok).toBeTruthy();
    const [memberResponse, deniedResponse] = await Promise.all([
      fetch(`${api.replace('/api/v1', '')}${attachment.url}`, { headers }),
      fetch(`${api.replace('/api/v1', '')}${attachment.url}`, {
        headers: { Authorization: `Bearer ${outsider.token}` },
      }),
    ]);
    expect(memberResponse.status).toBe(200);
    expect(Buffer.from(await memberResponse.arrayBuffer())).toEqual(upload.bytes);
    expect(memberResponse.headers.get('content-type')).toContain(upload.type);
    expect(memberResponse.headers.get('content-disposition')).toContain(upload.name);
    expect(deniedResponse.status).toBe(403);
  }

  const { context, page } = await openChat(browser, alice, chat.id);
  try {
    await expect(page.getByRole('button', { name: 'Download tiny.png' })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download tiny.png' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('tiny.png');
    expect(await readFile((await download.path())!)).toEqual(png);
    const preview = page.locator('.image-preview-button');
    await preview.focus();
    await preview.press('Enter');
    const viewer = page.getByRole('dialog', { name: 'Photo viewer' });
    await expect(viewer).toBeVisible();
    const lightboxDownload = page.waitForEvent('download');
    await viewer.getByRole('button', { name: 'Download image' }).click();
    const downloadedImage = await lightboxDownload;
    expect(downloadedImage.suggestedFilename()).toBe('tiny.png');
    expect(await readFile((await downloadedImage.path())!)).toEqual(png);
    await viewer.getByRole('button', { name: 'Close photo viewer' }).click();
    await expect(page.getByRole('button', { name: 'Download report.pdf' })).toBeVisible();
    const pdfDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download report.pdf' }).click();
    const downloadedPdf = await pdfDownloadPromise;
    expect(downloadedPdf.suggestedFilename()).toBe('report.pdf');
    expect(await readFile((await downloadedPdf.path())!)).toEqual(pdf);
    expect(created).toHaveLength(2);
  } finally {
    await context.close();
  }
});
