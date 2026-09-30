import { useEffect, useId, useState } from 'react';
import { cn } from '../lib/utils';
import { Skeleton } from './ui';

let ready: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid() {
  ready ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      fontFamily: 'DM Sans, ui-sans-serif, system-ui, sans-serif',
      flowchart: { curve: 'basis', padding: 14, nodeSpacing: 36, rankSpacing: 56 },
      themeVariables: {
        darkMode: true,
        background: '#0a0a0a',
        primaryColor: '#161616',
        primaryTextColor: '#f5f5f5',
        primaryBorderColor: '#ED2C2C',
        secondaryColor: '#161616',
        tertiaryColor: '#121212',
        lineColor: '#5c5c5c',
        textColor: '#d4d4d4',
        edgeLabelBackground: '#121212',
        fontSize: '13px',
        classText: '#f5f5f5',
        mainBkg: '#161616',
        nodeBorder: '#3a3a3a',
      },
    });
    return mermaid;
  });
  return ready;
}

/** Renders Mermaid code (generated deterministically from the plan) as SVG. */
export function MermaidDiagram({ code, className }: { code: string; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    loadMermaid()
      .then((mermaid) => mermaid.render(`mmd${id}${Date.now()}`, code))
      .then(({ svg: out }) => !cancelled && setSvg(out))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) return <p className="text-xs text-muted">Diagram unavailable: {error.slice(0, 120)}</p>;
  if (!svg) return <Skeleton className="h-48 w-full" />;
  return (
    <div
      className={cn('overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full', className)}
      // Mermaid output with securityLevel "strict" is sanitised (DOMPurify).
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
