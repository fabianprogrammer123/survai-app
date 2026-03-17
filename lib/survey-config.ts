/**
 * Survey configuration — greeting, system prompt, and UI copy.
 * These are passed as dynamic variables to the ElevenLabs agent at session start.
 */

export const SURVEY_CONFIG = {
  /** The agent's opening line. {name} is replaced with the participant's first name. */
  greeting: (name: string) =>
    `Hi ${name}, we're excited to welcome you to our party later. As a little experiment we'd like to try and help you get the most out of your time at Palohouse. What are you most interested in for the event?`,

  /** Brand name shown in the UI */
  brandName: "Voice Questionnaire",

  /** Welcome screen copy */
  welcome: {
    subtitle: "We'd love to hear your thoughts.",
    description: "A few quick questions — takes about 2 minutes.",
    privacyNote:
      "Your answers stay private and are only used to create a better experience for you at the event.",
  },

  /** Thank you screen copy */
  thankYou: {
    message: "Your thoughts have been recorded.",
    subtitle: "Thank you for taking the time to share your perspective.",
  },
}
