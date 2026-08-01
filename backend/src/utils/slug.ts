export function slugify(input: string): string {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function uniqueSlug(
  base: string,
  existingSlugs: Set<string>
): string {
  const root = slugify(base) || "item";
  let candidate = root;
  let suffix = 2;
  while (existingSlugs.has(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
