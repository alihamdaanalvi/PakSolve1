"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isValidDocument } from "@/lib/files";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function submitSolution(formData: FormData) {
  const { user } = await requireRole("student");
  const file = formData.get("file") as File;
  const problemId = String(formData.get("problem_id"));

  if (!file || !isValidDocument(file)) {
    redirect("/student?error=invalid-file");
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingSubmission } = await supabase
    .from("submissions")
    .select("id")
    .eq("problem_id", problemId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existingSubmission) {
    redirect("/student?notice=already-submitted");
  }

  const path = `${user.id}/${problemId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("submissions").upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (uploadError) {
    redirect("/student?error=upload-failed");
  }

  const { error: insertError } = await supabase.from("submissions").insert({
    problem_id: problemId,
    student_id: user.id,
    file_url: path,
    status: "pending"
  });

  if (insertError) {
    redirect("/student?error=submission-failed");
  }

  revalidatePath("/student");
  redirect("/student?submitted=1");
}
