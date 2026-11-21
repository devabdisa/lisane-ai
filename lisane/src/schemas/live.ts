import { z } from "zod";
import { speakScenarios } from "@/config/scenarios";
import { speakCorrectionTypes } from "./speak-correction";

export const DEFAULT_LIVE_AUDIO_INPUT_MIME_TYPE = "audio/pcm;rate=16000";

const scenarioIds = speakScenarios.map((scenario) => scenario.id) as [
  (typeof speakScenarios)[number]["id"],
  ...(typeof speakScenarios)[number]["id"][],
];

export const liveConnectionStatusSchema = z.enum(["CONNECTING", "ACTIVE", "RECONNECTING", "ENDED", "ERROR"]);

export const liveTurnModeSchema = z.enum(["auto", "manual"]);

export const startLiveSessionInputSchema = z.object({
  scenario: z.enum(scenarioIds).optional(),
  customIdea: z.string().trim().min(1).max(200).optional(),
  turnMode: liveTurnModeSchema.optional().default("auto"),
});

export const startLiveSessionResponseSchema = z.object({
  id: z.string(),
  speakSessionId: z.string(),
  scenario: z.string().nullable(),
  customIdea: z.string().nullable(),
  supportLanguage: z.string(),
  turnMode: liveTurnModeSchema,
  model: z.string().min(1),
  status: liveConnectionStatusSchema,
  expiresAt: z.string(),
});

export const sendLiveAudioInputSchema = z
  .object({
    audioBase64: z.string().min(1).optional(),
    audioMimeType: z.string().min(1).optional(),
    audioStreamEnd: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.audioStreamEnd && !value.audioBase64) {
      ctx.addIssue({
        code: "custom",
        message: "audioBase64 is required unless audioStreamEnd is true",
      });
    }
  });

export const liveActivityInputSchema = z.object({
  type: z.enum(["start", "end"]),
});

export const liveCorrectionSchema = z.object({
  id: z.string(),
  original: z.string(),
  corrected: z.string(),
  correctionType: z.enum(speakCorrectionTypes),
  explanation: z.string(),
  supportLanguage: z.string(),
});

const liveStatusEventSchema = z.object({
  type: z.literal("status"),
  status: liveConnectionStatusSchema,
  reason: z.string().optional(),
});

const liveTranscriptEventSchema = z.object({
  type: z.literal("transcript"),
  speaker: z.enum(["USER", "AI"]),
  text: z.string(),
  final: z.boolean(),
  turnId: z.string().optional(),
  source: z.enum(["user_transcription", "output_transcription", "assistant_text"]).optional(),
  warning: z.string().optional(),
});

const liveAssistantAudioEventSchema = z.object({
  type: z.literal("assistant_audio"),
  mimeType: z.string().min(1),
  data: z.string().min(1),
});

const liveAssistantTextEventSchema = z.object({
  type: z.literal("assistant_text"),
  text: z.string().min(1),
});

const liveAssistantTurnCompleteEventSchema = z.object({
  type: z.literal("assistant_turn_complete"),
});

const liveTranscriptSkippedEventSchema = z.object({
  type: z.literal("transcript_skipped"),
  reason: z.enum(["not_english"]),
});

const liveGoAwayEventSchema = z.object({
  type: z.literal("go_away"),
  timeLeft: z.string().nullable(),
});

const liveSessionMetaEventSchema = z.object({
  type: z.literal("session"),
  id: z.string(),
  speakSessionId: z.string(),
  scenario: z.string().nullable(),
  customIdea: z.string().nullable(),
  supportLanguage: z.string(),
  turnMode: liveTurnModeSchema,
  model: z.string().min(1),
});

const liveCorrectionEventSchema = z.object({
  type: z.literal("correction"),
  turnId: z.string().optional(),
  correction: liveCorrectionSchema,
});

export const liveRelayEventSchema = z.discriminatedUnion("type", [
  liveStatusEventSchema,
  liveTranscriptEventSchema,
  liveAssistantAudioEventSchema,
  liveAssistantTextEventSchema,
  liveAssistantTurnCompleteEventSchema,
  liveTranscriptSkippedEventSchema,
  liveGoAwayEventSchema,
  liveSessionMetaEventSchema,
  liveCorrectionEventSchema,
]);

export type LiveConnectionStatus = z.infer<typeof liveConnectionStatusSchema>;
export type LiveTurnMode = z.infer<typeof liveTurnModeSchema>;
export type StartLiveSessionInput = z.infer<typeof startLiveSessionInputSchema>;
export type StartLiveSessionResponse = z.infer<typeof startLiveSessionResponseSchema>;
export type SendLiveAudioInput = z.infer<typeof sendLiveAudioInputSchema>;
export type LiveActivityInput = z.infer<typeof liveActivityInputSchema>;
export type LiveCorrection = z.infer<typeof liveCorrectionSchema>;
export type LiveRelayEvent = z.infer<typeof liveRelayEventSchema>;
