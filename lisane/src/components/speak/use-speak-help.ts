"use client";

import { useEffect, useRef, useState } from "react";
import { countAudiblePcm16Windows, MIN_AUDIBLE_WINDOWS } from "@/lib/voice-evidence";
import { SPEAK_HELP_MAX_PCM_BYTES, SPEAK_HELP_MAX_SECONDS, speakHelpResultSchema } from "@/schemas/speak-help";
import { bytesToBase64, mergeChunks } from "./voice-audio";

type HelpState = { status: "idle" | "recording" | "sending" | "quiet" | "error" } | { status: "ready"; english: string };
type Recording = { chunks: Uint8Array[]; bytes: number; timer: number };

export function useSpeakHelp() {
  const [state, setState] = useState<HelpState>({ status: "idle" });
  const recording = useRef<Recording | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (recording.current) window.clearTimeout(recording.current.timer);
      recording.current = null;
      request.current?.abort();
      request.current = null;
    };
  }, []);

  function cancel() {
    if (recording.current) window.clearTimeout(recording.current.timer);
    recording.current = null;
    request.current?.abort();
    request.current = null;
    setState({ status: "idle" });
  }

  async function finish() {
    const current = recording.current;
    if (!current) return;
    window.clearTimeout(current.timer);
    recording.current = null;

    const audio = mergeChunks(current.chunks);
    if (countAudiblePcm16Windows(audio) < MIN_AUDIBLE_WINDOWS) {
      setState({ status: "quiet" });
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setState({ status: "sending" });
    try {
      const response = await fetch("/api/speak/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: bytesToBase64(audio), clientRequestId: crypto.randomUUID() }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (response.status === 422) {
        setState({ status: "quiet" });
        return;
      }
      if (!response.ok) throw new Error("Support request failed");
      const result = speakHelpResultSchema.parse(await response.json());
      if (!controller.signal.aborted) setState({ status: "ready", english: result.english });
    } catch {
      if (!controller.signal.aborted) setState({ status: "error" });
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  function start() {
    if (recording.current || request.current) return;
    const timer = window.setTimeout(() => void finish(), SPEAK_HELP_MAX_SECONDS * 1000);
    recording.current = { chunks: [], bytes: 0, timer };
    setState({ status: "recording" });
  }

  function capture(bytes: Uint8Array) {
    if (request.current) return true;
    const current = recording.current;
    if (!current) return false;
    const frame = bytes.subarray(0, SPEAK_HELP_MAX_PCM_BYTES - current.bytes);
    current.chunks.push(frame);
    current.bytes += frame.length;
    if (current.bytes === SPEAK_HELP_MAX_PCM_BYTES) void finish();
    return true;
  }

  return { state, start, finish, cancel, capture, recording };
}
