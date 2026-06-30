import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { MAX_FILE_SIZE, sanitizePdfFilename } from "@/lib/files";
import { ensureSupabaseStorageBucket, getSupabaseStorageBucket } from "@/lib/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile || profile.role !== "student" || profile.status !== "active") {
    return jsonError("Please sign in as an active student before uploading.", 401);
  }

  const body = (await request.json().catch(() => null)) as { problemId?: string; fileName?: string; fileSize?: number; fileType?: string } | null;
  const problemId = body?.problemId ?? "";
  const fileSize = Number(body?.fileSize ?? 0);

  if (!problemId || !body?.fileName || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
    return jsonError(`Upload a PDF file up to ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB.`);
  }

  if (body.fileType !== "application/pdf" && !body.fileName.toLowerCase().endsWith(".pdf")) {
    return jsonError("Only PDF files can be uploaded.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: problem, error: problemError } = await supabase.from("problems").select("id").eq("id", problemId).single();
  if (problemError || !problem) {
    return jsonError(problemError ? `Problem lookup failed: ${problemError.message}` : "This problem could not be found.", 404);
  }

  const { supabase: storage, bucket } = await ensureSupabaseStorageBucket();
  const timestamp = Date.now();
  const key = `submissions/${problemId}/${user.id}/${timestamp}.pdf`;
  const { data, error } = await storage.storage.from(bucket).createSignedUploadUrl(key, { upsert: true });

  if (error || !data) {
    return jsonError(`Signed upload URL failed: ${error?.message ?? "No upload token returned"}`, 500);
  }

  return NextResponse.json({
    bucket: getSupabaseStorageBucket(),
    key,
    token: data.token,
    path: data.path,
    originalFilename: sanitizePdfFilename(body.fileName),
    fileSize
  });
}
