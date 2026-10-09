import { fetchMedia } from '@/lib/api';

export async function downloadMedia(path: string, fileName: string): Promise<void> {
  const blob = await fetchMedia(path, new AbortController().signal);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
