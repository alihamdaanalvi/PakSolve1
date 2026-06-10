import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-panel p-4 text-ink">
      <AuthForm mode="signup" />
    </main>
  );
}
