export const speakScenarios = [
  {
    id: "self_introduction",
    instruction:
      "Guide the learner to introduce themselves clearly. Ask one thing at a time, such as their name, what they do, and what they want.",
  },
  {
    id: "job_interview",
    instruction:
      "Guide a kind job-interview practice. Ask one interview question at a time and help them answer in natural English.",
  },
  {
    id: "workplace",
    instruction: "Guide a conversation at work, such as talking to a colleague or a manager. Keep it practical.",
  },
  {
    id: "university",
    instruction: "Guide a university conversation, such as a class, an assignment, or a teacher. Keep it practical.",
  },
] as const;

export type SpeakScenarioId = (typeof speakScenarios)[number]["id"];

export function scenarioInstruction(id: string): string | null {
  return speakScenarios.find((scenario) => scenario.id === id)?.instruction ?? null;
}

export function customSituationInstruction(idea: string): string {
  return `The learner wants to practise this situation: ${JSON.stringify(idea)}. Stay inside that situation. Ask one question at a time.`;
}
