/** Stable editor colors for y-codemirror remote selections (must be hex — HSL breaks colorLight). */
export function collabUserColors(seed: string): { color: string; colorLight: string } {
  const hue = hashString(seed) % 360
  const color = hslToHex(hue, 82, 58)
  return { color, colorLight: `${color}40` }
}

function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0
  return Math.abs(hash)
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const channel = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * channel)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
