"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { deleteR2Keys, storageKeyFor } from "@/lib/delete-content";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { BATCHES, SUBJECTS, normalizeBatch } from "@/lib/academics";
import type { AcademicBatch, ProfileStatus, Subject, SubjectBatches } from "@/lib/types";

export async function inviteMentor(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || email).trim();
  const supabase = createSupabaseAdminClient();
  const origin = headers().get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: `${origin}/invite`,
      data: { name, role: "mentor" }
    }
  });

  if (error) {
    redirect(`/admin?invite_error=${encodeURIComponent(error.message)}`);
  }

  if (data.user) {
    await supabase.from("profiles").upsert({
      user_id: data.user.id,
      email,
      name,
      role: "mentor",
      status: "active",
      total_points: 0,
      badge_level: "Beginner"
    });
  }

  revalidatePath("/admin");
  const inviteLink = data.properties?.action_link;
  redirect(`/admin?invite_email=${encodeURIComponent(email)}&invite_link=${encodeURIComponent(inviteLink ?? "")}`);
}

export async function setProfileStatus(formData: FormData) {
  const userId = String(formData.get("user_id"));
  const status = String(formData.get("status")) as ProfileStatus;
  const supabase = createSupabaseAdminClient();

  await supabase.from("profiles").update({ status }).eq("user_id", userId);
  revalidatePath("/admin");
}

export async function updateStudentProfile(formData: FormData) {
  const userId = String(formData.get("user_id"));
  const name = String(formData.get("name") || "").trim();
  const subjectBatches = Object.fromEntries(
    SUBJECTS.map((subject) => [
      subject.value,
      formData
        .getAll(`${subject.value}_batches`)
        .map(String)
        .filter((batch): batch is AcademicBatch => BATCHES.some((item) => item.value === batch))
    ])
  ) as SubjectBatches;
  const subjects = SUBJECTS.map((subject) => subject.value).filter((subject) => subjectBatches[subject].length > 0);
  const firstSubject = subjects[0] ?? "math";
  const batch = normalizeBatch(subjectBatches[firstSubject]?.[0]);
  const supabase = createSupabaseAdminClient();

  await supabase
    .from("profiles")
    .update({
      name,
      batch,
      subjects: subjects.length ? subjects : ["math"],
      subject_batches: subjectBatches
    })
    .eq("user_id", userId)
    .eq("role", "student");
  revalidatePath("/admin");
  revalidatePath("/student");
}

export async function deleteUser(formData: FormData) {
  const userId = String(formData.get("user_id"));
  const supabase = createSupabaseAdminClient();

  await supabase.from("profiles").delete().eq("user_id", userId);
  await supabase.auth.admin.deleteUser(userId);
  revalidatePath("/admin");
}

export async function updateBadge(formData: FormData) {
  const id = String(formData.get("id"));
  const pointsThreshold = Number(formData.get("points_threshold"));
  const supabase = createSupabaseAdminClient();

  await supabase.from("badges").update({ points_threshold: pointsThreshold }).eq("id", id);
  await supabase.rpc("recalculate_all_badges");
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
}

export async function deleteProblem(formData: FormData) {
  await requireRole("admin");
  const problemId = String(formData.get("problem_id"));
  const supabase = createSupabaseAdminClient();

  const { data: problem, error: problemError } = await supabase
    .from("problems")
    .select("id,file_url")
    .eq("id", problemId)
    .maybeSingle();

  if (problemError || !problem) {
    redirect("/admin?delete_error=problem-not-found");
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select("r2_key,file_url")
    .eq("problem_id", problemId);

  if (submissionsError) {
    redirect("/admin?delete_error=submission-lookup-failed");
  }

  const { error: deleteError } = await supabase.from("problems").delete().eq("id", problemId);

  if (deleteError) {
    console.error("DB_DELETE_FAILED", deleteError);
    redirect("/admin?delete_error=problem-delete-failed");
  }

  await deleteR2Keys([storageKeyFor(problem), ...(submissions ?? []).map(storageKeyFor)]).catch((error) =>
    console.error("R2_DELETE_FAILED", error)
  );

  revalidatePath("/admin");
  revalidatePath("/mentor");
  revalidatePath("/student");
}

export async function deleteSubmission(formData: FormData) {
  await requireRole("admin");
  const submissionId = String(formData.get("submission_id"));
  const supabase = createSupabaseAdminClient();

  const { data: submission, error: lookupError } = await supabase
    .from("submissions")
    .select("id,r2_key,file_url")
    .eq("id", submissionId)
    .maybeSingle();

  if (lookupError || !submission) {
    redirect("/admin?delete_error=submission-not-found");
  }

  const { error: deleteError } = await supabase.from("submissions").delete().eq("id", submission.id);

  if (deleteError) {
    console.error("DB_DELETE_FAILED", deleteError);
    redirect("/admin?delete_error=submission-delete-failed");
  }

  await deleteR2Keys([storageKeyFor(submission)]).catch((error) => console.error("R2_DELETE_FAILED", error));

  revalidatePath("/admin");
  revalidatePath("/mentor");
  revalidatePath("/student");
}
