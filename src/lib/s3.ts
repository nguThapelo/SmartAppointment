import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/server/env";
import { serviceUnavailable } from "@/server/errors";

// S3 via short-lived presigned URLs (briefcase pattern): file bytes go straight
// between the browser and a PRIVATE bucket and never pass through the app.
// In Amplify, credentials come from the SSR compute role; locally, from the
// AWS_* env vars of an S3-only IAM user. Swappable in tests.

export interface StorageGateway {
  uploadUrl(key: string, contentType: string, size: number): Promise<string>;
  downloadUrl(key: string, fileName: string): Promise<string>;
  head(key: string): Promise<{ size: number; contentType: string | null } | null>;
}

const URL_TTL_SECONDS = 300;
let client: S3Client | undefined;

function bucket() {
  const b = env().S3_BUCKET_NAME;
  if (!b) throw serviceUnavailable("File storage isn't configured");
  return b;
}
const s3 = () => (client ??= new S3Client({ region: env().S3_REGION ?? env().AWS_REGION }));

const realStorage: StorageGateway = {
  uploadUrl(key, contentType, size) {
    // ContentType and ContentLength are signed, so the browser can't upload a
    // different type or a bigger file than was approved.
    return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: size }), {
      expiresIn: URL_TTL_SECONDS,
    });
  },
  downloadUrl(key, fileName) {
    return getSignedUrl(
      s3(),
      new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
        // Force download rather than rendering user-uploaded content inline.
        ResponseContentDisposition: `attachment; filename="${fileName.replace(/["\\\r\n]/g, "_")}"`,
      }),
      { expiresIn: URL_TTL_SECONDS },
    );
  },
  async head(key) {
    try {
      const r = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
      return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? null };
    } catch {
      return null;
    }
  },
};

let storage: StorageGateway = realStorage;
export const storageGateway = () => storage;
export function setStorageGatewayForTests(fake?: StorageGateway) {
  storage = fake ?? realStorage;
}
