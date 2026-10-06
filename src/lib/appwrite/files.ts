import { ID, Permission, Role } from 'react-native-appwrite';

import { LABEL_ADMIN } from '@/domain';
import { storage } from './client';
import { BUCKETS } from './config';
import { AppError, toAppError } from './errors';

export type BucketId = (typeof BUCKETS)[keyof typeof BUCKETS];

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

const MAX_BYTES: Record<BucketId, number> = {
  [BUCKETS.avatars]: 2 * 1024 * 1024,
  [BUCKETS.verificationDocs]: 5 * 1024 * 1024,
};

const ALLOWED_TYPES: Record<BucketId, string[]> = {
  [BUCKETS.avatars]: ['image/jpeg', 'image/png', 'image/webp'],
  [BUCKETS.verificationDocs]: ['image/jpeg', 'image/png', 'application/pdf'],
};

export function validatePickedFile(bucketId: BucketId, file: PickedFile): string | null {
  if (!ALLOWED_TYPES[bucketId].includes(file.mimeType)) {
    return bucketId === BUCKETS.avatars
      ? 'Choose a JPG, PNG or WebP image.'
      : 'Choose a JPG, PNG or PDF file.';
  }
  if (file.size <= 0) return 'That file is empty.';
  if (file.size > MAX_BYTES[bucketId]) {
    return `That file is too large. The limit is ${MAX_BYTES[bucketId] / (1024 * 1024)} MB.`;
  }
  return null;
}

/**
 * Uploads a file readable only by its owner and administrators. File IDs are
 * what gets stored on rows; private URLs are never exposed.
 */
export async function uploadPrivateFile(
  bucketId: BucketId,
  userId: string,
  file: PickedFile,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const problem = validatePickedFile(bucketId, file);
  if (problem) throw new AppError('invalid_file', problem);
  try {
    const created = await storage.createFile({
      bucketId,
      fileId: ID.unique(),
      file: { name: file.name, type: file.mimeType, size: file.size, uri: file.uri },
      permissions: [
        Permission.read(Role.user(userId)),
        Permission.delete(Role.user(userId)),
        Permission.read(Role.label(LABEL_ADMIN)),
      ],
      onProgress: (progress) => onProgress?.(Math.round(progress.progress)),
    });
    return created.$id;
  } catch (error) {
    throw toAppError(error, "The upload didn't finish. Check your connection and try again.");
  }
}

export async function deleteFile(bucketId: BucketId, fileId: string): Promise<void> {
  try {
    await storage.deleteFile({ bucketId, fileId });
  } catch (error) {
    throw toAppError(error);
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return globalThis.btoa(binary);
}

const imageCache = new Map<string, string>();

/**
 * Downloads a private image with the user's session and returns a data URI,
 * so the file never needs a public URL.
 */
export async function loadPrivateImage(bucketId: BucketId, fileId: string): Promise<string> {
  const key = `${bucketId}/${fileId}`;
  const cached = imageCache.get(key);
  if (cached) return cached;
  try {
    const buffer = await storage.getFileView({ bucketId, fileId });
    const uri = `data:image/jpeg;base64,${toBase64(buffer)}`;
    imageCache.set(key, uri);
    return uri;
  } catch (error) {
    throw toAppError(error);
  }
}

export function clearImageCache(): void {
  imageCache.clear();
}
