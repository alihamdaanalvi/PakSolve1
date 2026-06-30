import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { deleteFileFromR2, uploadFileToR2 } from "@/lib/r2";
import { isValidPdf, sanitizePdfFilename, MAX_FILE_SIZE } from "@/lib/files";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function uploadError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}

export async function POST(request: NextRequest) {
  const { user, profile } = await withTimeout(getSessionProfile(), 10_000, "Session check").catch((error) => {
    console.error("SUBMISSION_SESSION_FAILED", error);
    return { user: null, profile: null };
  });

  if (!user || !profile || profile.role !== "student" || profile.status !== "active") {
    return uploadError("Please sign in as an active student before uploading.", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error("SUBMISSION_FORM_PARSE_FAILED", error);
    return uploadError(`The upload could not be read. PDFs must be ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB or smaller.`, 413);
  }

  const file = formData.get("file");
  const problemId = String(formData.get("problem_id") || "");

  if (!problemId || !(file instanceof File) || !isValidPdf(file)) {
    return uploadError(`Upload a PDF file up to ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB.`);
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch (error) {
    console.error("SUPABASE_CONFIG_FAILED", error);
    return uploadError(`Server config error: ${errorMessage(error)}`, 500);
  }

  const { data: problem, error: problemError } = await withTimeout(
    Promise.resolve(supabase.from("problems").select("id").eq("id", problemId).single()),
    10_000,
    "Problem lookup"
  );

  if (problemError || !problem) {
    console.error("PROBLEM_LOOKUP_FAILED", problemError);
    return uploadError(problemError ? `Problem lookup failed: ${problemError.message}` : "This problem could not be found.", 404);
  }

  const { data: existingSubmission, error: existingError } = await withTimeout(
    Promise.resolve(
      supabase
        .from("submissions")
        .select("id,r2_key,file_url")
        .eq("problem_id", problemId)
        .eq("student_id", user.id)
        .maybeSingle()
    ),
    10_000,
    "Submission lookup"
  );

  if (existingError) {
    console.error("SUBMISSION_LOOKUP_FAILED", existingError);
    return uploadError(`Submission lookup failed: ${existingError.message}`, 500);
  }

  const timestamp = Date.now();
  const r2Key = `submissions/${problemId}/${user.id}/${timestamp}.pdf`;

  try {
    await withTimeout(uploadFileToR2({ key: r2Key, file }), 35_000, "R2 upload");
  } catch (error) {
    console.error("R2_UPLOAD_FAILED", error);
    return uploadError(`R2 upload failed: ${errorMessage(error)}`, 502);
  }

  const submissionPayload = {
    problem_id: problemId,
    student_id: user.id,
    r2_key: r2Key,
    file_url: r2Key,
    original_filename: sanitizePdfFilename(file.name),
    file_size: file.size,
    uploaded_at: new Date(timestamp).toISOString(),
    archived: false,
    archived_at: null,
    google_drive_file_id: null,
    status: "pending",
    score: null,
    feedback: null,
    graded_by: null,
    graded_at: null
  };

  const { error: writeError } = await withTimeout(
    Promise.resolve(
      existingSubmission
        ? supabase.from("submissions").update(submissionPayload).eq("id", existingSubmission.id)
        : supabase.from("submissions").insert(submissionPayload)
    ),
    10_000,
    "Submission save"
  );

  if (writeError) {
    console.error("SUBMISSION_WRITE_FAILED", writeError);
    await deleteFileFromR2(r2Key).catch((error) => console.error("R2_ROLLBACK_FAILED", error));
    return uploadError(`Submission save failed: ${writeError.message}`, 500);
  }

  const previousKey = existingSubmission?.r2_key ?? existingSubmission?.file_url;
  if (previousKey && previousKey !== r2Key) {
    await deleteFileFromR2(previousKey).catch((error) => console.error("R2_PREVIOUS_DELETE_FAILED", error));
  }

  revalidatePath("/student");
  revalidatePath("/profile");
  return NextResponse.json({ ok: true });
}
