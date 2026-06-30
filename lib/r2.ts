import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

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

function hasR2Config() {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_ENDPOINT &&
      process.env.R2_BUCKET
  );
}

function getSupabaseStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "paksolve-files";
}

async function ensureSupabaseStorageBucket() {
  const supabase = createSupabaseAdminClient();
  const bucket = getSupabaseStorageBucket();
  const { data } = await supabase.storage.getBucket(bucket);

  if (!data) {
    const { error } = await supabase.storage.createBucket(bucket, { public: false });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw error;
    }
  }

  return { supabase, bucket };
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
    forcePathStyle: true,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 10_000,
      socketTimeout: 30_000
    })
  });
}

export async function uploadFileToR2({ key, file }: R2UploadInput) {
  if (!hasR2Config()) {
    const { supabase, bucket } = await ensureSupabaseStorageBucket();
    const { error } = await supabase.storage.from(bucket).upload(key, file, {
      contentType: "application/pdf",
      upsert: true
    });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    return { key };
  }

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
  if (!hasR2Config()) {
    const { supabase, bucket } = await ensureSupabaseStorageBucket();
    const { data, error } = await supabase.storage.from(bucket).download(key);

    if (error || !data) {
      throw new Error(`Supabase Storage download failed: ${error?.message ?? "File not found"}`);
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    return {
      ContentType: data.type || "application/pdf",
      Body: {
        transformToByteArray: async () => bytes
      }
    } as GetObjectCommandOutput;
  }

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
  if (!hasR2Config()) {
    const { supabase, bucket } = await ensureSupabaseStorageBucket();
    const { error } = await supabase.storage.from(bucket).remove([key]);

    if (error) {
      throw new Error(`Supabase Storage delete failed: ${error.message}`);
    }

    return;
  }

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
