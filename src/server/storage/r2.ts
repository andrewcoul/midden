import type { BlobStore } from "../types";

// R2 needs a stream with a known length.
function sized(body: ReadableStream<Uint8Array>, size: number) {
  const { readable, writable } = new FixedLengthStream(size);
  body.pipeTo(writable).catch(() => {});
  return readable;
}

export function r2BlobStore(bucket: R2Bucket): BlobStore {
  return {
    async put(key, body, size) {
      await bucket.put(key, sized(body, size));
    },
    async get(key, range) {
      const obj = await bucket.get(key, range ? { range } : undefined);
      return obj?.body ?? null;
    },
    async delete(keys) {
      for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
    },
    async createMultipart(key) {
      return (await bucket.createMultipartUpload(key)).uploadId;
    },
    async uploadPart(key, storeId, partNumber, body, size) {
      const part = await bucket.resumeMultipartUpload(key, storeId).uploadPart(partNumber, sized(body, size));
      return { partNumber: part.partNumber, etag: part.etag };
    },
    async completeMultipart(key, storeId, parts) {
      await bucket.resumeMultipartUpload(key, storeId).complete(parts);
    },
    async abortMultipart(key, storeId) {
      await bucket.resumeMultipartUpload(key, storeId).abort();
    },
  };
}
