"use client";

import { useEffect, useState } from "react";
import { fontClassNames, getLanguage, isLanguageCode } from "@/config/languages";
import type { LessonAttempt, PublicExercise } from "@/lib/lesson";
import { cn } from "@/lib/cn";

type RecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

function recognitionCtor() {
  const host = window as Window & {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function speakEnglish(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}

function supportFont(language: string) {
  if (!isLanguageCode(language)) return "font-sans";
  return fontClassNames[getLanguage(language).font];
}

function LessonExercise({
  exercise,
  supportLanguage,
  disabled,
  prompt,
  playLabel,
  matchHint,
  matchMiss,
  typePlaceholder,
  speakStart,
  speakListening,
  speakUnavailable,
  onAttempt,
  onSolved,
}: {
  exercise: PublicExercise;
  supportLanguage: string;
  disabled: boolean;
  prompt: string;
  playLabel: string;
  matchHint: string;
  matchMiss: string;
  typePlaceholder: string;
  speakStart: string;
  speakListening: string;
  speakUnavailable: string;
  onAttempt: (attempt: LessonAttempt | null) => void;
  onSolved: () => void;
}) {
  const spoken = exercise.kind === "listen-and-pick" || exercise.kind === "type-what-you-hear" ? exercise.spoken : null;

  useEffect(() => {
    if (!spoken) return;
    speakEnglish(spoken);
    return () => window.speechSynthesis?.cancel();
  }, [exercise.id, spoken]);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-label font-semibold text-fg-muted">{prompt}</p>
      {exercise.kind === "select-meaning" ? (
        <>
          <p className="font-sans text-title font-semibold" lang="en">
            {exercise.prompt}
          </p>
          <Choices
            label={prompt}
            choices={exercise.choices}
            language={supportLanguage}
            disabled={disabled}
            onSelect={(choiceId) => onAttempt({ exerciseId: exercise.id, choiceId })}
          />
        </>
      ) : null}
      {exercise.kind === "listen-and-pick" ? (
        <>
          <PlayButton label={playLabel} fallback={exercise.spoken} onPlay={() => speakEnglish(exercise.spoken)} />
          <Choices
            label={prompt}
            choices={exercise.choices}
            language={supportLanguage}
            disabled={disabled}
            onSelect={(choiceId) => onAttempt({ exerciseId: exercise.id, choiceId })}
          />
        </>
      ) : null}
      {exercise.kind === "match-pairs" ? (
        <MatchPairs
          exercise={exercise}
          supportLanguage={supportLanguage}
          disabled={disabled}
          hint={matchHint}
          miss={matchMiss}
          onSolved={onSolved}
        />
      ) : null}
      {exercise.kind === "word-bank-translate" ? (
        <WordBank
          exercise={exercise}
          supportLanguage={supportLanguage}
          disabled={disabled}
          onAttempt={onAttempt}
        />
      ) : null}
      {exercise.kind === "fill-blank" ? (
        <FillBlank
          exercise={exercise}
          supportLanguage={supportLanguage}
          disabled={disabled}
          onAttempt={onAttempt}
        />
      ) : null}
      {exercise.kind === "type-what-you-hear" ? (
        <>
          <PlayButton label={playLabel} onPlay={() => speakEnglish(exercise.spoken)} />
          <AnswerField
            placeholder={typePlaceholder}
            disabled={disabled}
            onChange={(text) => onAttempt(text ? { exerciseId: exercise.id, text } : null)}
          />
        </>
      ) : null}
      {exercise.kind === "speak-sentence" ? (
        <SpeakSentence
          exercise={exercise}
          disabled={disabled}
          startLabel={speakStart}
          listeningLabel={speakListening}
          unavailable={speakUnavailable}
          placeholder={typePlaceholder}
          onAttempt={onAttempt}
        />
      ) : null}
    </div>
  );
}

function Choices({
  label,
  choices,
  language,
  disabled,
  onSelect,
}: {
  label: string;
  choices: { id: string; label: string }[];
  language: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-3">
      {choices.map((choice) => {
        const active = selected === choice.id;
        return (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            lang={language}
            onClick={() => {
              setSelected(choice.id);
              onSelect(choice.id);
            }}
            className={cn(
              "min-h-14 rounded-16 border-2 px-4 py-3 text-left text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-80",
              supportFont(language),
              active ? "border-action bg-field" : "border-line bg-card",
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

function PlayButton({ label, onPlay, fallback }: { label: string; onPlay: () => void; fallback?: string }) {
  const [shown, setShown] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => {
          if (!window.speechSynthesis && fallback) {
            setShown(fallback);
            return;
          }
          onPlay();
        }}
        className="flex size-20 items-center justify-center self-start rounded-full bg-action text-on-action shadow-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
      >
        <span className="sr-only">{label}</span>
        <SpeakerIcon />
      </button>
      {shown ? (
        <p className="font-sans text-title font-semibold" lang="en">
          {shown}
        </p>
      ) : null}
    </div>
  );
}

function MatchPairs({
  exercise,
  supportLanguage,
  disabled,
  hint,
  miss,
  onSolved,
}: {
  exercise: Extract<PublicExercise, { kind: "match-pairs" }>;
  supportLanguage: string;
  disabled: boolean;
  hint: string;
  miss: string;
  onSolved: () => void;
}) {
  const [leftId, setLeftId] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [missed, setMissed] = useState(false);

  function chooseRight(id: string) {
    if (!leftId || disabled || matched.includes(id)) return;
    if (leftId !== id) {
      setLeftId(null);
      setMissed(true);
      return;
    }
    const next = [...matched, id];
    setMatched(next);
    setLeftId(null);
    setMissed(false);
    if (next.length === exercise.english.length) onSolved();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="sr-only">{hint}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {exercise.english.map((item) => (
            <PairButton
              key={item.id}
              label={item.label}
              language="en"
              pressed={leftId === item.id}
              done={matched.includes(item.id)}
              disabled={disabled || matched.includes(item.id)}
              onClick={() => {
                setMissed(false);
                setLeftId(item.id);
              }}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {exercise.meanings.map((item) => (
            <PairButton
              key={item.id}
              label={item.label}
              language={supportLanguage}
              pressed={false}
              done={matched.includes(item.id)}
              disabled={disabled || matched.includes(item.id) || !leftId}
              onClick={() => chooseRight(item.id)}
            />
          ))}
        </div>
      </div>
      <p className="min-h-6 text-label text-fg-muted" role="status">
        {missed ? miss : null}
      </p>
    </div>
  );
}

function PairButton({
  label,
  language,
  pressed,
  done,
  disabled,
  onClick,
}: {
  label: string;
  language: string;
  pressed: boolean;
  done: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      lang={language}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-16 rounded-12 border-2 px-3 py-2 text-left text-label font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg",
        language === "en" ? "font-sans" : supportFont(language),
        done && "border-action bg-field",
        pressed && "border-action bg-card",
        !done && !pressed && "border-line bg-card",
      )}
    >
      {label}
    </button>
  );
}

function WordBank({
  exercise,
  supportLanguage,
  disabled,
  onAttempt,
}: {
  exercise: Extract<PublicExercise, { kind: "word-bank-translate" }>;
  supportLanguage: string;
  disabled: boolean;
  onAttempt: (attempt: LessonAttempt | null) => void;
}) {
  const tileLanguage = exercise.direction === "support-to-english" ? "en" : supportLanguage;
  const [bank, setBank] = useState(() => exercise.tiles.map((label, index) => ({ index, label })));
  const [picked, setPicked] = useState<{ index: number; label: string }[]>([]);

  function publish(next: { index: number; label: string }[]) {
    onAttempt(next.length ? { exerciseId: exercise.id, tiles: next.map((tile) => tile.label) } : null);
  }

  return (
    <div className="flex flex-col gap-4">
      <p lang={exercise.direction === "support-to-english" ? supportLanguage : "en"} className={cn("text-title font-semibold", exercise.direction === "support-to-english" ? supportFont(supportLanguage) : "font-sans")}>
        {exercise.prompt}
      </p>
      <div className="flex min-h-16 flex-wrap gap-2 rounded-16 border-2 border-dashed border-line p-3">
        {picked.map((tile) => (
          <Tile
            key={tile.index}
            label={tile.label}
            language={tileLanguage}
            disabled={disabled}
            onClick={() => {
              const next = picked.filter((item) => item.index !== tile.index);
              setPicked(next);
              setBank((items) => [...items, tile]);
              publish(next);
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {bank.map((tile) => (
          <Tile
            key={tile.index}
            label={tile.label}
            language={tileLanguage}
            disabled={disabled}
            onClick={() => {
              const next = [...picked, tile];
              setPicked(next);
              setBank((items) => items.filter((item) => item.index !== tile.index));
              publish(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Tile({ label, language, disabled, onClick }: { label: string; language: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      lang={language}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-12 border-2 border-line bg-card px-3 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg",
        language === "en" ? "font-sans" : supportFont(language),
      )}
    >
      {label}
    </button>
  );
}

function FillBlank({
  exercise,
  supportLanguage,
  disabled,
  onAttempt,
}: {
  exercise: Extract<PublicExercise, { kind: "fill-blank" }>;
  supportLanguage: string;
  disabled: boolean;
  onAttempt: (attempt: LessonAttempt | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <p lang={supportLanguage} className={cn("text-body text-fg-muted", supportFont(supportLanguage))}>
        {exercise.hint}
      </p>
      <p className="font-sans text-title font-semibold" lang="en">
        {exercise.before}
        <span className="mx-1 inline-block min-w-16 border-b-2 border-action text-center">{selected}</span>
        {exercise.after}
      </p>
      <div role="radiogroup" aria-label={exercise.hint} className="flex flex-wrap gap-2">
        {exercise.choices.map((choice) => {
          const active = selected === choice;
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={active}
              lang="en"
              disabled={disabled}
              onClick={() => {
                setSelected(choice);
                onAttempt({ exerciseId: exercise.id, text: choice });
              }}
              className={cn(
                "min-h-12 rounded-12 border-2 px-4 font-sans text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg",
                active ? "border-action bg-field" : "border-line bg-card",
              )}
            >
              {choice}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AnswerField({
  placeholder,
  disabled,
  onChange,
}: {
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <input
      value={value}
      lang="en"
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => {
        setValue(event.target.value);
        onChange(event.target.value.trim());
      }}
      className="min-h-14 rounded-16 border-2 border-line bg-field px-4 font-sans text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
    />
  );
}

function SpeakSentence({
  exercise,
  disabled,
  startLabel,
  listeningLabel,
  unavailable,
  placeholder,
  onAttempt,
}: {
  exercise: Extract<PublicExercise, { kind: "speak-sentence" }>;
  disabled: boolean;
  startLabel: string;
  listeningLabel: string;
  unavailable: string;
  placeholder: string;
  onAttempt: (attempt: LessonAttempt | null) => void;
}) {
  const [listening, setListening] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [heard, setHeard] = useState("");

  function listen() {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setFallback(true);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setHeard(transcript);
      setListening(false);
      onAttempt(transcript.trim() ? { exerciseId: exercise.id, text: transcript } : null);
    };
    recognition.onerror = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-sans text-title font-semibold" lang="en">
        {exercise.prompt}
      </p>
      <button
        type="button"
        disabled={disabled || listening}
        onClick={listen}
        className="min-h-14 rounded-full bg-action px-6 font-semibold text-on-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-60"
      >
        {listening ? listeningLabel : startLabel}
      </button>
      {heard ? (
        <p className="font-sans text-body text-fg-muted" lang="en">
          {heard}
        </p>
      ) : null}
      {fallback ? (
        <>
          <p className="text-label text-fg-muted">{unavailable}</p>
          <AnswerField
            placeholder={placeholder}
            disabled={disabled}
            onChange={(text) => onAttempt(text ? { exerciseId: exercise.id, text } : null)}
          />
        </>
      ) : null}
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 10v4h4l5 4V6L8 10H4Z" strokeLinejoin="round" />
      <path d="M16 9a4 4 0 0 1 0 6" strokeLinecap="round" />
      <path d="M18.5 7a7 7 0 0 1 0 10" strokeLinecap="round" />
    </svg>
  );
}

export { LessonExercise };
