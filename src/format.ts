/** A signed gap such as "+0.61%"; rounds to whole basis points first so tiny negatives read "0.00%", never "-0.00%". */
export function percent(bps: number) {
  const rounded = Math.round(bps);
  return `${rounded > 0 ? '+' : rounded < 0 ? '-' : ''}${(Math.abs(rounded) / 100).toFixed(2)}%`;
}
