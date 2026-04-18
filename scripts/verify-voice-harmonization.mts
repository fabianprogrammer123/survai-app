// Smoke test: build agent config from a survey using every new element type,
// then simulate the ElevenLabs webhook data_collection_results coming back and
// verify `dataCollectionToAnswers` reconstructs answers in the expected shapes.
//
// Run: npx tsx scripts/verify-voice-harmonization.mts
import { buildAgentConfig, dataCollectionToAnswers } from '../src/lib/elevenlabs/agent-builder.ts';
import type { Survey } from '../src/types/survey.ts';

const survey: Survey = {
  id: 'test-survey',
  title: 'Voice Harmonization Smoke',
  description: 'Tests every new element type end-to-end',
  elements: [
    { id: 'el_nps001', type: 'nps', title: 'How likely to recommend?', required: true, minLabel: 'Not likely', maxLabel: 'Very likely' },
    { id: 'el_sld001', type: 'slider', title: 'How many hours a week?', required: false, min: 0, max: 40, step: 1, unit: 'h' },
    { id: 'el_mxs001', type: 'matrix_single', title: 'Rate aspects', required: true, rows: ['Taste', 'Price', 'Service'], columns: ['Bad', 'OK', 'Good'] },
    { id: 'el_mxm001', type: 'matrix_multi', title: 'Which apply to each?', required: false, rows: ['Morning', 'Evening'], columns: ['Coffee', 'Tea', 'Water'] },
    { id: 'el_lik001', type: 'likert', title: 'How strongly do you agree?', required: true, rows: ['Product is easy', 'Support is responsive'], scale: 5 },
    { id: 'el_rnk001', type: 'ranking', title: 'Rank these features', required: true, items: ['Speed', 'Design', 'Price'] },
    { id: 'el_img001', type: 'image_choice', title: 'Pick your favorite', required: true, options: [{ label: 'Blue' }, { label: 'Red' }, { label: 'Green' }], multiSelect: false },
    { id: 'el_imgm001', type: 'image_choice', title: 'Pick any', required: false, options: [{ label: 'Cat' }, { label: 'Dog' }, { label: 'Bird' }], multiSelect: true },
  ],
  settings: { theme: 'default', showProgressBar: true, shuffleQuestions: false, confirmationMessage: 'Thanks!' },
};

const cfg = buildAgentConfig(survey);
const fields = cfg.platform_settings!.data_collection!;
console.log('=== DATA COLLECTION FIELDS ===');
for (const [k, v] of Object.entries(fields)) {
  console.log(`  ${k}  [${v.type}]  ${v.description.slice(0, 90)}`);
}

console.log('\n=== SYSTEM PROMPT (first 1200 chars) ===');
console.log(cfg.conversation_config.agent.prompt.prompt.slice(0, 1200));

// Simulate ElevenLabs returning data collection results.
const webhookResults = {
  el_nps001: { value: 8 },
  el_sld001: { value: 12 },
  el_mxs001__row0: { value: 'Good' },
  el_mxs001__row1: { value: 'OK' },
  el_mxs001__row2: { value: 'Good' },
  el_mxm001__row0: { value: 'Coffee, Water' },
  el_mxm001__row1: { value: 'Tea' },
  el_lik001__row0: { value: 4 },
  el_lik001__row1: { value: 5 },
  el_rnk001: { value: 'Design, Speed, Price' },
  el_img001: { value: 'Blue' },
  el_imgm001: { value: 'Cat, Dog' },
  respondent_name: { value: 'Test User' },
  survey_completed: { value: true },
};

const answers = dataCollectionToAnswers(webhookResults);
console.log('\n=== RECONSTRUCTED ANSWERS ===');
console.log(JSON.stringify(answers, null, 2));

// Assertions — surface any regression explicitly.
const expected: Array<[string, unknown]> = [
  ['el_nps001', 8],
  ['el_sld001', 12],
  ['el_mxs001', ['Good', 'OK', 'Good']],
  ['el_mxm001', [['Coffee', 'Water'], 'Tea']],
  ['el_lik001', [4, 5]],
  ['el_rnk001', ['Design', 'Speed', 'Price']],
  ['el_img001', 'Blue'],
  ['el_imgm001', ['Cat', 'Dog']],
];

console.log('\n=== ASSERTIONS ===');
let failed = 0;
for (const [k, want] of expected) {
  const got = (answers as Record<string, unknown>)[k];
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${k}  got=${JSON.stringify(got)}  want=${JSON.stringify(want)}`);
  if (!ok) failed++;
}
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
