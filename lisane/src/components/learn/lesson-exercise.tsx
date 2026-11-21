"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useLessonRecording } from "./use-lesson-recording";
import { fontClassNames, getLanguage, isLanguageCode } from "@/config/languages";
import type { LessonAttempt, PublicExercise } from "@/lib/lesson";
import { cn } from "@/lib/cn";

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
  listenUnavailable,
  matchHint,
  matchMiss,
  typePlaceholder,
  transcribeUrl,
  onAttempt,
  onSolved,
}: {
  exercise: PublicExercise;
  supportLanguage: string;
  disabled: boolean;
  prompt: string;
  playLabel: string;
  listenUnavailable: string;
  matchHint: string;
  matchMiss: string;
  typePlaceholder: string;
  transcribeUrl: string;
  onAttempt: (attempt: LessonAttempt | null) => void;
  onSolved: (attempt: LessonAttempt) => void;
}) {
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
          <PlayButton label={playLabel} text={exercise.spoken} audioSrc={exercise.audioSrc} unavailable={listenUnavailable} />
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
          <PlayButton label={playLabel} text={exercise.spoken} audioSrc={exercise.audioSrc} unavailable={listenUnavailable} />
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
          transcribeUrl={transcribeUrl}
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

function PlayButton({ label, text, audioSrc, unavailable }: { label: string; text: string; audioSrc: string; unavailable: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [shown, setShown] = useState(false);

  async function play() {
    const player = audio.current;
    if (!player) return;
    if (player.error) player.load();
    try {
      player.currentTime = 0;
      await player.play();
      setShown(false);
    } catch {
      setShown(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <audio ref={audio} src={audioSrc} preload="none" onError={() => setShown(true)} />
      <button
        type="button"
        onClick={() => void play()}
        className="flex size-20 items-center justify-center self-start rounded-full bg-action text-on-action shadow-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
      >
        <span className="sr-only">{label}</span>
        <SpeakerIcon />
      </button>
      {shown ? (
        <div role="status">
          <p className="text-label text-fg-muted">{unavailable}</p>
          <p className="font-sans text-title font-semibold" lang="en">
            {text}
          </p>
        </div>
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
  onSolved: (attempt: LessonAttempt) => void;
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
    if (next.length === exercise.english.length) {
      onSolved({ exerciseId: exercise.id, pairs: next.map((id) => ({ englishId: id, meaningId: id })) });
    }
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
      aria-label={placeholder}
      placeholder={placeholder}
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
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
  transcribeUrl,
  placeholder,
  onAttempt,
}: {
  exercise: Extract<PublicExercise, { kind: "speak-sentence" }>;
  disabled: boolean;
  transcribeUrl: string;
  placeholder: string;
  onAttempt: (attempt: LessonAttempt | null) => void;
}) {
  const t = useTranslations("Learn");
  const [typing, setTyping] = useState(false);
  const { state, start, stop, retry } = useLessonRecording(transcribeUrl, exercise.id, publish);
  const { status } = state;
  const problem = status === "network" || status === "unclear" || status === "unavailable";
  const busy = status === "preparing" || status === "sending";

  function publish(text: string) {
    onAttempt(text ? { exerciseId: exercise.id, text } : null);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-sans text-title font-semibold" lang="en">
        {exercise.prompt}
      </p>
      {typing ? (
        <AnswerField placeholder={placeholder} disabled={disabled} onChange={publish} />
      ) : (
        <>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => status === "recording" ? stop() : void start()}
            className="min-h-14 rounded-full bg-action px-6 font-semibold text-on-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-60"
          >
            {status === "recording" ? t("speakStop") : t("speakStart")}
          </button>
          <div role="status" className="text-label text-fg-muted empty:hidden">
            {status === "preparing" ? t("speakPreparing") : null}
            {status === "recording" ? t("speakListening") : null}
            {status === "sending" ? t("speakChecking") : null}
            {status === "network" ? t("speakCouldNotCheck") : null}
            {status === "unclear" ? t("speakUnclear") : null}
            {status === "unavailable" ? t("speakUnavailable") : null}
            {status === "heard" ? <p lang="en" className="font-sans text-body">{state.transcript}</p> : null}
          </div>
          {status === "network" ? (
            <button type="button" onClick={retry} className="min-h-11 self-start font-semibold underline">
              {t("speakRetry")}
            </button>
          ) : null}
          {problem ? (
            <button type="button" onClick={() => setTyping(true)} className="min-h-11 self-start font-semibold underline">
              {t("speakTypeInstead")}
            </button>
          ) : null}
        </>
      )}
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
