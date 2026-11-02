import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { LocalDiskStorage, VercelBlobStorage, createFileStorage } from '../../core/storage/file-storage';

const text = async (s: Readable) => {
  let out = '';
  for await (const chunk of s) out += chunk.toString();
  return out;
};

// Uploaded files live on local disk in development/tests and in a private
// Vercel Blob store in production (Vercel's own disk isn't kept).
describe('file storage', () => {
  it('local disk: saves and reads back; a missing file is null', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-store-'));
    const store = new LocalDiskStorage(dir);
    await store.save('co_a.png', Buffer.from('hello'), 'image/png');
    const file = await store.read('co_a.png');
    expect(await text(file!.stream)).toBe('hello');
    expect(file!.contentType).toBe('image/png');
    expect(await store.read('nope.png')).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('vercel blob: stores privately under the exact name and streams it back', async () => {
    const put = jest.fn().mockResolvedValue({});
    const get = jest.fn().mockImplementation(async (name: string) => name === 'co_a.pdf'
      ? { statusCode: 200, stream: Readable.toWeb(Readable.from([Buffer.from('pdf!')])), blob: { contentType: 'application/pdf' } }
      : null);
    const store = new VercelBlobStorage({ put, get } as any);

    await store.save('co_a.pdf', Buffer.from('pdf!'), 'application/pdf');
    expect(put).toHaveBeenCalledWith('co_a.pdf', expect.any(Buffer), expect.objectContaining({
      access: 'private', contentType: 'application/pdf', addRandomSuffix: false,
    }));

    const file = await store.read('co_a.pdf');
    expect(await text(file!.stream)).toBe('pdf!');
    expect(file!.contentType).toBe('application/pdf');
    expect(await store.read('missing.pdf')).toBeNull();
  });

  it('uses Vercel Blob when a store is connected, local disk otherwise', () => {
    expect(createFileStorage({})).toBeInstanceOf(LocalDiskStorage);
    expect(createFileStorage({ BLOB_STORE_ID: 'store_1' })).toBeInstanceOf(VercelBlobStorage);
    expect(createFileStorage({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_x' })).toBeInstanceOf(VercelBlobStorage);
  });
});
