import { AuthForm } from "@/components/AuthForm";

export default function LoginPage({ searchParams }: { searchParams: { status?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-panel p-4 text-ink">
      <AuthForm mode="login" status={searchParams.status} />
    </main>
  );
}
