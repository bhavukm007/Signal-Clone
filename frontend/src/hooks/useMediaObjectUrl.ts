import { useEffect, useState } from 'react';
import { fetchMedia } from '@/lib/api';

export function useMediaObjectUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    if (path.startsWith('blob:')) {
      setUrl(path);
      return;
    }
    const controller = new AbortController();
    let objectUrl: string | null = null;
    void fetchMedia(path, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return url;
}
