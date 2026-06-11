import { deleteFileFromR2 } from "@/lib/r2";

type R2BackedFile = {
  r2_key?: string | null;
  file_url?: string | null;
};

export function storageKeyFor(row: R2BackedFile) {
  return row.r2_key ?? row.file_url ?? null;
}

export async function deleteR2Keys(keys: Array<string | null | undefined>) {
  const uniqueKeys = Array.from(new Set(keys.filter((key): key is string => Boolean(key))));
  const failures: Array<{ key: string; error: unknown }> = [];

  await Promise.all(
    uniqueKeys.map(async (key) => {
      try {
        await deleteFileFromR2(key);
      } catch (error) {
        failures.push({ key, error });
        console.error("R2_DELETE_FAILED", { key, error });
      }
    })
  );

  return failures;
}
