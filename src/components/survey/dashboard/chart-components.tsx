'use client';

interface BarChartProps {
  data: { label: string; value: number }[];
  maxValue?: number;
}

export function BarChart({ data, maxValue }: BarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground w-32 truncate shrink-0">
            {item.label}
          </span>
          <div className="flex-1 h-6 bg-muted rounded-sm overflow-hidden">
            <div
              className="h-full bg-primary/80 rounded-sm transition-all duration-500"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium w-10 text-right shrink-0">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

interface PieChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
}

export function PieChart({ data, size = 120 }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  let cumulativePercent = 0;
  const radius = size / 2;
  const center = radius;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((item, i) => {
          const percent = item.value / total;
          const startAngle = cumulativePercent * 2 * Math.PI - Math.PI / 2;
          cumulativePercent += percent;
          const endAngle = cumulativePercent * 2 * Math.PI - Math.PI / 2;

          const largeArc = percent > 0.5 ? 1 : 0;
          const x1 = center + radius * Math.cos(startAngle);
          const y1 = center + radius * Math.sin(startAngle);
          const x2 = center + radius * Math.cos(endAngle);
          const y2 = center + radius * Math.sin(endAngle);

          if (data.length === 1) {
            return (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill={item.color}
              />
            );
          }

          return (
            <path
              key={i}
              d={`M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={item.color}
            />
          );
        })}
      </svg>
      <div className="space-y-1">
        {data.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground truncate">{item.label}</span>
            <span className="font-medium ml-auto">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface HistogramProps {
  data: { label: string; value: number }[];
  maxValue?: number;
}

export function Histogram({ data, maxValue }: HistogramProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.max(100 / data.length - 2, 4);

  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center gap-1 flex-1"
        >
          <span className="text-xs font-medium">{item.value}</span>
          <div
            className="w-full bg-primary/70 rounded-t-sm transition-all duration-500 min-h-[2px]"
            style={{ height: `${(item.value / max) * 100}%` }}
          />
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
