/** Result of a form action, shown inline by the form that submitted it. */
export type FormState = { error?: string; notice?: string; values?: Record<string, string> } | undefined;

export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
