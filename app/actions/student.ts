"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { deleteR2Keys, storageKeyFor } from "@/lib/delete-content";
import { isValidPdf, sanitizePdfFilename } from "@/lib/files";
import { deleteFileFromR2, uploadFileToR2 } from "@/lib/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function submitSolution(formData: FormData) {
  const { user } = await requireRole("student");
  const file = formData.get("file") as File;
  const problemId = String(formData.get("problem_id"));

  if (!problemId || !file || !isValidPdf(file)) {
    redirect("/student?error=invalid-file");
  }

  const supabase = createSupabaseAdminClient();
  const { data: problem, error: problemError } = await supabase
    .from("problems")
    .select("id")
    .eq("id", problemId)
    .single();

  if (problemError || !problem) {
    redirect("/student?error=problem-not-found");
  }

  const { data: existingSubmission, error: existingError } = await supabase
    .from("submissions")
    .select("id,r2_key,file_url")
    .eq("problem_id", problemId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existingError) {
    redirect("/student?error=submission-check-failed");
  }

  const timestamp = Date.now();
  const r2Key = `submissions/${problemId}/${user.id}/${timestamp}.pdf`;
  const originalFilename = sanitizePdfFilename(file.name);

  console.log("UPLOAD_START", {
    problemId,
    userId: user.id,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });

  try {
    await uploadFileToR2({ key: r2Key, file });
    console.log("R2_UPLOAD_SUCCESS", { key: r2Key });
  } catch (error) {
    console.error("R2_UPLOAD_FAILED", error);
    redirect("/student?error=upload-failed");
  }

  const submissionPayload = {
    problem_id: problemId,
    student_id: user.id,
    r2_key: r2Key,
    file_url: r2Key,
    original_filename: originalFilename,
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

  console.log("DB_WRITE_START", submissionPayload);

  const { error: upsertError } = existingSubmission
    ? await supabase.from("submissions").update(submissionPayload).eq("id", existingSubmission.id)
    : await supabase.from("submissions").insert(submissionPayload);

  if (upsertError) {
    console.error("DB_WRITE_FAILED", upsertError);
    await deleteFileFromR2(r2Key).catch((error) => console.error(error));
    redirect("/student?error=submission-failed");
  }

  console.log("DB_WRITE_SUCCESS");

  const previousKey = existingSubmission?.r2_key ?? existingSubmission?.file_url;
  if (previousKey && previousKey !== r2Key) {
    await deleteFileFromR2(previousKey).catch((error) => console.error(error));
  }

  revalidatePath("/student");
  redirect("/student?submitted=1");
}

export async function deleteSubmission(formData: FormData) {
  const { user } = await requireRole("student");
  const submissionId = String(formData.get("submission_id"));
  const supabase = createSupabaseAdminClient();

  const { data: submission, error: lookupError } = await supabase
    .from("submissions")
    .select("id,student_id,status,r2_key,file_url")
    .eq("id", submissionId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (lookupError || !submission) {
    redirect("/student?error=submission-not-found");
  }

  if (submission.status === "graded") {
    redirect("/student?error=graded-submission-locked");
  }

  const { error: deleteError } = await supabase.from("submissions").delete().eq("id", submission.id);

  if (deleteError) {
    console.error("DB_DELETE_FAILED", deleteError);
    redirect("/student?error=submission-delete-failed");
  }

  await deleteR2Keys([storageKeyFor(submission)]).catch((error) => console.error("R2_DELETE_FAILED", error));

  revalidatePath("/student");
  revalidatePath("/profile");
  redirect("/student?deleted=1");
}
