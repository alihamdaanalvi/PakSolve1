"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function MentorInviteForm() {
  const supabase = createSupabaseBrowserClient();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    async function prepareInviteSession() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hasInviteToken = Boolean(code || tokenHash || accessToken);

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setSessionError(error.message);
          toast.error(error.message);
        } else {
          window.history.replaceState({}, "", "/invite");
        }
      }

      if (tokenHash && (type === "invite" || type === "magiclink")) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          setSessionError(error.message);
          toast.error(error.message);
        } else {
          window.history.replaceState({}, "", "/invite");
        }
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (error) {
          setSessionError(error.message);
          toast.error(error.message);
        } else {
          window.history.replaceState({}, "", "/invite");
        }
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        const message = "Invite session not found. Open the full setup link generated in the admin dashboard.";
        setSessionError(message);
        toast.error(message);
      } else if (!hasInviteToken) {
        const message = "This page needs the full invite setup link, not just /invite.";
        setSessionError(message);
        toast.error(message);
      } else {
        setSessionError(null);
      }

      setReady(true);
    }

    prepareInviteSession();
  }, [supabase.auth]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirm_password") || "");

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password saved. Redirecting to your mentor dashboard.");
    window.location.href = "/mentor";
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-md border border-line bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-2xl font-semibold">Create mentor password</h1>
      <p className="mb-6 text-sm text-slate-500">Use the full mentor setup link, then set a password for future logins.</p>
      {sessionError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {sessionError}
        </div>
      ) : null}
      <label className="mb-4 block text-sm font-medium">
        Password
        <input className="form-field mt-1" minLength={6} name="password" required type="password" />
      </label>
      <label className="mb-6 block text-sm font-medium">
        Confirm password
        <input className="form-field mt-1" minLength={6} name="confirm_password" required type="password" />
      </label>
      <button className="btn-primary w-full" disabled={!ready || loading || Boolean(sessionError)} type="submit">
        {loading ? "Saving..." : ready ? "Save password" : "Checking invite..."}
      </button>
      <p className="mt-4 text-center text-sm text-slate-500">
        <Link className="font-medium text-ink" href="/login">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
