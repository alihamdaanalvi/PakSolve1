import { DashboardShell } from "@/components/DashboardShell";
import { SubmitButton } from "@/components/SubmitButton";
import { deleteUser, inviteMentor, setProfileStatus, updateBadge, updateStudentProfile } from "@/app/actions/admin";
import { requireRole } from "@/lib/auth";
import { BATCHES, SUBJECTS, formatBatch, formatSubject, normalizeBatch, normalizeSubjects } from "@/lib/academics";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Problem, Profile, Submission, Subject } from "@/lib/types";
import { Pencil } from "lucide-react";

type AdminProblem = Problem & {
  mentor: Pick<Profile, "name" | "email"> | null;
  submissions: AdminSubmission[];
};

type AdminSubmission = Submission & {
  problem: Pick<Problem, "title" | "max_points"> | null;
  student: Pick<Profile, "name" | "email"> | null;
};

function StudentEditPanel({ user }: { user: Profile }) {
  const batch = normalizeBatch(user.batch);
  const subjects = normalizeSubjects(user.subjects);

  return (
    <details className="group">
      <summary className="btn-muted w-fit cursor-pointer list-none">
        <Pencil className="h-4 w-4" />
        Edit
      </summary>
      <form action={updateStudentProfile} className="mt-3 grid min-w-[320px] gap-2 rounded-md border border-line bg-panel p-3">
        <input name="user_id" type="hidden" value={user.user_id} />
        <label className="text-xs font-semibold text-slate-600">
          Name
          <input className="form-field mt-1" name="name" required defaultValue={user.name} />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Batch
          <select className="form-field mt-1" name="batch" defaultValue={batch}>
            {BATCHES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-slate-600">Subjects</legend>
          <div className="flex gap-3">
            {SUBJECTS.map((subject) => (
              <label key={subject.value} className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                <input name="subjects" type="checkbox" value={subject.value} defaultChecked={subjects.includes(subject.value as Subject)} />
                {subject.label}
              </label>
            ))}
          </div>
        </fieldset>
        <SubmitButton variant="muted">Save Changes</SubmitButton>
      </form>
    </details>
  );
}

export default async function AdminDashboard({
  searchParams
}: {
  searchParams?: { invite_link?: string; invite_email?: string; invite_error?: string };
}) {
  const { profile } = await requireRole("admin");
  const supabase = createSupabaseAdminClient();
  const [{ data: users }, { data: rawProblems }, { data: rawSubmissions }, { data: badges }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("problems").select("*").order("created_at", { ascending: false }),
    supabase.from("submissions").select("*").order("created_at", { ascending: false }),
    supabase.from("badges").select("*").order("points_threshold")
  ]);
  const usersById = new Map((users ?? []).map((user) => [user.user_id, user]));
  const problemsById = new Map((rawProblems ?? []).map((problem) => [problem.id, problem]));
  const submissions: AdminSubmission[] = (rawSubmissions ?? []).map((submission) => ({
    ...submission,
    problem: problemsById.get(submission.problem_id)
      ? {
          title: problemsById.get(submission.problem_id)!.title,
          max_points: problemsById.get(submission.problem_id)!.max_points
        }
      : null,
    student: usersById.get(submission.student_id)
      ? {
          name: usersById.get(submission.student_id)!.name,
          email: usersById.get(submission.student_id)!.email
        }
      : null
  }));
  const submissionsByProblem = new Map<string, AdminSubmission[]>();

  for (const submission of submissions) {
    const existing = submissionsByProblem.get(submission.problem_id) ?? [];
    existing.push(submission);
    submissionsByProblem.set(submission.problem_id, existing);
  }

  const problems: AdminProblem[] = (rawProblems ?? []).map((problem) => {
    const mentor = usersById.get(problem.uploaded_by);

    return {
      ...problem,
      mentor: mentor ? { name: mentor.name, email: mentor.email } : null,
      submissions: submissionsByProblem.get(problem.id) ?? []
    };
  });
  const gradedCount = submissions.filter((submission) => submission.status === "graded").length;
  const pendingStudents = users?.filter((user) => user.role === "student" && user.status === "pending") ?? [];
  const inviteLink = searchParams?.invite_link;
  const inviteEmail = searchParams?.invite_email;
  const inviteError = searchParams?.invite_error;

  return (
    <DashboardShell profile={profile}>
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-slate-500">Users, approvals, problems, submissions, and badge levels.</p>
        </div>
        <form action={inviteMentor} className="grid gap-2 rounded-md border border-line bg-white p-3 md:grid-cols-[1fr_1fr_auto]">
          <input className="form-field" name="name" placeholder="Mentor name" />
          <input className="form-field" name="email" placeholder="Mentor email" required type="email" />
          <SubmitButton>Invite</SubmitButton>
        </form>
      </div>

      {inviteLink ? (
        <section className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="font-semibold text-emerald-950">Mentor setup link generated</h2>
          <p className="mt-1 text-sm text-emerald-900">
            Send this link to {inviteEmail}. It opens the mentor account creation page.
          </p>
          <input className="form-field mt-3 bg-white" readOnly value={inviteLink} />
        </section>
      ) : null}

      {inviteError ? (
        <section className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {inviteError}
        </section>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          ["Users", users?.length ?? 0],
          ["Problems", problems?.length ?? 0],
          ["Submissions", submissions?.length ?? 0],
          ["Graded", gradedCount]
        ].map(([label, value]) => (
          <div key={label} className="surface p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="mb-6 surface">
        <div className="border-b border-line p-4">
          <h2 className="font-semibold">Pending Approvals</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <tbody>
              {pendingStudents.map((user) => (
                <tr key={user.id} className="border-b border-line last:border-0">
                  <td className="table-cell">
                    <p className="font-medium">{user.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="batch-pill">{formatBatch(normalizeBatch(user.batch))}</span>
                      {normalizeSubjects(user.subjects).map((subject) => (
                        <span className="category-pill" key={subject}>{formatSubject(subject)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="table-cell">{user.email}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <form action={setProfileStatus}>
                        <input name="user_id" type="hidden" value={user.user_id} />
                        <input name="status" type="hidden" value="active" />
                        <SubmitButton>Approve</SubmitButton>
                      </form>
                      <form action={setProfileStatus}>
                        <input name="user_id" type="hidden" value={user.user_id} />
                        <input name="status" type="hidden" value="rejected" />
                        <SubmitButton variant="muted">Reject</SubmitButton>
                      </form>
                    </div>
                  </td>
                  <td className="table-cell">
                    <StudentEditPanel user={user} />
                  </td>
                </tr>
              ))}
              {!pendingStudents.length ? (
                <tr>
                  <td className="table-cell text-slate-500">No students awaiting approval.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6 surface">
        <div className="border-b border-line p-4">
          <h2 className="font-semibold">All Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-panel text-sm text-slate-500">
              <tr>
                <th className="table-cell">Name</th>
                <th className="table-cell">Role</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Batch</th>
                <th className="table-cell">Subjects</th>
                <th className="table-cell">Points</th>
                <th className="table-cell">Joined</th>
                <th className="table-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => {
                const studentBatch = normalizeBatch(user.batch);
                const studentSubjects = normalizeSubjects(user.subjects);

                return (
                  <tr key={user.id} className="border-t border-line">
                    <td className="table-cell">{user.name}</td>
                    <td className="table-cell capitalize">{user.role}</td>
                    <td className="table-cell capitalize">{user.status}</td>
                    <td className="table-cell">
                      {user.role === "student" ? <span className="batch-pill">{formatBatch(studentBatch)}</span> : "-"}
                    </td>
                    <td className="table-cell">
                      {user.role === "student" ? (
                        <div className="flex flex-wrap gap-2">
                          {studentSubjects.map((subject) => (
                            <span className="category-pill" key={subject}>{formatSubject(subject)}</span>
                          ))}
                        </div>
                      ) : "-"}
                    </td>
                    <td className="table-cell">{user.total_points}</td>
                    <td className="table-cell">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-2">
                        {user.role === "student" ? <StudentEditPanel user={user} /> : null}
                        <form action={setProfileStatus}>
                          <input name="user_id" type="hidden" value={user.user_id} />
                          <input name="status" type="hidden" value={user.status === "active" ? "rejected" : "active"} />
                          <SubmitButton variant="muted">{user.status === "active" ? "Deactivate" : "Activate"}</SubmitButton>
                        </form>
                        <form action={deleteUser}>
                          <input name="user_id" type="hidden" value={user.user_id} />
                          <SubmitButton variant="muted">Delete</SubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6 surface">
        <div className="border-b border-line p-4">
          <h2 className="font-semibold">Uploaded Problems</h2>
        </div>
        <div className="divide-y divide-line">
          {problems.map((problem) => (
            <article key={problem.id} className="p-4">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div>
                  <h3 className="text-lg font-bold">{problem.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{problem.description}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Mentor: {problem.mentor?.name ?? "Unknown"} ({problem.mentor?.email ?? "No email"}) | Due {new Date(problem.deadline).toLocaleString()} | {problem.max_points} points
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="category-pill">{formatSubject(problem.subject ?? "math")}</span>
                    <span className="batch-pill">{formatBatch(normalizeBatch(problem.batch))}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="status-pill border-sky-200 bg-sky-50 text-sky-800">{problem.submissions.length} submissions</span>
                  {problem.file_url ? <a className="btn-muted" href={`/api/download/problems?key=${encodeURIComponent(problem.file_url)}`}>Download</a> : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {problem.submissions.map((submission) => (
                  <div key={submission.id} className="rounded-md border border-line bg-panel p-3 text-sm">
                    <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                      <div>
                        <p className="font-semibold">{submission.student?.name ?? "Student"}</p>
                        <p className="text-xs text-slate-500">{submission.student?.email ?? "No email"} | Submitted {new Date(submission.created_at).toLocaleString()}</p>
                      </div>
                      <span className={submission.status === "graded" ? "status-pill border-emerald-200 bg-emerald-50 text-emerald-800" : "status-pill border-amber-200 bg-amber-50 text-amber-800"}>
                        {submission.status}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-700">
                      Score: {submission.score ?? "-"}/{problem.max_points}
                      {submission.feedback ? ` | Feedback: ${submission.feedback}` : ""}
                    </p>
                  </div>
                ))}
                {!problem.submissions.length ? <p className="rounded-md border border-dashed border-line p-3 text-sm text-slate-500">No submissions for this problem yet.</p> : null}
              </div>
            </article>
          ))}
          {!problems.length ? <p className="p-4 text-sm text-slate-500">No problems uploaded yet.</p> : null}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface p-4">
          <h2 className="mb-4 font-semibold">Badge Thresholds</h2>
          <div className="space-y-3">
            {badges?.map((badge) => (
              <form action={updateBadge} className="grid grid-cols-[1fr_120px_auto] gap-2" key={badge.id}>
                <input name="id" type="hidden" value={badge.id} />
                <span className="py-2 text-sm">{badge.icon} {badge.name}</span>
                <input className="form-field" name="points_threshold" type="number" defaultValue={badge.points_threshold} />
                <SubmitButton variant="muted">Save</SubmitButton>
              </form>
            ))}
          </div>
        </div>
        <div className="surface p-4">
          <h2 className="mb-4 font-semibold">Recent Submissions</h2>
          <div className="space-y-3">
            {submissions?.slice(0, 6).map((submission) => (
              <div key={submission.id} className="rounded-md border border-line bg-panel p-3 text-sm">
                <p className="font-medium">{submission.student?.name ?? "Student"} submitted {submission.problem?.title ?? "a problem"}</p>
                <p className="mt-1 text-slate-600">Score: {submission.score ?? "-"}/{submission.problem?.max_points ?? "-"}</p>
                <p className="mt-1 capitalize text-slate-500">{submission.status} · {new Date(submission.created_at).toLocaleString()}</p>
              </div>
            ))}
            {!submissions?.length ? <p className="text-sm text-slate-500">No submissions yet.</p> : null}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
