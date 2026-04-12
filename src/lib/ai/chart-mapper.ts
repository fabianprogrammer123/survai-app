/**
 * Deterministic chart mapper — maps survey question types to best-practice chart components.
 * Generates an initial A2UI dashboard layout without needing an AI call.
 *
 * Question Type → Chart Type:
 *   multiple_choice / dropdown (≤5 options)  → PieChart (donut)
 *   multiple_choice / dropdown (6+ options)  → BarChart (horizontal, sorted desc)
 *   checkboxes                               → BarChart (horizontal, sorted desc)
 *   linear_scale                             → Histogram (natural order) + stat card
 *   short_text / long_text                   → TextList (with sentiment)
 *   date                                     → Histogram (chronological)
 */

import type { SurveyElement, SurveyResponseData } from '@/types/survey';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#22c55e', '#f97316'];

interface A2UIComponent {
  id: string;
  componentType: string;
  props: Record<string, unknown>;
  children?: string[];
}

/**
 * Build a complete initial dashboard from question types and response data.
 * Returns { components, message } matching the AI results format.
 */
export function buildInitialDashboard(
  elements: SurveyElement[],
  responses: SurveyResponseData[]
): { components: A2UIComponent[]; message: string } {
  const components: A2UIComponent[] = [];
  const rootChildren: string[] = [];
  let colorIdx = 0;

  const answerableElements = elements.filter(
    (el) => !['section_header', 'page_break', 'file_upload'].includes(el.type)
  );

  // ── KPI Summary Row ──
  const statsId = 'stats-overview';
  const completionRate = responses.length > 0
    ? Math.round(
        (responses.filter((r) =>
          answerableElements.every((el) => !el.required || r.answers[el.id] != null)
        ).length / responses.length) * 100
      )
    : 0;

  const stats: { label: string; value: string; trend?: string }[] = [
    { label: 'Total Responses', value: String(responses.length) },
    { label: 'Completion Rate', value: `${completionRate}%` },
  ];

  // Add average for first linear scale found
  const firstScale = answerableElements.find((el) => el.type === 'linear_scale');
  if (firstScale && firstScale.type === 'linear_scale') {
    const vals = responses
      .map((r) => Number(r.answers[firstScale.id]))
      .filter((n) => !isNaN(n));
    if (vals.length > 0) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      stats.push({
        label: firstScale.title || 'Avg Rating',
        value: avg.toFixed(1),
        trend: `out of ${firstScale.max}`,
      });
    }
  }

  // Add question count
  stats.push({ label: 'Questions', value: String(answerableElements.length) });

  components.push({
    id: statsId,
    componentType: 'SurveyStatGrid',
    props: { title: 'Overview', stats },
  });
  rootChildren.push(statsId);

  // ── Per-question charts ──
  // Group small charts in pairs using Rows
  const chartIds: string[] = [];

  for (const el of answerableElements) {
    const values = responses
      .map((r) => r.answers[el.id])
      .filter((v) => v !== undefined && v !== null);

    if (values.length === 0) continue;

    const chartId = `chart-${el.id}`;
    const color = COLORS[colorIdx % COLORS.length];
    colorIdx++;

    switch (el.type) {
      case 'multiple_choice':
      case 'dropdown': {
        const counts: Record<string, number> = {};
        for (const v of values) counts[String(v)] = (counts[String(v)] || 0) + 1;

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const data = sorted.map(([label, value]) => ({ label, value }));
        const optionCount = sorted.length;

        // Check for binary (yes/no) questions
        const isBinary = optionCount === 2 && sorted.every(([l]) =>
          ['yes', 'no', 'true', 'false'].includes(l.toLowerCase())
        );

        if (isBinary || optionCount <= 5) {
          const topPct = Math.round((sorted[0][1] / values.length) * 100);
          components.push({
            id: chartId,
            componentType: 'SurveyPieChart',
            props: {
              title: isBinary ? `${topPct}% ${sorted[0][0]} — ${el.title}` : el.title,
              data,
              donut: true,
            },
          });
        } else {
          components.push({
            id: chartId,
            componentType: 'SurveyBarChart',
            props: { title: el.title, data, color, horizontal: true },
          });
        }
        chartIds.push(chartId);
        break;
      }

      case 'checkboxes': {
        const counts: Record<string, number> = {};
        for (const v of values) {
          const arr = Array.isArray(v) ? v : [v];
          for (const item of arr) counts[String(item)] = (counts[String(item)] || 0) + 1;
        }
        const data = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([label, value]) => ({ label, value }));

        components.push({
          id: chartId,
          componentType: 'SurveyBarChart',
          props: { title: el.title, data, color, horizontal: true },
        });
        chartIds.push(chartId);
        break;
      }

      case 'linear_scale': {
        const nums = values.map(Number).filter((n) => !isNaN(n));
        const distribution: Record<number, number> = {};
        for (const n of nums) distribution[n] = (distribution[n] || 0) + 1;

        // Get the min/max from element to build full range
        const min = el.min ?? 1;
        const max = el.max ?? 5;
        const data: { label: string; count: number }[] = [];
        for (let i = min; i <= max; i++) {
          let label = String(i);
          if (i === min && el.minLabel) label = `${i} (${el.minLabel})`;
          else if (i === max && el.maxLabel) label = `${i} (${el.maxLabel})`;
          data.push({ label, count: distribution[i] || 0 });
        }

        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;

        // Add a stat card for the average alongside the histogram
        const statId = `stat-${el.id}`;
        components.push({
          id: statId,
          componentType: 'SurveyStatGrid',
          props: {
            stats: [
              { label: 'Average', value: avg.toFixed(1), trend: `${min}–${max} scale` },
              { label: 'Responses', value: String(nums.length) },
            ],
          },
        });

        components.push({
          id: chartId,
          componentType: 'SurveyHistogram',
          props: { title: el.title, data, color },
        });

        // Group stat + histogram in a Row
        const rowId = `row-${el.id}`;
        components.push({
          id: rowId,
          componentType: 'Row',
          props: { gap: 16 },
          children: [statId, chartId],
        });
        chartIds.push(rowId);
        break;
      }

      case 'short_text':
      case 'long_text': {
        const textValues = values.map(String);

        // Deduplicate and count
        const freq: Record<string, number> = {};
        for (const t of textValues) {
          const key = t.trim().toLowerCase();
          freq[key] = (freq[key] || 0) + 1;
        }

        const items = Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([text, count]) => ({
            text: textValues.find((t) => t.trim().toLowerCase() === text) || text,
            count,
            sentiment: 'neutral' as const,
          }));

        components.push({
          id: chartId,
          componentType: 'SurveyTextList',
          props: {
            title: el.title,
            items,
            showCount: Object.keys(freq).length < textValues.length,
          },
        });
        chartIds.push(chartId);
        break;
      }

      case 'date': {
        const dateValues = values.map(String).sort();
        const counts: Record<string, number> = {};
        for (const d of dateValues) counts[d] = (counts[d] || 0) + 1;

        const data = Object.entries(counts).map(([label, count]) => ({ label, count }));

        components.push({
          id: chartId,
          componentType: 'SurveyHistogram',
          props: { title: el.title, data, color },
        });
        chartIds.push(chartId);
        break;
      }
    }
  }

  // ── Group small charts into Rows of 2 ──
  // Pie charts and small bars work well side-by-side
  const pieIds = chartIds.filter((id) => {
    const c = components.find((comp) => comp.id === id);
    return c?.componentType === 'SurveyPieChart';
  });

  // Pair pie charts into rows
  for (let i = 0; i < pieIds.length - 1; i += 2) {
    const rowId = `row-pair-${i}`;
    components.push({
      id: rowId,
      componentType: 'Row',
      props: { gap: 16 },
      children: [pieIds[i], pieIds[i + 1]],
    });
    // Replace the two individual IDs with the row
    const idx1 = chartIds.indexOf(pieIds[i]);
    chartIds.splice(idx1, 1);
    const idx2 = chartIds.indexOf(pieIds[i + 1]);
    chartIds.splice(idx2, 1);
    chartIds.splice(Math.min(idx1, idx2), 0, rowId);
  }

  rootChildren.push(...chartIds);

  // Root column
  components.push({
    id: 'root',
    componentType: 'Column',
    props: { gap: 24 },
    children: rootChildren,
  });

  // Generate summary message
  const message = `Here's your results dashboard with ${responses.length} response${responses.length !== 1 ? 's' : ''} across ${answerableElements.length} question${answerableElements.length !== 1 ? 's' : ''}. Ask me to drill into any specific question or trend.`;

  return { components, message };
}
