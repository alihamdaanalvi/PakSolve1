export function FileInput({ name }: { name: string }) {
  return <input accept=".pdf,application/pdf" className="form-field" name={name} required type="file" />;
}
