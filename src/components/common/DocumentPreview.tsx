import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { DonorLinkBottomSheet } from '@/components/ui/DonorLinkBottomSheet';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { BUCKETS } from '@/lib/appwrite/config';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { loadPrivateImage } from '@/lib/appwrite/files';

/**
 * Reviewer-only preview of a private verification document. The file is
 * fetched with the reviewer's session and never exposed through a public URL.
 */
export function DocumentPreview({ fileIds, label = 'View documents' }: { fileIds: string[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function show() {
    setOpen(true);
    if (images.length > 0 || fileIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      setImages(await Promise.all(fileIds.map((id) => loadPrivateImage(BUCKETS.verificationDocs, id))));
    } catch (e) {
      setError(getErrorMessage(e, "We couldn't load the documents."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <DonorLinkButton title={label} variant="outline" size="sm" leftIcon="document-text-outline" disabled={fileIds.length === 0} onPress={() => void show()} />
      <DonorLinkBottomSheet visible={open} onClose={() => setOpen(false)} title="Verification documents">
        {loading ? <DonorLinkButton title="Loading..." loading variant="ghost" /> : null}
        {error ? <DonorLinkBanner tone="error" message={error} /> : null}
        {images.map((uri, i) => (
          <View key={i} className="overflow-hidden rounded-md border border-border bg-subtle">
            <Image source={{ uri }} style={{ width: '100%', height: 320 }} contentFit="contain" accessibilityLabel={`Document ${i + 1}`} />
          </View>
        ))}
        {!loading && images.length > 0 ? <DonorLinkBanner tone="neutral" message="PDF files can't be previewed in the app. Image documents are shown above." /> : null}
      </DonorLinkBottomSheet>
    </>
  );
}
