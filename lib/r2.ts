import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput
} from "@aws-sdk/client-s3";

type R2UploadInput = {
  key: string;
  file: File;
};

function getR2Config() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    throw new Error("R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, and R2_BUCKET are required.");
  }

  return { accessKeyId, secretAccessKey, endpoint, bucket };
}

function createR2Client() {
  console.log("R2_CONFIG", {
    hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
    hasEndpoint: !!process.env.R2_ENDPOINT,
    hasBucket: !!process.env.R2_BUCKET,
    endpoint: process.env.R2_ENDPOINT,
    bucket: process.env.R2_BUCKET
  });

  const { accessKeyId, secretAccessKey, endpoint } = getR2Config();

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    forcePathStyle: true
  });
}

export async function uploadFileToR2({ key, file }: R2UploadInput) {
  const { bucket } = getR2Config();
  const client = createR2Client();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentLength: file.size,
        ContentType: "application/pdf"
      })
    );

    return { key };
  } catch (error) {
    throw new Error(`R2 upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function getFileFromR2(key: string): Promise<GetObjectCommandOutput> {
  const { bucket } = getR2Config();
  const client = createR2Client();

  try {
    return await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );
  } catch (error) {
    throw new Error(`R2 download failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function deleteFileFromR2(key: string) {
  const { bucket } = getR2Config();
  const client = createR2Client();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );
  } catch (error) {
    throw new Error(`R2 delete failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
