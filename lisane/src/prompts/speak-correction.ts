export function speakCorrectionPrompt(learnerText: string, conversationContext?: string[]): string {
  const context =
    conversationContext && conversationContext.length > 0
      ? [
          "Recent coach messages for context (most recent last):",
          ...conversationContext.map((message, index) => `  ${index + 1}. ${JSON.stringify(message)}`),
          "Use this context to judge whether the learner's reply fits. A short reply like 'Yes' or 'Thank you' is correct if it naturally answers the coach.",
        ]
      : [];

  return [
    "You judge one spoken English sentence from a learner.",
    "Find the single most useful fix: grammar, word choice, or phrasing.",
    "If the sentence is already clear and natural, set hasCorrection to false and leave the other strings empty.",
    "Do not invent a mistake. Do not judge pronunciation. Do not write any language other than English.",
    "original is the learner's sentence. corrected is the natural English version.",
    "reason is one short, kind sentence about the fix. tip is one short sentence about what to do next time.",
    "type is GRAMMAR, VOCABULARY, or PHRASING.",
    "Return JSON only, with keys hasCorrection, original, corrected, type, reason, tip.",
    ...context,
    `Learner: ${JSON.stringify(learnerText)}`,
  ].join("\n");
}
