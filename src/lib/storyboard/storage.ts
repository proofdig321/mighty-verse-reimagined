import { getServiceClient } from "../authority/validate";

const BUCKET = "creative-artifacts";

export async function storeCreativeBytes(input: {
  path: string;
  bytes: Buffer;
  mime: string;
}): Promise<{ storage_path: string; signed_url: string | null }> {
  const svc = getServiceClient();
  const upload = await svc.storage.from(BUCKET).upload(input.path, input.bytes, {
    contentType: input.mime,
    upsert: true,
  });
  if (upload.error) {
    throw new Error(upload.error.message);
  }
  const signed = await svc.storage.from(BUCKET).createSignedUrl(input.path, 60 * 60 * 24 * 7);
  return { storage_path: input.path, signed_url: signed.data?.signedUrl ?? null };
}

export async function signCreativePath(path: string): Promise<string | null> {
  if (path.startsWith("http")) return path;
  const svc = getServiceClient();
  const signed = await svc.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  return signed.data?.signedUrl ?? null;
}
