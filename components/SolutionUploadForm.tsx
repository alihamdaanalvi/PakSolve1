"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { MAX_FILE_SIZE } from "@/lib/files";

function readableFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function SolutionUploadForm({ problemId, label }: { problemId: string; label: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const formData = new FormData();
    formData.set("problem_id", problemId);
    formData.set("file", file);

    setPending(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        body: formData
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "The upload failed. Please try again.");
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
