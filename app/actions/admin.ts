"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { AcademicBatch, ProfileStatus, Subject } from "@/lib/types";

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
  const batch = String(formData.get("batch") || "basic") as AcademicBatch;
  const subjects = formData.getAll("subjects").map(String).filter(Boolean) as Subject[];
  const supabase = createSupabaseAdminClient();

  await supabase
    .from("profiles")
    .update({ name, batch, subjects: subjects.length ? subjects : ["math"] })
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
