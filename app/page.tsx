import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";

export default async function Home() {
  const { profile } = await getSessionProfile();

  if (!profile) {
    redirect("/login");
  }

  redirect(`/${profile.role}`);
}
