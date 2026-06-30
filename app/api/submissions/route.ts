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

export async function POST(request: NextRequest) {
  const { user, profile } = await getSessionProfile();

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

  const supabase = createSupabaseAdminClient();
  const { data: problem, error: problemError } = await supabase
    .from("problems")
    .select("id")
    .eq("id", problemId)
    .single();

  if (problemError || !problem) {
    return uploadError("This problem could not be found.", 404);
  }

  const { data: existingSubmission, error: existingError } = await supabase
    .from("submissions")
    .select("id,r2_key,file_url")
    .eq("problem_id", problemId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existingError) {
    console.error("SUBMISSION_LOOKUP_FAILED", existingError);
    return uploadError("Your previous submission could not be checked. Please try again.", 500);
  }

  const timestamp = Date.now();
  const r2Key = `submissions/${problemId}/${user.id}/${timestamp}.pdf`;

  try {
    await uploadFileToR2({ key: r2Key, file });
  } catch (error) {
    console.error("R2_UPLOAD_FAILED", error);
    return uploadError("The PDF could not be uploaded. Please try again.", 502);
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

  const { error: writeError } = existingSubmission
    ? await supabase.from("submissions").update(submissionPayload).eq("id", existingSubmission.id)
    : await supabase.from("submissions").insert(submissionPayload);

  if (writeError) {
    console.error("SUBMISSION_WRITE_FAILED", writeError);
    await deleteFileFromR2(r2Key).catch((error) => console.error("R2_ROLLBACK_FAILED", error));
    return uploadError("The uploaded PDF could not be saved. Please try again.", 500);
  }

  const previousKey = existingSubmission?.r2_key ?? existingSubmission?.file_url;
  if (previousKey && previousKey !== r2Key) {
    await deleteFileFromR2(previousKey).catch((error) => console.error("R2_PREVIOUS_DELETE_FAILED", error));
  }

  revalidatePath("/student");
  revalidatePath("/profile");
  return NextResponse.json({ ok: true });
}
