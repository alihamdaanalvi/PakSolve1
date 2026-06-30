import type { AcademicBatch, Subject, SubjectBatches } from "@/lib/types";

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

export function normalizeSubjectBatches(
  subjectBatches?: Partial<Record<string, string[]>> | null,
  fallbackBatch?: string | null,
  fallbackSubjects?: string[] | null
): SubjectBatches {
  const normalized: SubjectBatches = {
    physics: [],
    math: []
  };

  for (const subject of SUBJECTS) {
    const rawBatches = Array.isArray(subjectBatches?.[subject.value]) ? subjectBatches?.[subject.value] ?? [] : [];
    normalized[subject.value] = rawBatches
      .map((batch) => normalizeBatch(batch))
      .filter((batch, index, batches) => batches.indexOf(batch) === index);
  }

  const hasAnyBatch = SUBJECTS.some((subject) => normalized[subject.value].length > 0);
  if (hasAnyBatch) {
    return normalized;
  }

  for (const rawSubject of fallbackSubjects ?? []) {
    const [subject, batch] = rawSubject.split(":");
    if (SUBJECTS.some((item) => item.value === subject) && BATCHES.some((item) => item.value === batch)) {
      normalized[subject as Subject].push(batch as AcademicBatch);
    }
  }

  const hasEncodedBatch = SUBJECTS.some((subject) => normalized[subject.value].length > 0);
  if (hasEncodedBatch) {
    return normalized;
  }

  const batch = normalizeBatch(fallbackBatch);
  for (const subject of normalizeSubjects(fallbackSubjects)) {
    normalized[subject] = [batch];
  }

  return normalized;
}

export function subjectBatchPairs(subjectBatches: SubjectBatches) {
  return SUBJECTS.flatMap((subject) =>
    subjectBatches[subject.value].map((batch) => ({ subject: subject.value, batch }))
  );
}
