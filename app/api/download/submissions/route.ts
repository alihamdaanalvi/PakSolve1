import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type SubmissionAccess = {
  student_id: string;
  problems: { uploaded_by: string } | null;
};

export async function GET(request: NextRequest) {
  const { user, profile } = await getSessionProfile();
  const path = request.nextUrl.searchParams.get("path");

  if (!user || !profile || profile.status !== "active" || !path) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: submission } = await supabase
    .from("submissions")
    .select("student_id, problems(uploaded_by)")
    .eq("file_url", path)
    .single<SubmissionAccess>();

  const mentorId = submission?.problems?.uploaded_by;
  const allowed = profile.role === "admin" || submission?.student_id === user.id || mentorId === user.id;

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase.storage.from("submissions").createSignedUrl(path, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "File not found" }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
