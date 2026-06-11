import { submitSolution } from "@/app/actions/student";
import { DashboardShell } from "@/components/DashboardShell";
import { FileInput } from "@/components/FileInput";
import { SubmitButton } from "@/components/SubmitButton";
import { requireRole } from "@/lib/auth";
import { SUBJECTS, formatBatch, formatSubject, normalizeBatch, normalizeSubjects } from "@/lib/academics";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export default async function StudentDashboard({
  searchParams
}: {
  searchParams?: { submitted?: string; notice?: string; error?: string };
}) {
  const { user, profile } = await requireRole("student");
  const supabase = createSupabaseAdminClient();
  const assignedBatch = normalizeBatch(profile.batch);
  const assignedSubjects = normalizeSubjects(profile.subjects);
  const [{ data: problems }, { data: submissions }] = await Promise.all([
    supabase.from("problems").select("*").eq("batch", assignedBatch).in("subject", assignedSubjects).order("deadline"),
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
      ? "Solution submitted. Your latest upload is waiting for mentor review."
      : searchParams?.notice === "already-submitted"
        ? "You already submitted this problem. Your dashboard now shows its status."
        : null;
  const error =
    searchParams?.error === "invalid-file"
      ? "Upload a PDF file up to 10MB."
      : searchParams?.error
        ? "The submission could not be saved. Please try again."
        : null;

  return (
    <DashboardShell profile={profile}>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">Student workspace</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Problems to solve</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="batch-pill">{formatBatch(assignedBatch)}</span>
            {assignedSubjects.map((subject) => (
              <span className="category-pill" key={subject}>{formatSubject(subject)}</span>
            ))}
          </div>
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

      <section className="mb-8 grid gap-6 xl:grid-cols-2">
        {SUBJECTS.filter((subject) => assignedSubjects.includes(subject.value)).map((subject) => {
          const subjectProblems = (problems ?? []).filter((problem) => problem.subject === subject.value);

          return (
          <div key={subject.value} className="surface overflow-hidden">
            <div className="border-b border-line bg-white p-4">
              <h2 className="text-lg font-bold">{subject.label}</h2>
              <p className="text-sm text-slate-500">{subjectProblems.length} {formatBatch(assignedBatch).toLowerCase()} problems</p>
            </div>
            <div className="grid gap-0 divide-y divide-line">
        {subjectProblems.map((problem) => {
          const submission = latestSubmissionByProblem.get(problem.id);

          return (
            <article key={problem.id} className="overflow-hidden">
            <div className="border-b border-line bg-gradient-to-r from-white to-sky-50 p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-xl font-bold">{problem.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="category-pill">{formatSubject(problem.subject)}</span>
                    <span className="batch-pill">{formatBatch(problem.batch)}</span>
                    <span className="text-sm text-slate-600">Due {new Date(problem.deadline).toLocaleString()} | {problem.max_points} points</span>
                  </div>
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
                {problem.file_url ? <a className="btn-muted w-fit" href={`/api/download/problems?key=${encodeURIComponent(problem.file_url)}`}>Download Problem</a> : null}
                {submission ? (
                  <div className="grid gap-3">
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                      Submitted {new Date(submission.created_at).toLocaleString()}
                      {submission.status === "graded" ? <span className="ml-2 font-semibold">Score: {submission.score ?? 0}/{problem.max_points}</span> : <span className="ml-2 font-semibold">Waiting for grading</span>}
                    </div>
                    <form action={submitSolution} className="grid gap-2">
                      <input name="problem_id" type="hidden" value={problem.id} />
                      <FileInput name="file" />
                      <SubmitButton>Replace Solution</SubmitButton>
                    </form>
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
        {!subjectProblems.length ? <p className="p-5 text-sm text-slate-500">No {subject.label.toLowerCase()} problems assigned yet.</p> : null}
            </div>
          </div>
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
