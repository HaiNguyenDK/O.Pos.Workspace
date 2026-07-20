// src/lib/gradient.ts — parse chuỗi CSS "linear-gradient(...)" (từ MenuItem.imageGradient)
// sang props cho expo-linear-gradient (Phụ lục B: CSS linear-gradient → expo-linear-gradient).
export type GradientProps = {
  colors: [string, string, ...string[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

const FALLBACK: GradientProps = {
  colors: ['#F37021', '#7c2d12'],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

/** Chỉ hỗ trợ dạng `linear-gradient(<angle>deg, #a, #b, ...)` — đủ cho mock. */
export function parseGradient(css: string | undefined): GradientProps {
  if (!css) return FALLBACK;
  const inner = css.match(/linear-gradient\((.*)\)/i)?.[1];
  if (!inner) return FALLBACK;

  const parts = inner.split(',').map((s) => s.trim());
  let angle = 135;
  if (/deg$/i.test(parts[0])) {
    angle = parseFloat(parts.shift() as string);
  }
  const colors = parts.filter((p) => p.startsWith('#') || p.startsWith('rgb'));
  if (colors.length < 2) return FALLBACK;

  // Angle → vector start/end (0deg = lên trên; CSS quay theo chiều kim đồng hồ).
  const rad = ((angle - 90) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  return {
    colors: colors as [string, string, ...string[]],
    start: { x: 0.5 - dx / 2, y: 0.5 - dy / 2 },
    end: { x: 0.5 + dx / 2, y: 0.5 + dy / 2 },
  };
}
