import { jsxLanguage } from '@codemirror/lang-javascript';
import { classHighlighter, highlightCode } from '@lezer/highlight';
import type { ReactNode } from 'react';

/** Static syntax highlighting for snippets (chat, quiz, diffs) using CodeMirror's JSX parser. */
export function highlightJs(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let key = 0;
  try {
    const tree = jsxLanguage.parser.parse(code);
    highlightCode(
      code,
      tree,
      classHighlighter,
      (text, classes) => out.push(classes ? <span key={key++} className={classes}>{text}</span> : text),
      () => out.push('\n'),
    );
  } catch {
    return [code];
  }
  return out;
}
