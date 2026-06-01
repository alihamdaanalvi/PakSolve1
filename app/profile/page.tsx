import { DashboardShell } from "@/components/DashboardShell";
import { currentBadge } from "@/lib/badges";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { Award, Medal, TrendingUp } from "lucide-react";

export default async function ProfilePage() {
  const { user, profile } = await requireRole("student");
  const supabase = createSupabaseAdminClient();
  const [{ data: badges }, { data: students }, { data: submissions }] = await Promise.all([
    supabase.from("badges").select("*").order("points_threshold"),
    supabase.from("profiles").select("user_id,total_points").eq("role", "student").eq("status", "active").order("total_points", { ascending: false }),
    supabase.from("submissions").select("*, problems(title,max_points)").eq("student_id", user.id).order("created_at", { ascending: false })
  ]);
  const rank = (students ?? []).findIndex((student) => student.user_id === profile.user_id) + 1;
  const badge = currentBadge(profile.total_points, badges ?? []);
  const nextBadge = (badges ?? []).find((item) => item.points_threshold > profile.total_points);
  const progressTarget = nextBadge?.points_threshold ?? Math.max(profile.total_points, 1);
  const progress = Math.min(100, Math.round((profile.total_points / progressTarget) * 100));

  return (
    <DashboardShell profile={profile}>
      <div className="mb-6 overflow-hidden rounded-md border border-line bg-white shadow-sm shadow-slate-200/70">
        <div className="bg-gradient-to-r from-sky-600 to-emerald-500 p-6 text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/80">Student profile</p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            {profile.avatar_url ? <img alt="" className="h-20 w-20 rounded-full border-4 border-white/40 object-cover" src={profile.avatar_url} /> : <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-white/40 bg-white/20 text-3xl font-bold">{profile.name.charAt(0)}</div>}
            <div>
              <h1 className="text-3xl font-bold">{profile.name}</h1>
              <p className="text-sm text-white/80">{profile.email}</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          {[
            { label: "Total points", value: profile.total_points, icon: TrendingUp, iconClass: "text-sky-600" },
            { label: "Badge", value: `${badge?.icon ?? ""} ${badge?.name ?? profile.badge_level}`, icon: Award, iconClass: "text-emerald-600" },
            { label: "Rank", value: rank ? `#${rank}` : "-", icon: Medal, iconClass: "text-amber-600" }
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div className="rounded-md border border-line bg-panel p-4" key={item.label}>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{item.label}</p>
                <Icon className={`h-5 w-5 ${item.iconClass}`} />
              </div>
              <p className="mt-2 text-2xl font-bold">{item.value}</p>
              </div>
            );
          })}
        </div>
        <div className="border-t border-line p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">{nextBadge ? `Progress to ${nextBadge.name}` : "Top badge reached"}</span>
            <span className="text-slate-500">{profile.total_points}/{progressTarget}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-sky-600" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <section className="surface">
        <div className="border-b border-line p-4">
          <h2 className="font-bold">Recent work</h2>
        </div>
        <div className="divide-y divide-line">
          {submissions?.map((submission) => (
            <div className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center" key={submission.id}>
              <div>
                <p className="font-medium">{submission.problems?.title ?? "Problem"}</p>
                <p className="mt-1 text-sm text-slate-500">Submitted {new Date(submission.created_at).toLocaleString()}</p>
              </div>
              <div className="text-sm sm:text-right">
                <span className={submission.status === "graded" ? "status-pill border-emerald-200 bg-emerald-50 text-emerald-800" : "status-pill border-amber-200 bg-amber-50 text-amber-800"}>
                  {submission.status}
                </span>
                <p className="mt-2 text-slate-600">Score: {submission.score ?? "-"}/{submission.problems?.max_points ?? "-"}</p>
              </div>
            </div>
          ))}
          {!submissions?.length ? <p className="p-4 text-sm text-slate-500">No submissions yet.</p> : null}
        </div>
      </section>
    </DashboardShell>
  );
}
