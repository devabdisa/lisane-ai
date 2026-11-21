"use client";

import { useEffect, useRef, useState } from "react";
import { lessonRecordingMaxBytes, lessonRecordingSeconds, lessonTranscriptSchema } from "@/schemas/lesson-speech";

type Recording = { id: string; data: ArrayBuffer };
type RecordingState =
  | { status: "idle" | "preparing" | "recording" | "sending" | "unavailable" | "unclear" | "network" }
  | { status: "heard"; transcript: string };

async function openMicrophone(signal: AbortSignal, onAudio: (buffer: ArrayBuffer) => void) {
  const context = new AudioContext();
  let stream: MediaStream | undefined;
  let worklet: AudioWorkletNode | undefined;

  function close() {
    if (worklet) {
      worklet.port.onmessage = null;
      worklet.port.close();
    }
    stream?.getTracks().forEach((track) => track.stop());
    if (context.state !== "closed") void context.close().catch(() => undefined);
  }

  const resume = context.resume();
  void resume.catch(() => undefined);
  try {
    signal.addEventListener("abort", close, { once: true });
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    signal.throwIfAborted();
    await resume;
    await context.audioWorklet.addModule("/worklets/lisane-mic-processor.js");
    signal.throwIfAborted();
    const source = context.createMediaStreamSource(stream);
    worklet = new AudioWorkletNode(context, "lisane-mic-processor");
    const sink = context.createGain();
    sink.gain.value = 0;
    worklet.connect(sink).connect(context.destination);
    worklet.port.onmessage = ({ data }) => {
      if (data?.type === "audio" && data.pcmBuffer instanceof ArrayBuffer) onAudio(data.pcmBuffer);
    };
    source.connect(worklet);
    return close;
  } catch (error) {
    close();
    throw error;
  } finally {
    signal.removeEventListener("abort", close);
  }
}

export function useLessonRecording(url: string, exerciseId: string, onTranscript: (text: string) => void) {
  const [state, setState] = useState<RecordingState>({ status: "idle" });
  const active = useRef<{ cancel: () => void; stop?: () => void } | null>(null);
  const recorded = useRef<Recording | null>(null);

  useEffect(() => () => {
    const task = active.current;
    active.current = null;
    task?.cancel();
  }, []);

  async function send(recording: Recording) {
    if (active.current) return;
    const controller = new AbortController();
    const task = { cancel: () => controller.abort() };
    const timer = window.setTimeout(task.cancel, 24_000);
    active.current = task;
    setState({ status: "sending" });
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-client-request-id": recording.id,
          "x-exercise-id": exerciseId,
        },
        body: recording.data,
        signal: controller.signal,
      });
      if (active.current !== task) return;
      if (response.status === 422) {
        recorded.current = null;
        setState({ status: "unclear" });
        return;
      }
      if (!response.ok) throw new Error("Lesson recording failed");
      const { transcript } = lessonTranscriptSchema.parse(await response.json());
      if (active.current !== task || controller.signal.aborted) return;
      recorded.current = null;
      setState({ status: "heard", transcript });
      onTranscript(transcript);
    } catch {
      if (active.current === task) setState({ status: "network" });
    } finally {
      window.clearTimeout(timer);
      if (active.current === task) active.current = null;
    }
  }

  async function start() {
    if (active.current) return;
    recorded.current = null;
    onTranscript("");
    setState({ status: "preparing" });
    const controller = new AbortController();
    const preparing = { cancel: () => controller.abort() };
    active.current = preparing;
    const data = new ArrayBuffer(lessonRecordingMaxBytes);
    const pcm = new Uint8Array(data);
    let bytes = 0;
    try {
      const close = await openMicrophone(controller.signal, (buffer) => {
        const chunk = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, pcm.length - bytes));
        pcm.set(chunk, bytes);
        bytes += chunk.byteLength;
      });
      if (controller.signal.aborted) {
        close();
        return;
      }
      const timer = window.setTimeout(stop, lessonRecordingSeconds * 1_000);
      function cancel() {
        window.clearTimeout(timer);
        close();
      }
      function stop() {
        cancel();
        active.current = null;
        if (!bytes) {
          setState({ status: "unclear" });
          return;
        }
        const recording = { id: crypto.randomUUID(), data: data.slice(0, bytes) };
        recorded.current = recording;
        void send(recording);
      }
      active.current = { cancel, stop };
      setState({ status: "recording" });
    } catch {
      if (controller.signal.aborted) return;
      active.current = null;
      setState({ status: "unavailable" });
    }
  }

  return {
    state,
    start,
    stop: () => active.current?.stop?.(),
    retry: () => { if (recorded.current) void send(recorded.current); },
  };
}
