import { standardCatalog } from '@a2ui-sdk/react/0.8';
import type { Catalog } from '@a2ui-sdk/react/0.8';
import {
  SurveyBarChartComponent,
  SurveyPieChartComponent,
  SurveyHistogramComponent,
  SurveyStatGridComponent,
  SurveyTextListComponent,
} from '@/components/survey/results/a2ui-charts';

/**
 * Extended A2UI catalog with survey-specific chart components.
 *
 * Standard catalog components available:
 *   Text, Image, Icon, Video, Divider, Button,
 *   Row, Column, List, Card, Tabs, Modal,
 *   TextField, CheckBox, Slider, DateTimeInput, MultipleChoice
 *
 * Custom chart components:
 *   SurveyBarChart, SurveyPieChart, SurveyHistogram, SurveyStatGrid, SurveyTextList
 */
export const surveyCatalog: Catalog = {
  ...standardCatalog,
  components: {
    ...standardCatalog.components,
    SurveyBarChart: SurveyBarChartComponent,
    SurveyPieChart: SurveyPieChartComponent,
    SurveyHistogram: SurveyHistogramComponent,
    SurveyStatGrid: SurveyStatGridComponent,
    SurveyTextList: SurveyTextListComponent,
  },
};

/**
 * Component type names available for AI to use in A2UI specs.
 */
export const CUSTOM_CHART_TYPES = [
  'SurveyBarChart',
  'SurveyPieChart',
  'SurveyHistogram',
  'SurveyStatGrid',
  'SurveyTextList',
] as const;

export type CustomChartType = (typeof CUSTOM_CHART_TYPES)[number];
