"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
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

  try {
    await uploadFileToR2({ key: r2Key, file });
  } catch (error) {
    console.error(error);
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

  const { error: upsertError } = existingSubmission
    ? await supabase.from("submissions").update(submissionPayload).eq("id", existingSubmission.id)
    : await supabase.from("submissions").insert(submissionPayload);

  if (upsertError) {
    await deleteFileFromR2(r2Key).catch((error) => console.error(error));
    redirect("/student?error=submission-failed");
  }

  const previousKey = existingSubmission?.r2_key ?? existingSubmission?.file_url;
  if (previousKey && previousKey !== r2Key) {
    await deleteFileFromR2(previousKey).catch((error) => console.error(error));
  }

  revalidatePath("/student");
  redirect("/student?submitted=1");
}
