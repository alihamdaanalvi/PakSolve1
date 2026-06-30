import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { deleteFileFromR2 } from "@/lib/r2";
import { MAX_FILE_SIZE, sanitizePdfFilename } from "@/lib/files";
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

  const body = (await request.json().catch(() => null)) as { problemId?: string; key?: string; fileName?: string; fileSize?: number } | null;
  const problemId = body?.problemId ?? "";
  const key = body?.key ?? "";
  const fileSize = Number(body?.fileSize ?? 0);

  if (!problemId || !key || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
    return jsonError("The uploaded file details were invalid.");
  }

  const expectedPrefix = `submissions/${problemId}/${user.id}/`;
  if (!key.startsWith(expectedPrefix) || !key.endsWith(".pdf")) {
    return jsonError("The uploaded file path was invalid.", 403);
  }

  const supabase = createSupabaseAdminClient();
  const { data: problem, error: problemError } = await supabase.from("problems").select("id").eq("id", problemId).single();
  if (problemError || !problem) {
    return jsonError(problemError ? `Problem lookup failed: ${problemError.message}` : "This problem could not be found.", 404);
  }

  const { data: existingSubmission, error: existingError } = await supabase
    .from("submissions")
    .select("id,r2_key,file_url")
    .eq("problem_id", problemId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existingError) {
    return jsonError(`Submission lookup failed: ${existingError.message}`, 500);
  }

  const payload = {
    problem_id: problemId,
    student_id: user.id,
    r2_key: key,
    file_url: key,
    original_filename: sanitizePdfFilename(body?.fileName ?? "submission.pdf"),
    file_size: fileSize,
    uploaded_at: new Date().toISOString(),
    archived: false,
    archived_at: null,
    google_drive_file_id: null,
    status: "pending",
    score: null,
    feedback: null,
    graded_by: null,
    graded_at: null
  };

  const { error: writeError } = existingSubmission
    ? await supabase.from("submissions").update(payload).eq("id", existingSubmission.id)
    : await supabase.from("submissions").insert(payload);

  if (writeError) {
    await deleteFileFromR2(key).catch((error) => console.error("UPLOAD_ROLLBACK_FAILED", error));
    return jsonError(`Submission save failed: ${writeError.message}`, 500);
  }

  const previousKey = existingSubmission?.r2_key ?? existingSubmission?.file_url;
  if (previousKey && previousKey !== key) {
    await deleteFileFromR2(previousKey).catch((error) => console.error("PREVIOUS_UPLOAD_DELETE_FAILED", error));
  }

  revalidatePath("/student");
  revalidatePath("/profile");
  return NextResponse.json({ ok: true });
}
