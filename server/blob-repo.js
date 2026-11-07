import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import { HttpError } from "./cloud.js";

export const blobRepo = {
  async read(path) {
    const r = await get(path, { access: "private", useCache: false });
    if (!r) return null;
    return { value: await new Response(r.stream).json(), etag: r.blob.etag };
  },
  async write(path, value, etag) {
    try {
      return await put(path, JSON.stringify(value), {
        access: "private", addRandomSuffix: false, contentType: "application/json",
        ...(etag ? { ifMatch: etag, allowOverwrite: true } : { allowOverwrite: false }),
      });
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError || /already exists/i.test(e.message))
        throw new HttpError(409, "Bu kayıt başka bir cihazda değişti. Güncel sürümü yükleyin; yerel değişiklikleriniz korunuyor.");
      throw e;
    }
  },
};
