import "server-only";
import {
  dailyGoalMinutes,
  englishLevels,
  goals,
  type OnboardingInput,
  type ProfileDTO,
} from "@/schemas/profile";
import { getPrisma } from "@/server/db";

function asProfile(row: {
  goal: string | null;
  englishLevel: string | null;
  supportLanguage: string | null;
  dailyGoalMinutes: number | null;
  onboardingCompleted: boolean;
}): ProfileDTO {
  return {
    goal: goals.find((goal) => goal === row.goal) ?? null,
    englishLevel: englishLevels.find((level) => level === row.englishLevel) ?? null,
    supportLanguage: row.supportLanguage,
    dailyGoalMinutes: dailyGoalMinutes.find((minutes) => minutes === row.dailyGoalMinutes) ?? null,
    onboardingCompleted: row.onboardingCompleted,
  };
}

export async function getProfile(userId: string): Promise<ProfileDTO | null> {
  const row = await getPrisma().userProfile.findUnique({ where: { userId } });
  return row ? asProfile(row) : null;
}

export async function completeOnboarding(userId: string, input: OnboardingInput): Promise<ProfileDTO> {
  const row = await getPrisma().userProfile.upsert({
    where: { userId },
    create: {
      userId,
      goal: input.goal,
      englishLevel: input.englishLevel,
      supportLanguage: input.supportLanguage,
      dailyGoalMinutes: input.dailyGoalMinutes,
      onboardingCompleted: true,
    },
    update: {
      goal: input.goal,
      englishLevel: input.englishLevel,
      supportLanguage: input.supportLanguage,
      dailyGoalMinutes: input.dailyGoalMinutes,
      onboardingCompleted: true,
    },
  });
  return asProfile(row);
}
