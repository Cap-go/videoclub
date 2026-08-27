/** Soft-check: founder name appears in video metadata (case-insensitive). */
export function founderNameMatchesVideo(
  founderName: string,
  title: string,
  author: string | null,
  description: string,
): boolean {
  const haystack = `${title}\n${author ?? ""}\n${description}`.toLowerCase();
  const normalized = founderName.trim().toLowerCase();
  if (!normalized) return false;
  if (haystack.includes(normalized)) return true;

  const parts = normalized.split(/\s+/).filter((p) => p.length >= 3);
  if (parts.length === 0) return haystack.includes(normalized);
  return parts.every((part) => haystack.includes(part));
}

export function isValidFounderName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 80;
}
