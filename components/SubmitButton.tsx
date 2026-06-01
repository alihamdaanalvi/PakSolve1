"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function SubmitButton({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "muted" }) {
  const { pending } = useFormStatus();

  return (
    <button className={variant === "primary" ? "btn-primary" : "btn-muted"} disabled={pending} type="submit">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
