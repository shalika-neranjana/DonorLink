import { useEffect, useState } from 'react';

import { BUCKETS } from '@/lib/appwrite/config';
import { loadPrivateImage } from '@/lib/appwrite/files';

/** Loads a private profile photo with the user's session; null while loading or on failure. */
export function useAvatarUri(fileId: string | null | undefined): string | null {
  const [loaded, setLoaded] = useState<{ fileId: string; uri: string } | null>(null);
  useEffect(() => {
    if (!fileId) return;
    let active = true;
    loadPrivateImage(BUCKETS.avatars, fileId)
      .then((uri) => {
        if (active) setLoaded({ fileId, uri });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [fileId]);
  return fileId && loaded?.fileId === fileId ? loaded.uri : null;
}
