import { gradeSubmission, uploadProblem } from "@/app/actions/mentor";
import { DashboardShell } from "@/components/DashboardShell";
import { FileInput } from "@/components/FileInput";
import { SubmitButton } from "@/components/SubmitButton";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { PlusCircle } from "lucide-react";

type MentorSubmission = {
  id: string;
  problem_id: string;
  student_id: string;
  file_url: string;
  status: string;
  score: number | null;
  feedback: string | null;
  created_at: string;
  student?: { name: string | null; email: string | null } | null;
};

type MentorProblem = {
  id: string;
  title: string;
  description: string;
  file_url: string | null;
  deadline: string;
  max_points: number;
  created_at: string;
  submissions: MentorSubmission[];
};

export default async function MentorDashboard({
  searchParams
}: {
  searchParams?: { uploaded?: string; error?: string };
}) {
  const { user, profile } = await requireRole("mentor");
  const supabase = createSupabaseAdminClient();
  const { data: rawProblems } = await supabase
    .from("problems")
    .select("*")
    .eq("uploaded_by", user.id)
    .order("created_at", { ascending: false });
  const problemIds = (rawProblems ?? []).map((problem) => problem.id);
  const { data: rawSubmissions } = problemIds.length
    ? await supabase.from("submissions").select("*").in("problem_id", problemIds).order("created_at", { ascending: false })
    : { data: [] };
  const studentIds = Array.from(new Set((rawSubmissions ?? []).map((submission) => submission.student_id)));
  const { data: studentProfiles } = studentIds.length
    ? await supabase.from("profiles").select("user_id,name,email").in("user_id", studentIds)
    : { data: [] };
  const studentsById = new Map((studentProfiles ?? []).map((student) => [student.user_id, student]));
  const submissionsByProblem = new Map<string, MentorSubmission[]>();

  for (const submission of rawSubmissions ?? []) {
    const enrichedSubmission = {
      ...submission,
      student: studentsById.get(submission.student_id) ?? null
    };
    const existing = submissionsByProblem.get(submission.problem_id) ?? [];
    existing.push(enrichedSubmission);
    submissionsByProblem.set(submission.problem_id, existing);
  }

  const problems: MentorProblem[] = (rawProblems ?? []).map((problem) => ({
    ...problem,
    submissions: submissionsByProblem.get(problem.id) ?? []
  }));
  const submissionCount = problems?.reduce((total, problem) => total + (problem.submissions?.length ?? 0), 0) ?? 0;
  const pendingCount =
    problems?.reduce(
      (total, problem) => total + (problem.submissions.filter((submission) => submission.status === "pending").length ?? 0),
      0
    ) ?? 0;
  const error =
    searchParams?.error === "invalid-file"
      ? "Upload a PDF, DOC, or DOCX file up to 10MB."
      : searchParams?.error
        ? "The problem could not be uploaded. Please try again."
        : null;

  return (
    <DashboardShell profile={profile}>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">Mentor dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Problems and grading</h1>
          <p className="mt-2 text-sm text-slate-600">Publish assignments, confirm uploads, and review every submission from one place.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:min-w-[420px]">
          {[
            ["Problems", problems?.length ?? 0],
            ["Submissions", submissionCount],
            ["Pending", pendingCount]
          ].map(([label, value]) => (
            <div key={label} className="surface p-3">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {searchParams?.uploaded ? <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-950">Problem uploaded and added to your dashboard.</div> : null}
      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-950">{error}</div> : null}

      <details className="surface mb-6 overflow-hidden" open={!problems?.length}>
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-line bg-white p-4 font-bold">
          <span className="flex items-center gap-2"><PlusCircle className="h-5 w-5 text-sky-600" /> Submit Problem</span>
          <span className="text-sm font-medium text-slate-500">Open uploader</span>
        </summary>
        <form action={uploadProblem} className="grid gap-4 p-4 lg:grid-cols-2">
          <label className="block text-sm font-medium">
            Title
            <input className="form-field mt-1" name="title" required />
          </label>
          <label className="block text-sm font-medium">
            Deadline
            <input className="form-field mt-1" name="deadline" required type="datetime-local" />
          </label>
          <label className="block text-sm font-medium">
            Max points
            <input className="form-field mt-1" min={1} name="max_points" required type="number" />
          </label>
          <label className="block text-sm font-medium">
            Problem file
            <FileInput name="file" />
          </label>
          <label className="block text-sm font-medium lg:col-span-2">
            Description
            <textarea className="form-field mt-1 min-h-24" name="description" required />
          </label>
          <div className="lg:col-span-2">
            <SubmitButton>Upload Problem</SubmitButton>
          </div>
        </form>
      </details>

      <div className="space-y-4">
        {problems?.map((problem) => (
          <section key={problem.id} className="surface p-5">
            <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row">
              <div>
                <h2 className="text-xl font-bold">{problem.title}</h2>
                <p className="mt-1 text-sm text-slate-500">Deadline {new Date(problem.deadline).toLocaleString()} | {problem.max_points} points</p>
              </div>
              {problem.file_url ? <a className="btn-muted" href={problem.file_url}>Download</a> : null}
            </div>
            <p className="mb-4 text-sm leading-6 text-slate-700">{problem.description}</p>
            <div className="space-y-3">
              {problem.submissions.map((submission) => (
                <div key={submission.id} className="rounded-md border border-line bg-panel p-3">
                  <div className="mb-3 flex flex-col justify-between gap-2 md:flex-row md:items-center">
                    <div>
                      <p className="text-sm font-semibold">{submission.student?.name ?? "Student"}</p>
                      <p className="text-xs text-slate-500">{submission.student?.email ?? "No email"} | Submitted {new Date(submission.created_at).toLocaleString()}</p>
                    </div>
                    <a className="btn-muted" href={`/api/download/submissions?path=${encodeURIComponent(submission.file_url)}`}>Download Submission</a>
                  </div>
                  {submission.status === "graded" ? (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                      Score: <span className="font-semibold">{submission.score}/{problem.max_points}</span>. Feedback: {submission.feedback}
                    </div>
                  ) : (
                    <form action={gradeSubmission} className="grid gap-2 rounded-md border border-amber-200 bg-white p-3 md:grid-cols-[120px_1fr_auto]">
                      <input name="submission_id" type="hidden" value={submission.id} />
                      <input className="form-field" max={problem.max_points} min={0} name="score" placeholder="Score" required type="number" />
                      <input className="form-field" name="feedback" placeholder="Feedback" required />
                      <SubmitButton>Submit Grade</SubmitButton>
                    </form>
                  )}
                </div>
              ))}
              {!problem.submissions?.length ? <p className="text-sm text-slate-500">No submissions yet.</p> : null}
            </div>
          </section>
        ))}
        {!problems?.length ? <div className="surface p-6 text-sm text-slate-600">No problems uploaded yet. Use Submit Problem to publish the first one.</div> : null}
      </div>
    </DashboardShell>
  );
}
