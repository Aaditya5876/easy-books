import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import * as blobSdk from '@vercel/blob';

// Where uploaded files (payment proofs, QR codes, study materials, memo
// attachments...) are kept. Vercel's function disk is read-only and wiped
// between requests, so production uses a private Vercel Blob store; local
// development and the test suite use the backend's uploads/ folder. Either
// way files are only ever served through UploadsDownloadController, behind
// UploadAccessGuard's per-school check.
export interface StoredFile {
  stream: Readable;
  contentType?: string;
}

export interface FileStorage {
  save(name: string, data: Buffer, contentType: string): Promise<void>;
  read(name: string): Promise<StoredFile | null>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export class LocalDiskStorage implements FileStorage {
  constructor(private readonly dir: string) {}

  async save(name: string, data: Buffer) {
    await fs.promises.mkdir(this.dir, { recursive: true });
    await fs.promises.writeFile(path.join(this.dir, name), data);
  }

  async read(name: string): Promise<StoredFile | null> {
    const file = path.join(this.dir, name);
    if (!fs.existsSync(file)) return null;
    return { stream: fs.createReadStream(file), contentType: mimeFor(name) };
  }
}

type BlobSdk = Pick<typeof blobSdk, 'put' | 'get'>;

export class VercelBlobStorage implements FileStorage {
  constructor(private readonly sdk: BlobSdk = blobSdk) {}

  async save(name: string, data: Buffer, contentType: string) {
    // Names are already unique (<companyId>_<uuid>.<ext>), so no random suffix:
    // the stored path must equal the /uploads/<name> link kept in the database.
    await this.sdk.put(name, data, { access: 'private', contentType, addRandomSuffix: false });
  }

  async read(name: string): Promise<StoredFile | null> {
    const result: any = await this.sdk.get(name, { access: 'private' });
    if (!result || result.statusCode !== 200) return null;
    return { stream: Readable.fromWeb(result.stream), contentType: result.blob?.contentType };
  }
}

// Vercel adds BLOB_STORE_ID when a store is connected to the project;
// BLOB_READ_WRITE_TOKEN is the static credential for running elsewhere.
export function createFileStorage(env: NodeJS.ProcessEnv = process.env): FileStorage {
  if (env.BLOB_STORE_ID || env.BLOB_READ_WRITE_TOKEN) return new VercelBlobStorage();
  return new LocalDiskStorage(path.join(process.cwd(), 'uploads'));
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
export const mimeFor = (name: string) => MIME[path.extname(name).toLowerCase()] ?? 'application/octet-stream';
