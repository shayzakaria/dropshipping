/**
 * Codes as a person pastes them: one per line, comma separated, or with the
 * stray spaces and blank lines that come out of a spreadsheet column.
 *
 * Lives apart from the server action so the form can count them as they type
 * using exactly the same rule the server will apply — a preview that disagrees
 * with the result is worse than no preview.
 */
export function parseCodeListClient(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean))];
}
