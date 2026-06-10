"use server";

import { redirect } from "next/navigation";
import type { AcademicBatch, Subject } from "@/lib/types";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function registerStudent(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();
  const batch = String(formData.get("batch") || "basic") as AcademicBatch;
  const subjects = formData.getAll("subjects").map(String).filter(Boolean) as Subject[];

  if (!email || !password || !name || !subjects.length) {
    return { error: "Name, email, password, batch, and at least one subject are required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "student", batch, subjects }
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
    subjects
  });

  return { success: "Registration submitted. An admin must approve your account before you can sign in." };
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
