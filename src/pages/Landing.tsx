import {
  ArrowRight,
  BookOpen,
  Brain,
  Compass,
  Download,
  GraduationCap,
  Hammer,
  Lightbulb,
  MessageSquareCode,
  Settings,
  Smartphone,
  Sparkles,
  Trash2,
  Trophy,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LEVELS, type Level } from '../../shared/levels.ts';
import { Logo } from '../components/Logo';
import { XPPill } from '../components/XP';
import { Badge, Button } from '../components/ui';
import { createLiveProject, createSampleProject, deleteProject, listProjects, type ProjectSummary } from '../lib/projects';
import { navigate } from '../lib/router';
import { isLiveAIAvailable, useLiveAI, useServerConfig, useSettings } from '../lib/settings';
import { useUI } from '../lib/uiState';
import { cn, timeAgo } from '../lib/utils';
import { SAMPLES } from '../samples';
import { STAGE_META } from '../components/StageStepper';

const IDEAS = [
  { label: 'Split hostel expenses', idea: 'An app for hostel roommates to split shared expenses like groceries, electricity and Wi-Fi, and see who owes whom.', sample: 'split-mate' },
  { label: 'Habit tracker with streaks', idea: 'A habit tracker for college students that helps them build daily habits like drinking water, reading and coding practice — with streaks to keep them motivated.', sample: 'habit-hero' },
  { label: 'Campus lost & found', idea: 'A campus lost-and-found board where students post items they lost or found, with categories, photos described in text and a way to mark items as returned.' },
  { label: 'Pomodoro study planner', idea: 'A study planner that lets students plan subjects for the week and run Pomodoro focus sessions, tracking total focus time per subject.' },
  { label: 'Placement prep tracker', idea: 'A placement preparation tracker where students log DSA problems solved by topic and difficulty, and see weak topics to revise.' },
];

const PIPELINE = [
  { id: 'understand', icon: Lightbulb, text: 'Restates your idea, maps users and an MVP, surfaces assumptions and asks the questions that change the design.' },
  { id: 'plan', icon: Compass, text: 'Tech stack with reasons, a screen-flow diagram, data model, file structure and a step-by-step build roadmap.' },
  { id: 'build', icon: Hammer, text: 'Streams a real React Native + Expo app and runs it instantly on a phone in your browser. Edit the code live.' },
  { id: 'explain', icon: BookOpen, text: 'A line-anchored walkthrough of every file, plus how data flows through the app when you tap a button.' },
  { id: 'learn', icon: GraduationCap, text: 'A personal path mapped to Lunor’s App Development roadmap: concepts, a code quiz and challenges to extend your app.' },
] as const;

const FEATURES = [
  { icon: Smartphone, title: 'Runs in your browser', text: 'Generated code runs on react-native-web in a sandboxed phone — with real icons, alerts and on-device storage.' },
  { icon: MessageSquareCode, title: 'A mentor that edits and explains', text: 'Ask “why?”, request a feature, or hit “Fix with AI” on a crash. See every change as a diff you can undo.' },
  { icon: Brain, title: 'See how the AI thinks', text: 'The AI’s reasoning streams live at every stage, so you learn how an engineer approaches the problem.' },
  { icon: Trophy, title: 'Learn by doing, with XP', text: 'Quizzes about your own code, graded challenges and XP — the same gamified spirit as Lunor’s roadmap.' },
  { icon: Download, title: 'Take it with you', text: 'Download a ready-to-run Expo project with a README and personal learning notes, or run it on your phone through Expo Snack.' },
  { icon: Zap, title: 'Grounded, not hallucinated', text: 'Structured outputs, a fixed runtime contract and a curated concept map keep plans, code and links reliable.' },
];

function useTypewriterPlaceholder() {
  const [text, setText] = useState('');
  useEffect(() => {
    let ideaIndex = 0;
    let char = 0;
    let deleting = false;
    const timer = setInterval(() => {
      const full = IDEAS[ideaIndex]!.idea;
      if (!deleting) {
        char = Math.min(full.length, char + 2);
        if (char === full.length) deleting = true;
      } else {
        char = Math.max(0, char - 6);
        if (char === 0) {
          deleting = false;
          ideaIndex = (ideaIndex + 1) % IDEAS.length;
        }
      }
      setText(full.slice(0, char));
    }, 45);
    return () => clearInterval(timer);
  }, []);
  return text;
}

