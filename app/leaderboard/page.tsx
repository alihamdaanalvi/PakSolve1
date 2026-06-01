import { DashboardShell } from "@/components/DashboardShell";
import { currentBadge } from "@/lib/badges";
import { getSessionProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export default async function LeaderboardPage() {
  const { profile } = await getSessionProfile();
  if (!profile) return null;

  const supabase = createSupabaseAdminClient();
  const [{ data: students }, { data: badges }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "student").eq("status", "active").order("total_points", { ascending: false }),
    supabase.from("badges").select("*").order("points_threshold")
  ]);

  return (
    <DashboardShell profile={profile}>
      <h1 className="text-3xl font-semibold">Leaderboard</h1>
      <p className="mb-6 text-sm text-slate-500">Ranked by total awarded points.</p>
      <div className="overflow-x-auto rounded-md border border-line bg-white">
        <table className="w-full text-left">
          <thead className="bg-panel text-sm text-slate-500">
            <tr>
              <th className="table-cell">Rank</th>
              <th className="table-cell">Student</th>
              <th className="table-cell">Badge</th>
              <th className="table-cell">Points</th>
            </tr>
          </thead>
          <tbody>
            {students?.map((student, index) => {
              const badge = currentBadge(student.total_points, badges ?? []);
              const mine = student.user_id === profile.user_id;
              return (
                <tr key={student.id} className={`border-t border-line ${mine ? "bg-emerald-50" : ""}`}>
                  <td className="table-cell font-semibold">#{index + 1}</td>
                  <td className="table-cell">{student.avatar_url ? <img alt="" className="mr-2 inline h-8 w-8 rounded-full" src={student.avatar_url} /> : null}{student.name}</td>
                  <td className="table-cell">{badge?.icon} {badge?.name ?? student.badge_level}</td>
                  <td className="table-cell">{student.total_points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
