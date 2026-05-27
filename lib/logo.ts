export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function logoTint(id: string) {
  const h = hashStr(id);
  const hue = h % 360;
  return {
    bg: `oklch(0.92 0.04 ${hue})`,
    fg: `oklch(0.35 0.08 ${hue})`,
    border: `oklch(0.85 0.05 ${hue})`,
  };
}

export function monogram(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9 ]/g, '').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
