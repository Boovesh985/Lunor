import { Anchor, ChevronDown, ChevronRight, Database, FileCode2, Folder, Layers, Palette, Play, Route, Smartphone, Wrench } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cn, fileName } from '../lib/utils';

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] };
  for (const path of paths) {
    const parts = path.split('/');
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join('/');
      let child = node.children!.find((c) => c.name === part && !!c.children === !isFile);
      if (!child) {
        child = { name: part, path: childPath, children: isFile ? undefined : [] };
        node.children!.push(child);
      }
      node = child;
    });
  }
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .sort((a, b) => (a.children ? 0 : 1) - (b.children ? 0 : 1) || a.name.localeCompare(b.name))
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n));
  return sort(root.children!);
}

export function fileIcon(path: string): ReactNode {
  const cls = 'size-3.5 shrink-0';
  if (path === 'App.js' || path.endsWith('/App.js')) return <Play className={cn(cls, 'text-brand-2')} />;
  if (path.includes('/screens/')) return <Smartphone className={cn(cls, 'text-[#93c5fd]')} />;
  if (path.includes('/components/')) return <Layers className={cn(cls, 'text-[#c4b5fd]')} />;
  if (path.includes('/hooks/') || path.includes('/context/')) return <Anchor className={cn(cls, 'text-[#6ee7a0]')} />;
  if (/theme|colors|tokens/.test(path)) return <Palette className={cn(cls, 'text-[#f9a8d4]')} />;
  if (path.includes('/data/')) return <Database className={cn(cls, 'text-[#fcc56b]')} />;
  if (path.includes('/navigation/')) return <Route className={cn(cls, 'text-[#67e8f9]')} />;
  if (path.includes('/utils/') || path.includes('/lib/')) return <Wrench className={cn(cls, 'text-[#a3a3a3]')} />;
  return <FileCode2 className={cn(cls, 'text-muted')} />;
}

export type FileMark = 'streaming' | 'new' | 'modified' | 'viewed' | 'pending';

interface FileTreeProps {
  paths: string[];
  active: string | null;
  onSelect(path: string): void;
  marks?: Record<string, FileMark | undefined>;
  className?: string;
}

export function FileTree({ paths, active, onSelect, marks = {}, className }: FileTreeProps) {
  const tree = useMemo(() => buildTree(paths), [paths]);
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const render = (nodes: TreeNode[], depth: number): ReactNode =>
    nodes.map((node) => {
      if (node.children) {
        const isClosed = closed.has(node.path);
        return (
          <div key={node.path}>
            <button
              type="button"
              onClick={() => setClosed((s) => {
                const next = new Set(s);
                if (next.has(node.path)) next.delete(node.path);
                else next.add(node.path);
                return next;
              })}
              className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[12.5px] text-muted hover:bg-white/[0.04] hover:text-soft"
              style={{ paddingLeft: 8 + depth * 12 }}
            >
              {isClosed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
              <Folder className="size-3.5 text-subtle" />
              {node.name}
            </button>
            {!isClosed && render(node.children, depth + 1)}
          </div>
        );
      }
      const mark = marks[node.path];
      return (
        <button
          key={node.path}
          type="button"
          onClick={() => onSelect(node.path)}
          title={node.path}
          className={cn(
            'group flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left text-[12.5px] transition-colors',
            active === node.path ? 'bg-brand/10 text-fg' : 'text-soft hover:bg-white/[0.04]',
            mark === 'pending' && 'opacity-40',
          )}
          style={{ paddingLeft: 20 + depth * 12 }}
        >
          {fileIcon(node.path)}
          <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{fileName(node.path)}</span>
          {mark === 'streaming' && <span className="size-1.5 animate-pulse rounded-full bg-brand-2" />}
          {mark === 'modified' && <span className="size-1.5 rounded-full bg-warn" title="Edited" />}
          {mark === 'new' && <span className="text-[10px] font-semibold text-ok">NEW</span>}
          {mark === 'viewed' && <span className="text-[10px] text-ok">✓</span>}
        </button>
      );
    });

  return <div className={cn('space-y-px', className)}>{render(tree, 0)}</div>;
}
