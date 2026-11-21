import "server-only";
import { Modality, type Session } from "@google/genai";
import { GEMINI_LIVE_MODEL, getGeminiLive } from "@/server/ai/gemini";
import { getPrisma } from "@/server/db";

export type SpeakEvent =
  | { type: "status"; status: "active" | "ended" | "error" }
  | { type: "transcript"; speaker: "user" | "coach"; text: string; final: boolean }
  | { type: "coach_audio"; data: string };

type Room = {
  id: string;
  userId: string;
  session: Session;
  listeners: Set<(event: SpeakEvent) => void>;
};

const rooms = new Map<string, Room>();

function emit(room: Room, event: SpeakEvent) {
  for (const listener of room.listeners) listener(event);
}

const coachInstruction = [
  "You are Lisane's English speaking coach.",
  "The learner is practising spoken English.",
  "Reply in one to three short spoken sentences.",
  "Be warm and practical.",
  "If their English needs a fix, give one short correction, then continue the conversation.",
  "Stay in English.",
].join(" ");

export async function startSpeakSession(userId: string): Promise<{ id: string }> {
  const row = await getPrisma().speakSession.create({ data: { userId } });
  const room: Room = {
    id: row.id,
    userId,
    session: undefined as unknown as Session,
    listeners: new Set(),
  };

  let session: Session;
  try {
    session = await getGeminiLive().live.connect({
    model: GEMINI_LIVE_MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: coachInstruction,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      maxOutputTokens: 200,
    },
    callbacks: {
      onmessage: (message) => {
        const content = message.serverContent;
        if (!content) return;
        const heard = content.inputTranscription?.text?.trim();
        if (heard) {
          emit(room, {
            type: "transcript",
            speaker: "user",
            text: heard,
            final: Boolean(content.inputTranscription?.finished),
          });
        }
        const said = content.outputTranscription?.text?.trim();
        if (said) {
          emit(room, {
            type: "transcript",
            speaker: "coach",
            text: said,
            final: Boolean(content.outputTranscription?.finished),
          });
        }
        if (message.data) emit(room, { type: "coach_audio", data: message.data });
      },
      onerror: () => emit(room, { type: "status", status: "error" }),
      onclose: () => {
        emit(room, { type: "status", status: "ended" });
        rooms.delete(room.id);
      },
    },
  });
  } catch (error) {
    await getPrisma().speakSession.update({
      where: { id: row.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
    throw error;
  }

  room.session = session;
  rooms.set(room.id, room);
  return { id: room.id };
}

export function ownsSpeakSession(sessionId: string, userId: string): boolean {
  const room = rooms.get(sessionId);
  return room?.userId === userId;
}

export function subscribeSpeakSession(
  sessionId: string,
  userId: string,
  listener: (event: SpeakEvent) => void,
): (() => void) | null {
  const room = rooms.get(sessionId);
  if (!room || room.userId !== userId) return null;
  room.listeners.add(listener);
  listener({ type: "status", status: "active" });
  return () => room.listeners.delete(listener);
}

export function sendSpeakAudio(sessionId: string, userId: string, audioBase64: string): boolean {
  const room = rooms.get(sessionId);
  if (!room || room.userId !== userId) return false;
  room.session.sendRealtimeInput({
    audio: { data: audioBase64, mimeType: "audio/pcm;rate=16000" },
  });
  return true;
}

export async function stopSpeakSession(sessionId: string, userId: string): Promise<boolean> {
  const room = rooms.get(sessionId);
  if (!room || room.userId !== userId) return false;
  rooms.delete(room.id);
  room.session.close();
  emit(room, { type: "status", status: "ended" });
  await getPrisma().speakSession.update({
    where: { id: room.id },
    data: { status: "ENDED", endedAt: new Date() },
  });
  return true;
}
