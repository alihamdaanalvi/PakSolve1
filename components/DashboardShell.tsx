import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, ClipboardList, Home, LogOut, Medal, Users } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import type { Profile, Role } from "@/lib/types";

const navByRole: Record<Role, Array<{ href: string; label: string; icon: ReactNode }>> = {
  admin: [
    { href: "/admin", label: "Overview", icon: <Home className="h-4 w-4" /> },
    { href: "/leaderboard", label: "Leaderboard", icon: <Medal className="h-4 w-4" /> }
  ],
  mentor: [
    { href: "/mentor", label: "Problems", icon: <BookOpen className="h-4 w-4" /> },
    { href: "/leaderboard", label: "Leaderboard", icon: <Medal className="h-4 w-4" /> }
  ],
  student: [
    { href: "/student", label: "Dashboard", icon: <ClipboardList className="h-4 w-4" /> },
    { href: "/profile", label: "Profile", icon: <Users className="h-4 w-4" /> },
    { href: "/leaderboard", label: "Leaderboard", icon: <Medal className="h-4 w-4" /> }
  ]
};

export function DashboardShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-panel">
      <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
        <aside className="border-b border-line bg-white/95 p-4 md:border-b-0 md:border-r">
          <div className="mb-8">
            <p className="text-xl font-bold text-ink">PakSolve</p>
            <div className="mt-3 rounded-md border border-line bg-panel p-3">
              <p className="text-sm font-semibold">{profile.name}</p>
              <p className="text-xs capitalize text-slate-500">{profile.role}</p>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {navByRole[profile.role].map((item) => (
              <Link key={item.href} className="btn-muted justify-start" href={item.href}>
                {item.icon}
                {item.label}
              </Link>
            ))}
            <form action={signOut}>
              <button className="btn-muted w-full justify-start" type="submit">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </nav>
        </aside>
        <section className="min-w-0 p-4 md:p-8">{children}</section>
      </div>
    </main>
  );
}
