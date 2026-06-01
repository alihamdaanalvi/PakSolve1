import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

export async function getSessionProfile() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single<Profile>();

  return { user, profile };
}

export async function requireRole(role: Role) {
  const { user, profile } = await getSessionProfile();

  if (!user || !profile) {
    redirect("/login");
  }

  if (profile.status !== "active") {
    redirect(`/login?status=${profile.status}`);
  }

  if (profile.role !== role) {
    redirect(`/${profile.role}`);
  }

  return { user, profile };
}

export function dashboardPath(role: Role) {
  return `/${role}`;
}
