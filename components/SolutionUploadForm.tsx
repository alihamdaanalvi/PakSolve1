"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { MAX_FILE_SIZE } from "@/lib/files";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function readableFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function SolutionUploadForm({ problemId, label }: { problemId: string; label: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  async function readJson(response: Response) {
    const text = await response.text();
    try {
      return text ? (JSON.parse(text) as { error?: string; [key: string]: unknown }) : {};
    } catch {
      return { error: text.slice(0, 180) };
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a PDF before submitting.");
      return;
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files can be uploaded.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`PDF is too large. Maximum size is ${readableFileSize(MAX_FILE_SIZE)}.`);
      return;
    }

    setPending(true);
    try {
      const signedResponse = await fetch("/api/submissions/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        })
      });

      const signed = await readJson(signedResponse);
      if (!signedResponse.ok) {
        setError(signed.error ?? `Upload setup failed with HTTP ${signedResponse.status}.`);
        return;
      }

      const upload = await supabase.storage
        .from(String(signed.bucket))
        .uploadToSignedUrl(String(signed.path), String(signed.token), file, {
          contentType: "application/pdf"
        });

      if (upload.error) {
        setError(`Storage upload failed: ${upload.error.message}`);
        return;
      }

      const completeResponse = await fetch("/api/submissions/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId,
          key: signed.key,
          fileName: file.name,
          fileSize: file.size
        })
      });
      const complete = await readJson(completeResponse);

      if (!completeResponse.ok) {
        setError(complete.error ?? `Upload save failed with HTTP ${completeResponse.status}.`);
        return;
      }

      window.location.assign("/student?submitted=1");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <input ref={fileRef} accept=".pdf,application/pdf" className="form-field" name="file" required type="file" />
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <button className="btn-primary" disabled={pending} type="submit">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {label}
      </button>
    </form>
  );
}
