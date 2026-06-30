"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { deleteR2Keys, storageKeyFor } from "@/lib/delete-content";
import { isValidPdf } from "@/lib/files";
import { deleteFileFromR2, uploadFileToR2 } from "@/lib/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { AcademicBatch, Subject } from "@/lib/types";

export async function uploadProblem(formData: FormData) {
  const { user } = await requireRole("mentor");
  const file = formData.get("file") as File;

  if (!file || !isValidPdf(file)) {
    redirect("/mentor?error=invalid-file");
  }

  const supabase = createSupabaseAdminClient();
  const subject = String(formData.get("subject") || "math") as Subject;
  const batch = String(formData.get("batch") || "basic") as AcademicBatch;
  const r2Key = `problems/${user.id}/${crypto.randomUUID()}.pdf`;

  try {
    await uploadFileToR2({ key: r2Key, file });
  } catch (error) {
    console.error(error);
    redirect("/mentor?error=upload-failed");
  }

  const { error: insertError } = await supabase.from("problems").insert({
    title: String(formData.get("title")),
    description: String(formData.get("description")),
    subject,
    batch,
    deadline: String(formData.get("deadline")),
    max_points: Number(formData.get("max_points")),
    uploaded_by: user.id,
    file_url: r2Key
  });

  if (insertError) {
    await deleteFileFromR2(r2Key).catch((error) => console.error(error));
    redirect(`/mentor?error=${encodeURIComponent(insertError.message)}`);
  }

  revalidatePath("/mentor");
  redirect("/mentor?uploaded=1");
}

export async function deleteProblem(formData: FormData) {
  const { user } = await requireRole("mentor");
  const problemId = String(formData.get("problem_id"));
  const supabase = createSupabaseAdminClient();

  const { data: problem, error: problemError } = await supabase
    .from("problems")
    .select("id,uploaded_by,file_url")
    .eq("id", problemId)
    .maybeSingle();

  if (problemError || !problem || problem.uploaded_by !== user.id) {
    redirect("/mentor?error=delete-forbidden");
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select("r2_key,file_url")
    .eq("problem_id", problemId);

  if (submissionsError) {
    redirect("/mentor?error=delete-failed");
  }

  const { error: deleteError } = await supabase.from("problems").delete().eq("id", problemId).eq("uploaded_by", user.id);

  if (deleteError) {
    console.error("DB_DELETE_FAILED", deleteError);
    redirect("/mentor?error=delete-failed");
  }

  await deleteR2Keys([storageKeyFor(problem), ...(submissions ?? []).map(storageKeyFor)]).catch((error) =>
    console.error("R2_DELETE_FAILED", error)
  );

  revalidatePath("/mentor");
  revalidatePath("/student");
  revalidatePath("/admin");
  redirect("/mentor?deleted=1");
}

export async function deleteSubmission(formData: FormData) {
  const { user } = await requireRole("mentor");
  const submissionId = String(formData.get("submission_id"));
  const supabase = createSupabaseAdminClient();

  const { data: submission, error: lookupError } = await supabase
    .from("submissions")
    .select("id,problem_id,r2_key,file_url")
    .eq("id", submissionId)
    .maybeSingle();

  if (lookupError || !submission) {
    redirect("/mentor?error=delete-forbidden");
  }

  const { data: problem, error: problemError } = await supabase
    .from("problems")
    .select("uploaded_by")
    .eq("id", submission.problem_id)
    .maybeSingle();

  if (problemError || !problem || problem.uploaded_by !== user.id) {
    redirect("/mentor?error=delete-forbidden");
  }

  const { error: deleteError } = await supabase.from("submissions").delete().eq("id", submission.id);

  if (deleteError) {
    console.error("DB_DELETE_FAILED", deleteError);
    redirect("/mentor?error=delete-failed");
  }

  await deleteR2Keys([storageKeyFor(submission)]).catch((error) => console.error("R2_DELETE_FAILED", error));

  revalidatePath("/mentor");
  revalidatePath("/student");
  revalidatePath("/admin");
  redirect("/mentor?deleted=1");
}

export async function gradeSubmission(formData: FormData) {
  const { user } = await requireRole("mentor");
  const submissionId = String(formData.get("submission_id"));
  const score = Number(formData.get("score"));
  const feedback = String(formData.get("feedback"));
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.rpc("grade_submission", {
    p_submission_id: submissionId,
    p_score: score,
    p_feedback: feedback,
    p_graded_by: user.id
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/mentor");
  revalidatePath("/leaderboard");
}
