import { submitSolution } from "@/app/actions/student";
import { DashboardShell } from "@/components/DashboardShell";
import { FileInput } from "@/components/FileInput";
import { SubmitButton } from "@/components/SubmitButton";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { CheckCircle2 } from "lucide-react";

export default async function StudentDashboard({
  searchParams
}: {
  searchParams?: { submitted?: string; notice?: string; error?: string };
}) {
  const { user, profile } = await requireRole("student");
  const supabase = createSupabaseAdminClient();
  const [{ data: problems }, { data: submissions }] = await Promise.all([
    supabase.from("problems").select("*").order("deadline"),
    supabase.from("submissions").select("*, problems(title,max_points)").eq("student_id", user.id).order("created_at", { ascending: false })
  ]);
  const latestSubmissionByProblem = new Map<string, NonNullable<typeof submissions>[number]>();
  for (const submission of submissions ?? []) {
    if (!latestSubmissionByProblem.has(submission.problem_id)) {
      latestSubmissionByProblem.set(submission.problem_id, submission);
    }
  }
  const submittedCount = latestSubmissionByProblem.size;
  const gradedCount = (submissions ?? []).filter((submission) => submission.status === "graded").length;
  const notice =
    searchParams?.submitted
      ? "Solution submitted. It is now waiting for mentor review."
      : searchParams?.notice === "already-submitted"
        ? "You already submitted this problem. Your dashboard now shows its status."
        : null;
  const error =
    searchParams?.error === "invalid-file"
      ? "Upload a PDF, DOC, or DOCX file up to 10MB."
      : searchParams?.error
        ? "The submission could not be saved. Please try again."
        : null;

  return (
    <DashboardShell profile={profile}>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">Student workspace</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Problems to solve</h1>
          <p className="mt-2 text-sm text-slate-600">Submit once, then track review status and feedback here.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:min-w-[420px]">
          {[
            ["Active", problems?.length ?? 0],
            ["Submitted", submittedCount],
            ["Graded", gradedCount]
          ].map(([label, value]) => (
            <div key={label} className="surface p-3">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {notice ? <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-950">{notice}</div> : null}
      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-950">{error}</div> : null}

      <section className="mb-8 grid gap-4 xl:grid-cols-2">
        {problems?.map((problem) => {
          const submission = latestSubmissionByProblem.get(problem.id);

          return (
            <article key={problem.id} className="surface overflow-hidden">
            <div className="border-b border-line bg-gradient-to-r from-white to-sky-50 p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-xl font-bold">{problem.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">Due {new Date(problem.deadline).toLocaleString()} | {problem.max_points} points</p>
                </div>
                {submission ? (
                  <span className={submission.status === "graded" ? "status-pill border-emerald-200 bg-emerald-50 text-emerald-800" : "status-pill border-amber-200 bg-amber-50 text-amber-800"}>
                    {submission.status === "graded" ? "Graded" : "Submitted"}
                  </span>
                ) : (
                  <span className="status-pill border-sky-200 bg-sky-50 text-sky-800">Open</span>
                )}
              </div>
            </div>
            <div className="p-5">
              <p className="mb-4 text-sm leading-6 text-slate-700">{problem.description}</p>
              <div className="flex flex-col gap-3">
                {problem.file_url ? <a className="btn-muted w-fit" href={problem.file_url}>Download Problem</a> : null}
                {submission ? (
                  <div className="grid gap-3">
                    <button className="btn bg-emerald-600 text-white shadow-sm shadow-emerald-900/10" disabled type="button">
                      <CheckCircle2 className="h-4 w-4" />
                      Submitted
                    </button>
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                      Submitted {new Date(submission.created_at).toLocaleString()}
                      {submission.status === "graded" ? <span className="ml-2 font-semibold">Score: {submission.score ?? 0}/{problem.max_points}</span> : <span className="ml-2 font-semibold">Waiting for grading</span>}
                    </div>
                  </div>
                ) : (
                  <form action={submitSolution} className="grid gap-2">
                    <input name="problem_id" type="hidden" value={problem.id} />
                    <FileInput name="file" />
                    <SubmitButton>Submit Solution</SubmitButton>
                  </form>
                )}
              </div>
            </div>
            </article>
          );
        })}
      </section>

      <section className="surface">
        <div className="border-b border-line p-4">
          <h2 className="font-bold">Submission history</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-panel text-sm text-slate-500">
              <tr>
                <th className="table-cell">Problem</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Score</th>
                <th className="table-cell">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {submissions?.map((submission) => (
                <tr key={submission.id} className="border-t border-line">
                  <td className="table-cell">{submission.problems?.title}</td>
                  <td className="table-cell capitalize">{submission.status}</td>
                  <td className="table-cell">{submission.score ?? "-"}</td>
                  <td className="table-cell">{submission.feedback ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
