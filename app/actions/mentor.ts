"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
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