function Composer() {
  const defaultLevel = useSettings((s) => s.defaultLevel);
  const [idea, setIdea] = useState('');
  const [level, setLevel] = useState<Level>(defaultLevel);
  const [notice, setNotice] = useState('');
  const [starting, setStarting] = useState(false);
  const live = useLiveAI();
  const openSettings = useUI((s) => s.openSettings);
  const placeholder = useTypewriterPlaceholder();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const matchedSample = IDEAS.find((i) => i.idea === idea.trim() && i.sample)?.sample;

  // Follow the default level if it changes in Settings.
  useEffect(() => setLevel(defaultLevel), [defaultLevel]);

  async function submit() {
    const text = idea.trim();
    if (text.length < 8) {
      setNotice('Describe your app idea in a sentence or two.');
      inputRef.current?.focus();
      return;
    }
    if (starting) return;
    // Don't decide "no live AI" before the server has said whether it has a key.
    if (!useServerConfig.getState().config) {
      setStarting(true);
      await useServerConfig.getState().load();
      setStarting(false);
    }
    if (!isLiveAIAvailable()) {
      if (matchedSample) {
        const id = createSampleProject(matchedSample);
        if (id) navigate(`/studio/${id}`);
        return;
      }
      setNotice('Live AI isn’t configured on this deployment. Add your Anthropic API key in Settings — or open an instant demo below.');
      return;
    }
    navigate(`/studio/${createLiveProject(text, level)}`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="group rounded-2xl border border-line bg-card/90 p-2 shadow-[0_30px_80px_-30px_rgba(237,44,44,0.35)] backdrop-blur transition-colors focus-within:border-brand/40">
        <textarea
          ref={inputRef}
          value={idea}
          onChange={(e) => {
            setIdea(e.target.value);
            setNotice('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={3}
          maxLength={1500}
          placeholder={placeholder || 'Describe the app you want to build…'}
          aria-label="Describe your app idea"
          className="w-full resize-none bg-transparent px-4 pt-3 text-[15px] leading-relaxed text-fg placeholder:text-subtle focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 px-2 pb-1">
          <div className="flex rounded-xl border border-line bg-bg p-0.5" role="radiogroup" aria-label="Your level">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={level === l}
                onClick={() => setLevel(l)}
                className={cn('rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors', level === l ? 'bg-elevated text-fg' : 'text-muted hover:text-soft')}
              >
                {l}
              </button>
            ))}
          </div>
          <span className="ml-auto hidden text-xs text-subtle sm:inline">Enter ↵ to start</span>
          <Button variant="primary" size="md" onClick={() => void submit()} loading={starting}>
            {matchedSample && !live.live && !live.loading ? 'Open instant demo' : 'Build with Lunor AI'} {!starting && <ArrowRight className="size-4" />}
          </Button>
        </div>
      </div>
      {notice && (
        <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-[#fcc56b]">
          {notice}
          {!live.live && !live.loading && (
            <button type="button" onClick={openSettings} className="underline underline-offset-2 hover:text-fg">
              Open Settings
            </button>
          )}
        </p>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {IDEAS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              setIdea(item.idea);
              setNotice('');
              inputRef.current?.focus();
            }}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            {item.label}
            {item.sample && <span className="ml-1.5 text-brand-2">· demo</span>}
          </button>
        ))}
      </div>
      <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted">
        <span className={cn('size-1.5 shrink-0 rounded-full', live.loading ? 'animate-pulse bg-subtle' : live.live ? 'bg-ok' : 'bg-warn')} />
        {live.loading
          ? 'Checking the AI connection…'
          : live.live
            ? `Live AI connected · ${live.via === 'mock' ? 'mock mode (sample replay)' : live.model}`
            : 'Instant demos available · add an Anthropic API key in Settings for live generation'}
      </p>
    </div>
  );
}

