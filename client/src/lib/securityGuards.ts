export function sanitizeUserText(input: string, maxLength = 2000): string {
  const withoutTags = input.replace(/<[^>]*>/g, '');
  const withoutScripts = withoutTags
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '');
  return withoutScripts.trim().slice(0, maxLength);
}

export function isSafeHttpUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
