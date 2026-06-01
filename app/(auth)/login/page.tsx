import { AuthForm } from "@/components/AuthForm";

export default function LoginPage({ searchParams }: { searchParams: { status?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <AuthForm mode="login" status={searchParams.status} />
    </main>
  );
}
