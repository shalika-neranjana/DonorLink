import { ID, Permission, Role } from 'react-native-appwrite';

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

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function validatePickedFile(_bucketId: BucketId, file: PickedFile): string | null {
  if (!ALLOWED_TYPES.includes(file.mimeType)) return 'Choose a JPG, PNG, WebP or PDF file.';
  if (file.size <= 0) return 'That file is empty.';
  if (file.size > MAX_BYTES) return `That file is too large. The limit is ${MAX_BYTES / (1024 * 1024)} MB.`;
  return null;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
const MIME_BY_EXTENSION: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };

function extensionOf(value?: string | null): string | null {
  const match = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(value ?? '');
  return match ? match[1].toLowerCase() : null;
}

/**
 * Turns what a picker returned into a file Appwrite will accept. Pickers may
 * leave the name, MIME type and size empty (expo-image-picker documents all
 * three as optional), and the bucket checks the extension, so a missing or
 * mismatched value would otherwise fail the upload.
 */
export async function toPickedFile(asset: { uri: string; name?: string | null; mimeType?: string | null; size?: number | null }): Promise<PickedFile> {
  const declared = asset.mimeType && asset.mimeType !== 'application/octet-stream' ? asset.mimeType.toLowerCase() : null;
  const mimeType = declared ?? MIME_BY_EXTENSION[extensionOf(asset.name) ?? extensionOf(asset.uri) ?? ''] ?? 'application/octet-stream';
  const extension = EXTENSION_BY_MIME[mimeType];
  const base = (asset.name ?? '').replace(/\.[a-z0-9]+$/i, '').trim() || `upload-${Date.now()}`;
  const name = extension ? `${base}.${extension}` : (asset.name ?? base);

  let size = asset.size ?? 0;
  if (!size) {
    try {
      size = (await (await fetch(asset.uri)).blob()).size;
    } catch {
      size = 0;
    }
  }
  return { uri: asset.uri, name, mimeType, size };
}

/**
 * Uploads a file readable only by its owner. File IDs are what gets stored on
 * rows; private URLs are never exposed.
 *
 * Appwrite only lets a client grant permissions for roles it holds, so asking
 * for `read(label:admin)` here made every upload by a non-admin fail with
 * "user_unauthorized". Reviewer (admin) access comes from the bucket's own
 * `read("label:admin")` permission instead (see appwrite/schema.mjs).
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
      permissions: [Permission.read(Role.user(userId)), Permission.delete(Role.user(userId))],
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
