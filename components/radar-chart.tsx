/* The skill radar: one axis per skill category, 0-100 on each.
 *
 * Plain SVG so it renders on the server and needs no chart library. When a
 * baseline is given it is drawn as a dashed outline underneath, so the area
 * that filled in since the first analysis is the visible difference.
 */

export type RadarAxis = { label: string; value: number; baseline?: number };

export function RadarChart({ axes, size = 320, className }: {
  axes: RadarAxis[]; size?: number; className?: string;
}) {
  if (axes.length < 3) {
    return <p className="text-muted-foreground text-sm">The radar needs at least three categories.</p>;
  }
  const pad = 56;
  const c = size / 2;
  const r = c - pad;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / axes.length;
  const point = (i: number, v: number) => {
    const d = (Math.max(0, Math.min(100, v)) / 100) * r;
    return [c + d * Math.cos(angle(i)), c + d * Math.sin(angle(i))] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => point(i, v).join(",")).join(" ");
  const hasBaseline = axes.some((a) => a.baseline !== undefined);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img"
      aria-label={`Skill radar: ${axes.map((a) => `${a.label} ${a.value}%`).join(", ")}`}>
      {[25, 50, 75, 100].map((ring) => (
        <polygon key={ring} points={poly(axes.map(() => ring))}
          className="fill-none stroke-border" strokeWidth={1} />
      ))}
      {axes.map((a, i) => {
        const [x, y] = point(i, 100);
        return <line key={a.label} x1={c} y1={c} x2={x} y2={y} className="stroke-border" strokeWidth={1} />;
      })}
      {hasBaseline && (
        <polygon points={poly(axes.map((a) => a.baseline ?? 0))}
          className="fill-none stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="4 4" />
      )}
      <polygon points={poly(axes.map((a) => a.value))}
        className="fill-emerald-500/20 stroke-emerald-600 dark:stroke-emerald-400" strokeWidth={2} />
      {axes.map((a, i) => {
        const [x, y] = point(i, a.value);
        return <circle key={a.label} cx={x} cy={y} r={3.5} className="fill-emerald-600 dark:fill-emerald-400" />;
      })}
      {axes.map((a, i) => {
        const [x, y] = point(i, 122);
        const anchor = Math.abs(x - c) < 8 ? "middle" : x > c ? "start" : "end";
        return (
          <text key={a.label} x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
            className="fill-foreground text-[11px]">
            {a.label}
            <tspan x={x} dy="1.2em" className="fill-muted-foreground font-mono text-[10px]">{a.value}%</tspan>
          </text>
        );
      })}
    </svg>
  );
}
