import { z } from "zod";
import { supportLanguages } from "@/config/languages";

export const goals = ["job_interview", "workplace", "university", "daily_conversation"] as const;
export const englishLevels = ["beginner", "a2", "b1"] as const;
export const dailyGoalMinutes = [5, 10, 15] as const;

export type Goal = (typeof goals)[number];
export type EnglishLevel = (typeof englishLevels)[number];
export type DailyGoalMinutes = (typeof dailyGoalMinutes)[number];

export const onboardingSchema = z.object({
  goal: z.enum(goals),
  englishLevel: z.enum(englishLevels),
  supportLanguage: z.string().refine((code) => supportLanguages.some((language) => language.code === code), {
    message: "Choose a support language",
  }),
  dailyGoalMinutes: z.union([z.literal(5), z.literal(10), z.literal(15)]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export type ProfileDTO = {
  goal: Goal | null;
  englishLevel: EnglishLevel | null;
  supportLanguage: string | null;
  dailyGoalMinutes: DailyGoalMinutes | null;
  onboardingCompleted: boolean;
};
