import { z } from "zod";

const id = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const lessonRecordingSeconds = 10;
export const lessonAudioSampleRate = 16_000;
export const lessonRecordingMaxBytes = lessonAudioSampleRate * 2 * lessonRecordingSeconds;

export const lessonSpeechRequestSchema = z.object({
  unitId: id,
  levelId: id,
  exerciseId: id,
  clientRequestId: z.uuid(),
});

export const lessonTranscriptSchema = z.object({ transcript: z.string().trim().max(400) });
