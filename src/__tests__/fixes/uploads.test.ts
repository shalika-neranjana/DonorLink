import { Permission, Role } from 'react-native-appwrite';

import { storage } from '@/lib/appwrite/client';
import { toPickedFile, uploadPrivateFile, validatePickedFile } from '@/lib/appwrite/files';

const storageApi = storage as unknown as Record<string, jest.Mock>;

describe('profile photo upload (Bug 5)', () => {
  beforeEach(() => {
    storageApi.createFile = jest.fn().mockResolvedValue({ $id: 'file1' });
  });

  it('only grants permissions for roles the uploading user holds', async () => {
    const id = await uploadPrivateFile('files', 'user42', { uri: 'file:///a.jpg', name: 'a.jpg', mimeType: 'image/jpeg', size: 1234 });
    expect(id).toBe('file1');
    const { permissions } = storageApi.createFile.mock.calls[0][0] as { permissions: string[] };
    // Appwrite rejects a client that grants any role it does not hold (e.g. label:admin).
    expect(permissions).toEqual([Permission.read(Role.user('user42')), Permission.delete(Role.user('user42'))]);
    expect(permissions.some((p) => p.includes('label:'))).toBe(false);
  });

  it('passes the real file size to the SDK', async () => {
    await uploadPrivateFile('files', 'u', { uri: 'file:///a.png', name: 'a.png', mimeType: 'image/png', size: 4096 });
    expect(storageApi.createFile.mock.calls[0][0].file).toMatchObject({ size: 4096, type: 'image/png', name: 'a.png' });
  });

  it('refuses an invalid file before touching the network', async () => {
    await expect(uploadPrivateFile('files', 'u', { uri: 'x', name: 'x.gif', mimeType: 'image/gif', size: 10 })).rejects.toMatchObject({ code: 'invalid_file' });
    expect(storageApi.createFile).not.toHaveBeenCalled();
  });
});

describe('toPickedFile', () => {
  it('fills a missing name and MIME type from the picker asset', async () => {
    const file = await toPickedFile({ uri: 'file:///cache/ImagePicker/9f2.jpeg', name: null, mimeType: null, size: 5000 });
    expect(file.mimeType).toBe('image/jpeg');
    expect(file.name.endsWith('.jpg')).toBe(true);
    expect(file.size).toBe(5000);
    expect(validatePickedFile('files', file)).toBeNull();
  });

  it('makes the extension match the real MIME type (the bucket checks extensions)', async () => {
    const file = await toPickedFile({ uri: 'file:///x', name: 'IMG_0001.HEIC', mimeType: 'image/jpeg', size: 10 });
    expect(file.name).toBe('IMG_0001.jpg');
  });

  it('reads the size from the file when the picker did not report one', async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ blob: async () => ({ size: 2048 }) }) as never;
    const file = await toPickedFile({ uri: 'content://media/1', name: 'p.jpg', mimeType: 'image/jpeg' });
    global.fetch = original;
    expect(file.size).toBe(2048);
  });

  it('leaves unsupported types to validation instead of pretending they are images', async () => {
    const file = await toPickedFile({ uri: 'file:///x', name: 'photo.heic', mimeType: 'image/heic', size: 10 });
    expect(file.mimeType).toBe('image/heic');
    expect(validatePickedFile('files', file)).toMatch(/JPG, PNG, WebP or PDF/);
  });

  it('reports a genuinely empty file as empty', async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('no')) as never;
    const file = await toPickedFile({ uri: 'file:///x', name: 'a.jpg', mimeType: 'image/jpeg', size: 0 });
    global.fetch = original;
    expect(validatePickedFile('files', file)).toBe('That file is empty.');
  });
});
