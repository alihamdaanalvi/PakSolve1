export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = ["application/pdf"];

export function isValidPdf(file: File) {
  return ACCEPTED_FILE_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE;
}

export function sanitizePdfFilename(filename: string) {
  const fallback = "upload.pdf";
  const trimmed = filename.trim();

  if (!trimmed) {
    return fallback;
  }

  const safeName = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
}
