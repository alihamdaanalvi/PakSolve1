import { DashboardShell } from "@/components/DashboardShell";
import { SubmitButton } from "@/components/SubmitButton";
import { deleteUser, inviteMentor, setProfileStatus, updateBadge } from "@/app/actions/admin";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export default async function AdminDashboard({
  searchParams
}: {
  searchParams?: { invite_link?: string; invite_email?: string; invite_error?: string };
}) {
  const { profile } = await requireRole("admin");
  const supabase = createSupabaseAdminClient();
  const [{ data: users }, { data: problems }, { data: submissions }, { data: badges }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("problems").select("*, profiles(name)").order("created_at", { ascending: false }),
    supabase.from("submissions").select("*, problems(title), profiles(name)").order("created_at", { ascending: false }),
    supabase.from("badges").select("*").order("points_threshold")
  ]);
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
          ["Storage", "Supabase panel"]
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
                  <td className="table-cell font-medium">{user.name}</td>
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
                <th className="table-cell">Points</th>
                <th className="table-cell">Joined</th>
                <th className="table-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id} className="border-t border-line">
                  <td className="table-cell">{user.name}</td>
                  <td className="table-cell capitalize">{user.role}</td>
                  <td className="table-cell capitalize">{user.status}</td>
                  <td className="table-cell">{user.total_points}</td>
                  <td className="table-cell">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
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
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6 surface">
        <div className="border-b border-line p-4">
          <h2 className="font-semibold">Uploaded Problems</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-panel text-sm text-slate-500">
              <tr>
                <th className="table-cell">Problem</th>
                <th className="table-cell">Mentor</th>
                <th className="table-cell">Deadline</th>
                <th className="table-cell">Points</th>
                <th className="table-cell">File</th>
              </tr>
            </thead>
            <tbody>
              {problems?.map((problem) => (
                <tr key={problem.id} className="border-t border-line">
                  <td className="table-cell font-medium">{problem.title}</td>
                  <td className="table-cell">{problem.profiles?.name ?? "Unknown"}</td>
                  <td className="table-cell">{new Date(problem.deadline).toLocaleString()}</td>
                  <td className="table-cell">{problem.max_points}</td>
                  <td className="table-cell">{problem.file_url ? <a className="font-semibold text-sky-700" href={problem.file_url}>Download</a> : "-"}</td>
                </tr>
              ))}
              {!problems?.length ? (
                <tr>
                  <td className="table-cell text-slate-500">No problems uploaded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
                <p className="font-medium">{submission.profiles?.name ?? "Student"} submitted {submission.problems?.title ?? "a problem"}</p>
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
