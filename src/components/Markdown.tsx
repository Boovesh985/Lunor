import { memo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { highlightJs } from '../lib/highlight';
import { cn } from '../lib/utils';

interface HastNode {
  type: string;
  value?: string;
  children?: HastNode[];
  properties?: { className?: string[] };
}

function textOf(node: HastNode | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

const CODE_REF = /^([\w./-]+\.(?:jsx?|tsx?|json))(?::(\d+)(?:[-–](\d+))?)?$/;

interface MarkdownProps {
  children: string;
  className?: string;
  /** Makes `path:line` references clickable when the file exists. */
  onCodeRef?: (file: string, start?: number, end?: number) => void;
  files?: Record<string, string>;
}

const INLINE_ELEMENTS = ['p', 'strong', 'em', 'del', 'code', 'a'];
const INLINE_ELEMENTS_NO_LINKS = INLINE_ELEMENTS.filter((tag) => tag !== 'a');
const inlineComponents: Components = {
  p: ({ children }) => <>{children}</>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
};

/**
 * Inline Markdown for short AI strings shown inside sentences, labels and
 * buttons (quiz options, hints, tips): `code`, **bold**, _italics_ and links,
 * without block elements that would break the surrounding layout. Pass
 * `links={false}` inside a button or link, where a nested <a> is invalid.
 */
export const InlineMarkdown = memo(function InlineMarkdown({ children, className, links = true }: { children: string; className?: string; links?: boolean }) {
  return (
    <span className={cn('md-inline', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={links ? INLINE_ELEMENTS : INLINE_ELEMENTS_NO_LINKS}
        unwrapDisallowed
        components={inlineComponents}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
});

export const Markdown = memo(function Markdown({ children, className, onCodeRef, files }: MarkdownProps) {
  const components: Components = {
    pre({ node }) {
      const codeNode = (node as unknown as HastNode).children?.[0];
      const code = textOf(codeNode).replace(/\n$/, '');
      const language = codeNode?.properties?.className?.[0]?.replace('language-', '') ?? '';
      const highlight = !language || /^(jsx?|tsx?|javascript|typescript)$/.test(language);
      return (
        <pre className="scrollbar-none">
          <code>{highlight ? highlightJs(code) : code}</code>
        </pre>
      );
    },
    code({ children: inner }) {
      const text = String(inner ?? '');
      const ref = CODE_REF.exec(text.trim());
      if (ref && onCodeRef && (!files || ref[1]! in files)) {
        const start = ref[2] ? Number(ref[2]) : undefined;
        const end = ref[3] ? Number(ref[3]) : start;
        return (
          <button
            type="button"
            onClick={() => onCodeRef(ref[1]!, start, end)}
            className="rounded border border-brand-2/30 bg-brand-2/10 px-1 font-mono text-[0.82em] text-[#ffb199] hover:bg-brand-2/20"
            title="Show in code"
          >
            {text}
          </button>
        );
      }
      return <code>{inner as ReactNode}</code>;
    },
    a({ href, children: label }) {
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {label}
        </a>
      );
    },
  };
  return (
    <div className={cn('prose-lunor', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
});
