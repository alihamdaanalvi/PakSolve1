import type { AcademicBatch, Subject } from "@/lib/types";

export const BATCHES: Array<{ value: AcademicBatch; label: string }> = [
  { value: "basic", label: "Basic" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" }
];

export const SUBJECTS: Array<{ value: Subject; label: string }> = [
  { value: "physics", label: "Physics" },
  { value: "math", label: "Math" }
];

export function formatBatch(batch: AcademicBatch) {
  return BATCHES.find((item) => item.value === batch)?.label ?? batch;
}

export function formatSubject(subject: Subject) {
  return SUBJECTS.find((item) => item.value === subject)?.label ?? subject;
}

export function normalizeBatch(batch?: string | null): AcademicBatch {
  return BATCHES.some((item) => item.value === batch) ? (batch as AcademicBatch) : "basic";
}

export function normalizeSubjects(subjects?: string[] | null): Subject[] {
  const validSubjects = (subjects ?? []).filter((subject): subject is Subject =>
    SUBJECTS.some((item) => item.value === subject)
  );

  return validSubjects.length ? validSubjects : ["math"];
}
