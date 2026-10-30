import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import { env } from "../env.js";

// Qualquer provedor S3-compatível: MinIO (dev), Supabase Storage ou Cloudflare R2 (produção).
const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
});

export async function putObject(key: string, body: Readable, contentType: string) {
  const upload = new Upload({ client: s3, params: { Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType } });
  await upload.done();
}

export async function headObject(key: string) {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return { size: r.ContentLength ?? 0 };
  } catch {
    return null;
  }
}

export async function getObjectStream(key: string) {
  const r = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  return r.Body as Readable;
}

export function signedDownloadUrl(key: string, filename: string, expiresIn = 300) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      // anexo forçado: arquivos enviados nunca são renderizados/executados no navegador
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      ResponseContentType: "application/octet-stream",
    }),
    { expiresIn },
  );
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}
