import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { getFileFromR2 } from "@/lib/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ProblemAccess = {
  id: string;
  title: string;
  file_url: string | null;
  uploaded_by: string;
};

export async function GET(request: NextRequest) {
  const { user, profile } = await getSessionProfile();
  const key = request.nextUrl.searchParams.get("key");

  if (!user || !profile || profile.status !== "active" || !key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: problem } = await supabase
    .from("problems")
    .select("id,title,file_url,uploaded_by")
    .eq("file_url", key)
    .single<ProblemAccess>();

  const allowed =
    profile.role === "admin" ||
    problem?.uploaded_by === user.id ||
    (profile.role === "student" && Boolean(problem));

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const file = await getFileFromR2(key);
    const bytes = file.Body ? await file.Body.transformToByteArray() : null;

    if (!bytes) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filename = `${problem?.title?.replace(/[^a-zA-Z0-9._-]/g, "_") || "problem"}.pdf`;

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": file.ContentType ?? "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=0, no-store"
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
