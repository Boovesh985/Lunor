import { diffLines } from 'diff';
import { Bot, ChevronDown, FilePlus2, FileX2, PenLine, RotateCcw, Send, Square, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatIntent } from '../../shared/schemas.ts';
import type { ChatMessage, FileChange } from '../lib/projects';
import { useLiveAI } from '../lib/settings';
import { useMediaQuery } from '../lib/useMediaQuery';
import { cn } from '../lib/utils';
import { loadSampleDoc, type MentorQA } from '../samples';
import { useStudio } from '../store/studio';
import { fileIcon } from './FileTree';
import { Markdown } from './Markdown';
import { Badge, Button, Spinner } from './ui';

const EDIT_VERBS = /^(add|change|make|remove|delete|fix|implement|create|update|rename|replace|move|refactor|build|use|show|hide|let|allow|convert|style|turn)\b/i;

function guessIntent(text: string): ChatIntent {
  return EDIT_VERBS.test(text.trim()) ? 'edit' : 'ask';
}

function DiffView({ change }: { change: FileChange }) {
  const parts = useMemo(() => diffLines(change.before ?? '', change.after ?? ''), [change]);
  type Row = { type: '+' | '-' | ' '; text: string };
  const rows: Row[] = [];
  for (const part of parts) {
    const lines = part.value.replace(/\n$/, '').split('\n');
    const type: Row['type'] = part.added ? '+' : part.removed ? '-' : ' ';
    if (type === ' ' && lines.length > 6) {
      rows.push(...lines.slice(0, 2).map((text) => ({ type, text })));
      rows.push({ type: ' ', text: `··· ${lines.length - 4} unchanged lines ···` });
      rows.push(...lines.slice(-2).map((text) => ({ type, text })));
    } else rows.push(...lines.map((text) => ({ type, text })));
  }
  return (
    <pre className="max-h-72 overflow-auto border-t border-line bg-[#0b0b0b] py-1 font-mono text-[11px] leading-relaxed">
      {rows.slice(0, 400).map((row, i) => (
        <div
          key={i}
          className={cn('whitespace-pre px-3', row.type === '+' && 'bg-ok/10 text-[#86efac]', row.type === '-' && 'bg-brand/10 text-[#fca5a5]', row.type === ' ' && 'text-muted')}
        >
          <span className="mr-2 select-none opacity-60">{row.type}</span>
          {row.text}
        </div>
      ))}
    </pre>
  );
}

