"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function registerStudent(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();

  if (!email || !password || !name) {
    return { error: "Name, email, and password are required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "student" }
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
    badge_level: "Beginner"
  });

  return { success: "Registration submitted. An admin must approve your account before you can sign in." };
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
