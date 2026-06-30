"use server";

import { redirect } from "next/navigation";
import { BATCHES, SUBJECTS, normalizeBatch } from "@/lib/academics";
import type { AcademicBatch, SubjectBatches } from "@/lib/types";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function registerStudent(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
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

  if (!email || !password || !name || !subjects.length) {
    return { error: "Name, email, password, and at least one subject batch are required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "student", batch, subjects, subject_batches: subjectBatches }
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Could not create the student account." };
  }

  await supabase.from("profiles").upsert({
    user_id: data.user.id,
    email,
    name,
    role: "student",
    status: "pending",
    total_points: 0,
    badge_level: "Beginner",
    batch,
    subjects,
    subject_batches: subjectBatches
  });

  return { success: "Registration submitted. An admin must approve your account before you can sign in." };
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
