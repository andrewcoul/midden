export interface Db {
  all<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  first<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  run(sql: string, ...params: unknown[]): Promise<{ changes: number }>;
}

export interface ByteRange {
  offset: number;
  length: number;
}

export interface UploadedPart {
  partNumber: number;
  etag: string;
}

export interface BlobStore {
  put(key: string, body: ReadableStream<Uint8Array>, size: number): Promise<void>;
  get(key: string, range?: ByteRange): Promise<ReadableStream<Uint8Array> | null>;
  delete(keys: string[]): Promise<void>;
  createMultipart(key: string): Promise<string>;
  uploadPart(
    key: string,
    storeId: string,
    partNumber: number,
    body: ReadableStream<Uint8Array>,
    size: number,
  ): Promise<UploadedPart>;
  completeMultipart(key: string, storeId: string, parts: UploadedPart[]): Promise<void>;
  abortMultipart(key: string, storeId: string): Promise<void>;
}

export interface Config {
  /** Password sign-in is off when this is null. */
  password: string | null;
  sessionSecret: string;
  /** Access users that can sign in. Null lets in every user that the Access policy lets in. */
  allowedEmails: string[] | null;
}

export interface Deps {
  db: Db;
  blobs: BlobStore;
  config: Config;
  /** Checks a Cloudflare Access JWT and gives the email. Null when Access is not set up. */
  verifyAccess: ((token: string) => Promise<string | null>) | null;
}

export interface NodeRow {
  id: string;
  parent_id: string | null;
  name: string;
  kind: "file" | "folder";
  size: number;
  mime: string | null;
  created_at: number;
  updated_at: number;
  trashed_at: number | null;
  trash_root: number;
  child_count?: number;
  share_count?: number;
}

export interface ShareRow {
  id: string;
  node_id: string;
  password_hash: string | null;
  expires_at: number | null;
  created_at: number;
  downloads: number;
}

export interface UploadRow {
  id: string;
  blob_key: string;
  store_id: string;
  parent_id: string;
  name: string;
  size: number;
  mime: string | null;
  created_at: number;
}
