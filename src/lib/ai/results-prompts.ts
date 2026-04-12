import type { SurveyElement, SurveyResponseData } from '@/types/survey';

/**
 * Aggregate response data into a summary the AI can reason about
 * without sending all raw responses (which could exceed context limits).
 */
function aggregateResponses(
  elements: SurveyElement[],
  responses: SurveyResponseData[]
): string {
  const lines: string[] = [];
  lines.push(`Total responses: ${responses.length}`);
  lines.push('');

  for (const el of elements) {
    if (['section_header', 'page_break', 'file_upload'].includes(el.type)) continue;

    lines.push(`--- ${el.title} (id: ${el.id}, type: ${el.type}) ---`);

    const values = responses
      .map((r) => r.answers[el.id])
      .filter((v) => v !== undefined && v !== null);

    if (values.length === 0) {
      lines.push('  No responses');
      lines.push('');
      continue;
    }

    if (el.type === 'multiple_choice' || el.type === 'dropdown') {
      const counts: Record<string, number> = {};
      for (const v of values) {
        const key = String(v);
        counts[key] = (counts[key] || 0) + 1;
      }
      for (const [opt, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
        lines.push(`  "${opt}": ${count} (${Math.round((count / values.length) * 100)}%)`);
      }
    } else if (el.type === 'checkboxes') {
      const counts: Record<string, number> = {};
      for (const v of values) {
        const arr = Array.isArray(v) ? v : [v];
        for (const item of arr) {
          const key = String(item);
          counts[key] = (counts[key] || 0) + 1;
        }
      }
      for (const [opt, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
        lines.push(`  "${opt}": ${count} (${Math.round((count / values.length) * 100)}%)`);
      }
    } else if (el.type === 'linear_scale') {
      const nums = values.map(Number).filter((n) => !isNaN(n));
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      const distribution: Record<number, number> = {};
      for (const n of nums) {
        distribution[n] = (distribution[n] || 0) + 1;
      }
      lines.push(`  Average: ${avg.toFixed(2)}`);
      lines.push(`  Distribution: ${JSON.stringify(distribution)}`);
    } else if (el.type === 'short_text' || el.type === 'long_text') {
      const textValues = values.map(String);
      lines.push(`  ${textValues.length} text responses`);
      // Show first 10 samples
      for (const t of textValues.slice(0, 10)) {
        lines.push(`  - "${t.slice(0, 200)}"`);
      }
      if (textValues.length > 10) {
        lines.push(`  ... and ${textValues.length - 10} more`);
      }
    } else if (el.type === 'date') {
      lines.push(`  ${values.length} date responses`);
      lines.push(`  Range: ${values[0]} to ${values[values.length - 1]}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build the system prompt for the results analysis AI.
 */
export function buildResultsSystemPrompt(
  elements: SurveyElement[],
  responses: SurveyResponseData[]
): string {
  const summary = aggregateResponses(elements, responses);

  return `You are a survey data analyst. Be direct — lead with insights, skip filler. 1-3 sentences max in your message.

## Data
${summary}

## A2UI Components
Each: { id: string, componentType: string, props: {}, children?: string[] }

Layout: Column { gap? }, Row { gap? }, Card { title? }
Display: Text { text, variant?: "h1"|"h2"|"body" }
Charts:
- SurveyBarChart { title, data: [{label, value}], color?, horizontal? }
- SurveyPieChart { title, data: [{label, value}], donut? }
- SurveyHistogram { title, data: [{label, count}], color? }
- SurveyStatGrid { title?, stats: [{label, value, trend?}] }
- SurveyTextList { title, items: [{text, count?, sentiment?}], showCount? }

## Chart Rules
- MC/Dropdown ≤5 options → PieChart (donut). 6+ → BarChart (horizontal, sorted desc).
- Checkboxes → BarChart (horizontal). Never pie for multi-select.
- Linear scale → Histogram (natural order) + StatGrid for mean.
- Text → TextList with sentiment. 10+ responses → add BarChart of themes.
- Date → Histogram (chronological).
- Binary (yes/no) → PieChart (donut), show % in title.

## Layout
- Root "Column" (id: "root") wraps everything.
- Start with SurveyStatGrid KPIs (responses, completion rate, key averages).
- Pair small charts in Rows. Full-width for complex charts.
- Categorical → sort desc. Ordinal → preserve natural order.
- Max 5 pie slices — group rest into "Other".
- Palette: #6366f1 #8b5cf6 #ec4899 #06b6d4 #22c55e #f97316

## Output
{ "message": "1-3 sentences of key insights", "components": [...] }`;
}
