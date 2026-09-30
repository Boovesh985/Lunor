import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { RangeSetBuilder, StateEffect, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useMemo, useRef } from 'react';
import { cn } from '../lib/utils';

type Range = [number, number];
interface Marks {
  sections: Range[];
  active: Range | null;
  flash: Range | null;
}

const setMarks = StateEffect.define<Marks>();

function buildMarks(state: EditorState, marks: Marks): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const inRange = (line: number, r: Range | null) => !!r && line >= r[0] && line <= r[1];
  for (let line = 1; line <= state.doc.lines; line++) {
    const classes: string[] = [];
    if (marks.sections.some((r) => inRange(line, r))) classes.push('cm-lunor-section');
    if (inRange(line, marks.active)) classes.push('cm-lunor-active');
    if (inRange(line, marks.flash)) classes.push('cm-lunor-flash');
    if (classes.length) {
      const from = state.doc.line(line).from;
      builder.add(from, from, Decoration.line({ class: classes.join(' ') }));
    }
  }
  return builder.finish();
}

const marksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    let next = decorations.map(tr.changes);
    for (const effect of tr.effects) if (effect.is(setMarks)) next = buildMarks(tr.state, effect.value);
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const lunorTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#0b0b0b', color: '#d4d4d4', height: '100%', fontSize: '12.5px' },
    '.cm-content': { fontFamily: 'var(--font-mono)', caretColor: '#F65F31', padding: '12px 0' },
    '.cm-scroller': { lineHeight: '1.7', fontFamily: 'var(--font-mono)' },
    '.cm-gutters': { backgroundColor: '#0b0b0b', color: '#454545', border: 'none', paddingLeft: '6px' },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.025)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#a3a3a3' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'rgba(246,95,49,0.28) !important' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#F65F31', borderLeftWidth: '2px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-foldGutter .cm-gutterElement': { color: '#3a3a3a' },
    '.cm-matchingBracket': { backgroundColor: 'rgba(246,95,49,0.18)', outline: 'none' },
    '.cm-tooltip': { backgroundColor: '#161616', border: '1px solid #262626' },
  },
  { dark: true },
);

const lunorHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword], color: '#ff7b72' },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#a5d6ff' },
  { tag: [t.number, t.bool, t.null, t.atom], color: '#79c0ff' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#6e7681', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#d2a8ff' },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], color: '#ffa657' },
  { tag: [t.propertyName], color: '#8fbcf8' },
  { tag: [t.typeName, t.className, t.tagName], color: '#7ee787' },
  { tag: [t.attributeName], color: '#d2a8ff' },
  { tag: [t.variableName, t.self], color: '#e6edf3' },
  { tag: [t.operator, t.punctuation, t.angleBracket, t.bracket], color: '#9aa4ae' },
]);

export interface CodeViewProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** Line ranges shown with a subtle tint (e.g. explained sections). */
  sections?: Range[];
  /** The highlighted range. */
  active?: Range | null;
  /** Scroll to and flash a range whenever `nonce` changes. */
  reveal?: { start: number; end: number; nonce: number } | null;
  /** Keep the view scrolled to the end (while code streams in). */
  followTail?: boolean;
  onSelection?: (selection: { text: string; from: number; to: number } | null) => void;
  className?: string;
}

export function CodeView({ value, onChange, readOnly, sections, active, reveal, followTail, onSelection, className }: CodeViewProps) {
  const viewRef = useRef<EditorView | null>(null);
  const onSelectionRef = useRef(onSelection);
  onSelectionRef.current = onSelection;

  const extensions = useMemo(
    () => [
      javascript({ jsx: true }),
      lunorTheme,
      syntaxHighlighting(lunorHighlight),
      marksField,
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet || !onSelectionRef.current) return;
        const range = update.state.selection.main;
        if (range.empty) return onSelectionRef.current(null);
        onSelectionRef.current({
          text: update.state.sliceDoc(range.from, range.to),
          from: update.state.doc.lineAt(range.from).number,
          to: update.state.doc.lineAt(range.to).number,
        });
      }),
    ],
    [],
  );

  const flashRef = useRef<Range | null>(null);
  const applyMarks = () => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setMarks.of({ sections: sections ?? [], active: active ?? null, flash: flashRef.current }) });
  };

  useEffect(applyMarks, [sections, active, value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !reveal) return;
    const lines = view.state.doc.lines;
    const start = Math.min(Math.max(1, reveal.start), lines);
    flashRef.current = [start, Math.min(Math.max(start, reveal.end), lines)];
    applyMarks();
    view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(start).from, { y: 'center' }) });
    const timer = setTimeout(() => {
      flashRef.current = null;
      applyMarks();
    }, 1400);
    return () => clearTimeout(timer);
  }, [reveal?.nonce]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !followTail) return;
    view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.length, { y: 'end' }) });
  }, [value, followTail]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      editable={!readOnly}
      theme="none"
      extensions={extensions}
      basicSetup={{ foldGutter: true, highlightActiveLine: !readOnly, highlightActiveLineGutter: !readOnly, autocompletion: false, searchKeymap: true }}
      onCreateEditor={(view) => {
        viewRef.current = view;
        applyMarks();
      }}
      className={cn('h-full overflow-hidden', className)}
      height="100%"
    />
  );
}