function ChangeList({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState<string | null>(null);
  const { revertChanges, focusCode } = useStudio.getState();
  if (!message.changes?.length) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs">
        <span className="font-medium text-soft">
          {message.reverted ? 'Reverted' : 'Applied'} {message.changes.length} file change{message.changes.length > 1 ? 's' : ''}
        </span>
        {!message.reverted && (
          <button type="button" onClick={() => revertChanges(message.id)} className="flex items-center gap-1 text-muted hover:text-fg">
            <RotateCcw className="size-3" /> Undo
          </button>
        )}
      </div>
      {message.changes.map((change) => {
        const diff = diffLines(change.before ?? '', change.after ?? '');
        const added = diff.filter((d) => d.added).reduce((n, d) => n + (d.count ?? 0), 0);
        const removed = diff.filter((d) => d.removed).reduce((n, d) => n + (d.count ?? 0), 0);
        return (
          <div key={change.path} className="border-b border-line last:border-0">
            <button
              type="button"
              onClick={() => setOpen(open === change.path ? null : change.path)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/[0.03]"
            >
              {change.before === null ? <FilePlus2 className="size-3.5 text-ok" /> : change.after === null ? <FileX2 className="size-3.5 text-[#ff8a80]" /> : fileIcon(change.path)}
              <span className={cn('min-w-0 flex-1 truncate font-mono', message.reverted && 'line-through opacity-60')}>{change.path}</span>
              <span className="font-mono text-[#86efac]">+{added}</span>
              <span className="font-mono text-[#fca5a5]">−{removed}</span>
              <ChevronDown className={cn('size-3.5 text-muted transition-transform', open === change.path && 'rotate-180')} />
            </button>
            {open === change.path && (
              <>
                <DiffView change={change} />
                {change.after !== null && !message.reverted && (
                  <button type="button" onClick={() => focusCode(change.path, undefined, undefined, 'build')} className="w-full border-t border-line px-3 py-1.5 text-left text-[11px] text-brand-2 hover:bg-white/[0.03]">
                    Open in editor →
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Message({ message }: { message: ChatMessage }) {
  const project = useStudio((s) => s.project)!;
  const { focusCode } = useStudio.getState();
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-elevated px-3.5 py-2.5 text-sm text-fg">{message.content}</div>
      </div>
    );
  }
  const prose = message.content.replace(/\n?\[\[file:[^\]]+\]\]\n?/g, '\n');
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-brand">
        <Bot className="size-4 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        {prose.trim() ? (
          <Markdown files={project.files} onCodeRef={(file, start, end) => focusCode(file, start, end, 'build')}>
            {prose}
          </Markdown>
        ) : message.status === 'streaming' && !message.pending?.length ? (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Thinking…
          </span>
        ) : null}
        {message.status === 'streaming' && (message.pending?.length ?? 0) > 0 && (
          <div className="mt-2 space-y-1">
            {message.pending!.map((f) => (
              <div key={f.path} className="flex items-center gap-2 rounded-md bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-soft">
                {f.complete ? <PenLine className="size-3 text-ok" /> : <Spinner className="size-3" />} {f.complete ? 'Wrote' : 'Writing'} {f.path}
              </div>
            ))}
          </div>
        )}
        <ChangeList message={message} />
        {message.status === 'error' && <p className="mt-2 rounded-lg bg-brand/10 px-3 py-2 text-xs text-[#ff8a80]">{message.error}</p>}
      </div>
    </div>
  );
}

const LIVE_SUGGESTIONS = [
  { text: 'How does this app save my data?', intent: 'ask' as const },
  { text: 'Explain App.js like I’m a beginner', intent: 'ask' as const },
  { text: 'Add a dark mode toggle', intent: 'edit' as const },
  { text: 'Make the main screen more colourful and fun', intent: 'edit' as const },
];

export function MentorPanel() {
  const project = useStudio((s) => s.project)!;
  const chatBusy = useStudio((s) => s.chatBusy);
  const { sendMessage, setMentorOpen, clearChat, cancel } = useStudio.getState();
  const live = useLiveAI();
  const wide = useMediaQuery('(min-width: 1024px)');
  const [draft, setDraft] = useState('');
  const [canned, setCanned] = useState<MentorQA[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (project.source === 'sample' && project.sampleId) void loadSampleDoc<MentorQA[]>(project.sampleId, 'mentor').then((qa) => setCanned(qa ?? []));
  }, [project.sampleId, project.source]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [project.chat]);

  const suggestions = live.live ? LIVE_SUGGESTIONS : canned.map((qa) => ({ text: qa.question, intent: 'ask' as const }));

  const submit = (text = draft, intent?: ChatIntent) => {
    if (!text.trim() || chatBusy) return;
    void sendMessage(text, intent ?? guessIntent(text));
    setDraft('');
  };

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col border-l border-line bg-panel',
        wide ? 'w-[400px] shrink-0 xl:w-[440px]' : 'fixed inset-0 z-50 w-full',
      )}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-brand">
          <Bot className="size-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">AI Mentor</div>
          <div className="truncate text-[11px] text-muted">{live.live ? `Answers & edits · ${project.models.chat ?? live.model}` : 'Demo mode · suggested questions'}</div>
        </div>
        {project.chat.length > 0 && (
          <Button variant="ghost" size="icon" aria-label="Clear conversation" onClick={() => confirm('Clear this conversation?') && clearChat()} disabled={chatBusy}>
            <Trash2 className="size-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label="Close mentor" onClick={() => setMentorOpen(false)}>
          <X className="size-4" />
        </Button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {project.chat.length === 0 && (
          <div className="pt-4">
            <p className="font-display text-base font-semibold">Hi! I know every line of {project.understanding?.appName ?? 'your app'}.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Ask me <span className="text-soft">why</span> something works, or tell me what to <span className="text-soft">change</span> — I'll edit the code, show you the diff and explain it. Select code in the editor to ask about it.
            </p>
            {!live.live && (
              <p className="mt-3 rounded-lg border border-warn/25 bg-warn/[0.07] p-3 text-xs leading-relaxed text-soft">
                Live AI isn't connected here, so I can answer the demo questions below. Add an Anthropic API key in Settings for full mentoring and code edits.
              </p>
            )}
          </div>
        )}
        {project.chat.map((message) => (
          <Message key={message.id} message={message} />
        ))}
      </div>

      <div className="shrink-0 border-t border-line p-3">
        {!chatBusy && suggestions.length > 0 && project.chat.length < 2 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.text}
                type="button"
                onClick={() => submit(s.text, s.intent)}
                className="rounded-full border border-line bg-card px-2.5 py-1 text-[11.5px] text-muted hover:border-line-strong hover:text-fg"
              >
                {s.text}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-xl border border-line bg-bg p-1.5 focus-within:border-brand/40">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={Math.min(5, Math.max(1, draft.split('\n').length))}
            placeholder={live.live ? 'Ask why, or ask for a change…' : 'Ask one of the demo questions…'}
            aria-label="Message the AI mentor"
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none"
          />
          {chatBusy ? (
            <Button variant="secondary" size="icon" aria-label="Stop" onClick={() => cancel('chat')}>
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button variant="primary" size="icon" aria-label="Send" onClick={() => submit()} disabled={!draft.trim()}>
              <Send className="size-4" />
            </Button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px] text-subtle">
          <span>Enter to send · Shift+Enter for a new line</span>
          {draft.trim() && <Badge className="py-0">{guessIntent(draft) === 'edit' ? 'will edit code' : 'question'}</Badge>}
        </div>
      </div>
    </aside>
  );
}
