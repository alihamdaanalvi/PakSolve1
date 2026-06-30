"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { registerStudent } from "@/app/actions/auth";
import { BATCHES, SUBJECTS } from "@/lib/academics";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthForm({ mode, status }: { mode: "login" | "signup"; status?: string }) {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading(true);
    const form = new FormData(formElement);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    if (mode === "signup") {
      const result = await registerStudent(form);
      setLoading(false);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      formElement.reset();
      return;
    }

    const result = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (result.error) {
      toast.error(result.error.message);
      return;
    }

    window.location.href = "/";
  }

  const message =
    status === "pending"
      ? "Your student account is pending admin approval."
      : status === "rejected"
        ? "Your registration was rejected. Contact an administrator for help."
        : status === "missing"
          ? "Your profile is missing. Ask an administrator to repair your account."
          : null;

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-md border border-line bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-2xl font-semibold">{mode === "login" ? "Sign in" : "Student registration"}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {mode === "login" ? "Access your role dashboard." : "New students start pending approval."}
      </p>
      {message ? <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div> : null}
      {mode === "signup" ? (
        <>
          <label className="mb-4 block text-sm font-medium">
            Name
            <input className="form-field mt-1" name="name" required />
          </label>
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-medium">Batches by subject</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {SUBJECTS.map((subject) => (
                <div key={subject.value} className="rounded-md border border-line bg-panel p-3">
                  <p className="mb-2 text-sm font-semibold">{subject.label}</p>
                  <div className="grid gap-2">
                    {BATCHES.map((batch) => (
                      <label key={batch.value} className="flex items-center gap-2 text-sm font-medium">
                        <input
                          className="h-4 w-4 accent-sky-700"
                          name={`${subject.value}_batches`}
                          type="checkbox"
                          value={batch.value}
                          defaultChecked={subject.value === "math" && batch.value === "basic"}
                        />
                        {batch.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}
      <label className="mb-4 block text-sm font-medium">
        Email
        <input className="form-field mt-1" name="email" required type="email" />
      </label>
      <label className="mb-6 block text-sm font-medium">
        Password
        <input className="form-field mt-1" minLength={6} name="password" required type="password" />
      </label>
      <button className="btn-primary w-full" disabled={loading} type="submit">
        {loading ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
      </button>
      <p className="mt-4 text-center text-sm text-slate-500">
        {mode === "login" ? (
          <Link className="font-medium text-ink" href="/signup">
            Register as a student
          </Link>
        ) : (
          <Link className="font-medium text-ink" href="/login">
            Back to sign in
          </Link>
        )}
      </p>
    </form>
  );
}