function RecentProjects() {
  const [projects, setProjects] = useState<ProjectSummary[]>(() => listProjects());
  if (projects.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20">
      <h2 className="mb-4 font-display text-xl font-semibold">Your projects</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.slice(0, 6).map((p) => (
          <div key={p.id} className="group relative rounded-card border border-line bg-card p-4 transition-colors hover:border-line-strong">
            <button type="button" onClick={() => navigate(`/studio/${p.id}`)} className="block w-full text-left">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-elevated text-xl">{p.emoji}</span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="text-xs text-muted">
                    {STAGE_META[p.stage].label} · {timeAgo(p.updatedAt)} {p.source === 'sample' && '· demo'}
                  </div>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted">{p.idea}</p>
            </button>
            <button
              type="button"
              aria-label={`Delete ${p.name}`}
              onClick={() => {
                if (!confirm(`Delete "${p.name}"?`)) return;
                deleteProject(p.id);
                setProjects(listProjects());
              }}
              className="absolute right-3 top-3 rounded-md p-1.5 text-subtle opacity-0 transition-opacity hover:bg-white/5 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Landing() {
  const openSettings = useUI((s) => s.openSettings);
  const samples = useMemo(() => SAMPLES, []);

  useEffect(() => {
    document.title = 'Lunor App Studio — Build apps. Understand every line.';
    // Arriving at /#demos (e.g. from "Try an instant demo"): jump straight to that section.
    // (getElementById, not querySelector: a hash like "#123" isn't a valid selector and would throw.)
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, []);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
            <Logo />
          </a>
          <nav className="ml-6 hidden items-center gap-5 text-sm text-muted md:flex">
            <a href="#how" className="hover:text-fg">How it works</a>
            <a href="#demos" className="hover:text-fg">Instant demos</a>
            <a href="https://lunor.online/domain/app-development" target="_blank" rel="noreferrer" className="hover:text-fg">
              App Dev roadmap ↗
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <XPPill />
            <Button variant="ghost" size="icon" onClick={openSettings} aria-label="Settings">
              <Settings className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 text-center sm:pt-24">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff9b8a]">
              <Sparkles className="size-3.5" /> App Development Studio
            </span>
            <h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Don’t just generate an app.
              <br />
              <span className="text-gradient">Understand every line.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              Describe an idea. Lunor AI understands it, plans the architecture, builds a real React Native app that runs right here — then explains the
              code and turns it into your personal learning path.
            </p>
          </motion.div>
          <motion.div className="mt-10" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <Composer />
          </motion.div>
        </div>
      </section>

      <section id="demos" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">Instant demos</h2>
            <p className="mt-1 text-sm text-muted">Walk the full pipeline in under a minute — generated by Claude and verified, no API key needed.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {samples.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => {
                const id = createSampleProject(sample.id);
                if (id) navigate(`/studio/${id}`);
              }}
              className="group relative overflow-hidden rounded-2xl border border-line bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-line-strong"
            >
              <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full opacity-20 blur-3xl" style={{ background: sample.accent }} />
              <div className="relative flex items-start gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-3xl" style={{ background: `${sample.accent}22`, boxShadow: `inset 0 0 0 1px ${sample.accent}55` }}>
                  {sample.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold">{sample.title}</h3>
                    <Badge tone={sample.level === 'beginner' ? 'ok' : sample.level === 'intermediate' ? 'info' : 'violet'} className="capitalize">
                      {sample.level}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{sample.description}</p>
                </div>
              </div>
              <p className="relative mt-4 border-l-2 border-line pl-3 text-sm italic text-soft">“{sample.idea}”</p>
              <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
                {sample.tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] text-muted">
                    {tag}
                  </span>
                ))}
                <span className="ml-auto flex items-center gap-1 text-sm font-medium text-brand-2 transition-transform group-hover:translate-x-0.5">
                  Open demo <ArrowRight className="size-4" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-20 border-y border-line bg-panel">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Think beyond <span className="text-muted line-through decoration-brand/60">prompt → app</span>
            </h2>
            <p className="mt-3 text-muted">
              Most AI builders hand you code you don’t understand. Lunor App Studio walks you through the way engineers actually work — and teaches you along the way.
            </p>
          </div>
          <div className="mt-12 grid gap-3 md:grid-cols-5">
            {PIPELINE.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="relative rounded-2xl border border-line bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-brand text-white">
                      <Icon className="size-4.5" />
                    </span>
                    <span className="font-mono text-xs text-subtle">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-display font-semibold">{STAGE_META[step.id].label}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{step.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-line bg-card p-5">
              <Icon className="size-5 text-brand-2" />
              <h3 className="mt-3 font-medium">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <RecentProjects />

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <span>Powered by Claude (Anthropic) and Gemini (Google) · React Native Web · Expo</span>
        </div>
      </footer>
    </div>
  );
}
