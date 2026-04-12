'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Label,
} from 'recharts';
/**
 * A2UI component props — base props shared by all A2UI components.
 * Defined inline since the SDK exports this type from an internal path only.
 */
type A2UIComponentProps<T = unknown> = T & {
  surfaceId: string;
  componentId: string;
  weight?: number;
};

// ── Color palette for dark theme ──
const CHART_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#22c55e', // green
  '#f97316', // orange
  '#eab308', // yellow
  '#ef4444', // red
  '#14b8a6', // teal
  '#a855f7', // violet
];

const GRID_COLOR = '#2a2a40';
const TEXT_COLOR = '#b0b0c8';
const TOOLTIP_BG = '#16162a';
const TOOLTIP_BORDER = '#2e2e48';

/** Truncate a label to maxLen chars with ellipsis */
function truncLabel(s: string, maxLen = 28): string {
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
}

/** Compute the longest label width for dynamic YAxis sizing */
function yAxisWidth(data: { label: string }[], maxChars = 22): number {
  const longest = Math.max(...data.map((d) => Math.min(d.label.length, maxChars)), 4);
  return Math.min(longest * 7 + 16, 180);
}

// ── Custom percentage label for pie slices ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props as {
    cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
  };
  if (percent < 0.04) return null; // skip tiny slices
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" fontSize={11} fontWeight={600} textAnchor="middle" dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ── Bar Chart ──

interface BarChartData {
  label: string;
  value: number;
}

interface SurveyBarChartProps {
  title?: string;
  data?: BarChartData[];
  color?: string;
  horizontal?: boolean;
}

export function SurveyBarChartComponent(props: A2UIComponentProps<SurveyBarChartProps>) {
  const { title, data = [], color = CHART_COLORS[0], horizontal = false } = props;
  const total = data.reduce((s, d) => s + d.value, 0);

  // Add percentage to tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatTooltip = (value: any) => [`${value} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`, 'Responses'];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {title && <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>}
      {total > 0 && <p className="text-xs text-muted-foreground mb-4">N = {total}</p>}
      <div style={{ width: '100%', height: horizontal ? Math.max(data.length * 44, 160) : 280 }}>
        <ResponsiveContainer>
          {horizontal ? (
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: TEXT_COLOR, fontSize: 11 }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={{ stroke: GRID_COLOR }}
                label={{ value: 'Responses', position: 'insideBottom', offset: -2, fill: TEXT_COLOR, fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: TEXT_COLOR, fontSize: 11 }}
                width={yAxisWidth(data)}
                tickFormatter={(v) => truncLabel(v)}
              />
              <Tooltip
                formatter={formatTooltip}
                contentStyle={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, color: '#e8e8f0', fontSize: 12 }}
              />
              <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={data} margin={{ left: 4, right: 4, top: 5, bottom: data.length > 6 ? 20 : 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: TEXT_COLOR, fontSize: 11 }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={{ stroke: GRID_COLOR }}
                interval={0}
                angle={data.length > 5 ? -35 : 0}
                textAnchor={data.length > 5 ? 'end' : 'middle'}
                height={data.length > 5 ? 70 : 35}
                tickFormatter={(v) => truncLabel(v, 20)}
              />
              <YAxis
                tick={{ fill: TEXT_COLOR, fontSize: 11 }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={{ stroke: GRID_COLOR }}
                allowDecimals={false}
                label={{ value: 'Responses', angle: -90, position: 'insideLeft', offset: 10, fill: TEXT_COLOR, fontSize: 11 }}
              />
              <Tooltip
                formatter={formatTooltip}
                contentStyle={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, color: '#e8e8f0', fontSize: 12 }}
              />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Pie / Donut Chart ──

interface PieChartData {
  label: string;
  value: number;
}

interface SurveyPieChartProps {
  title?: string;
  data?: PieChartData[];
  donut?: boolean;
}

export function SurveyPieChartComponent(props: A2UIComponentProps<SurveyPieChartProps>) {
  const { title, data = [], donut = false } = props;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {title && <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>}
      {total > 0 && <p className="text-xs text-muted-foreground mb-4">N = {total}</p>}
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="45%"
              innerRadius={donut ? 55 : 0}
              outerRadius={100}
              strokeWidth={2}
              stroke={TOOLTIP_BG}
              label={renderPieLabel}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
              {donut && total > 0 && (
                <Label value={String(total)} position="center" fill="#e8e8f0" fontSize={22} fontWeight={700} />
              )}
            </Pie>
            <Tooltip
              formatter={(value: any) => [`${value} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`, 'Responses']}
              contentStyle={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, color: '#e8e8f0', fontSize: 12 }}
            />
            <Legend
              verticalAlign="bottom"
              wrapperStyle={{ paddingTop: 16 }}
              formatter={(value) => <span style={{ color: TEXT_COLOR, fontSize: 12 }}>{truncLabel(value, 24)}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Histogram ──

interface HistogramData {
  label: string;
  count: number;
}

interface SurveyHistogramProps {
  title?: string;
  data?: HistogramData[];
  color?: string;
}

export function SurveyHistogramComponent(props: A2UIComponentProps<SurveyHistogramProps>) {
  const { title, data = [], color = CHART_COLORS[4] } = props;
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {title && <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>}
      {total > 0 && <p className="text-xs text-muted-foreground mb-4">N = {total}</p>}
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: 4, right: 4, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: TEXT_COLOR, fontSize: 12 }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={{ stroke: GRID_COLOR }}
            />
            <YAxis
              tick={{ fill: TEXT_COLOR, fontSize: 11 }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={{ stroke: GRID_COLOR }}
              allowDecimals={false}
              label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 10, fill: TEXT_COLOR, fontSize: 11 }}
            />
            <Tooltip
              formatter={(value: any) => [`${value} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`, 'Count']}
              contentStyle={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, color: '#e8e8f0', fontSize: 12 }}
            />
            <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Stat Grid ──

interface StatItem {
  label: string;
  value: string;
  trend?: string;
}

interface SurveyStatGridProps {
  title?: string;
  stats?: StatItem[];
}

export function SurveyStatGridComponent(props: A2UIComponentProps<SurveyStatGridProps>) {
  const { title, stats = [] } = props;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {title && <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center">
            <div className="text-2xl font-bold text-foreground truncate">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1.5 truncate">{stat.label}</div>
            {stat.trend && (
              <div className={`text-xs mt-1 font-medium ${stat.trend.startsWith('+') ? 'text-green-400' : stat.trend.startsWith('-') ? 'text-red-400' : 'text-muted-foreground'}`}>
                {stat.trend}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Text List (word frequency / text responses) ──

interface TextListItem {
  text: string;
  count?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

interface SurveyTextListProps {
  title?: string;
  items?: TextListItem[];
  showCount?: boolean;
}

export function SurveyTextListComponent(props: A2UIComponentProps<SurveyTextListProps>) {
  const { title, items = [], showCount = true } = props;

  const sentimentColor = (s?: string) => {
    if (s === 'positive') return 'text-green-400';
    if (s === 'negative') return 'text-red-400';
    return 'text-muted-foreground';
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {title && <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>}
      <div className="space-y-2.5 max-h-[320px] overflow-y-auto">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/20 px-3.5 py-2.5">
            <span className={`flex-1 text-sm leading-relaxed ${sentimentColor(item.sentiment)}`}>{item.text}</span>
            {showCount && item.count !== undefined && (
              <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary border border-primary/20">
                {item.count}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
