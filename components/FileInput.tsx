export function FileInput({ name }: { name: string }) {
  return <input accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="form-field" name={name} required type="file" />;
}
