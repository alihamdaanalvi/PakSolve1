import type { Badge } from "@/lib/types";

export function currentBadge(points: number, badges: Badge[]) {
  return [...badges]
    .sort((a, b) => b.points_threshold - a.points_threshold)
    .find((badge) => points >= badge.points_threshold);
}
