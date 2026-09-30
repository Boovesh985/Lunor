/**
 * Deterministic Mermaid generation from the structured plan. The AI never
 * writes diagram syntax directly, so a diagram can't fail to render because
 * of a model typo — we escape every label ourselves.
 */
import type { Plan } from '../../shared/schemas.ts';

const label = (s: unknown) =>
  String(s ?? '')
    .replace(/["`]/g, "'")
    .replace(/[<>{}[\]|#;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48) || '…';
const nodeId = (s: unknown) => `n_${String(s ?? 'x').replace(/[^A-Za-z0-9_]/g, '_')}`;
const ident = (s: unknown) => String(s ?? '').replace(/[^A-Za-z0-9_]/g, '') || 'Field';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? DeepPartial<U>[] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function screenFlowDiagram(plan: DeepPartial<Plan>): string | null {
  const screens = (plan.screens ?? []).filter((s) => s?.id && s.name);
  if (screens.length === 0) return null;
  const lines = ['flowchart LR'];
  for (const screen of screens) {
    const id = nodeId(screen.id);
    const text = label(screen.name);
    if (screen.kind === 'modal') lines.push(`  ${id}(["${text}"]):::modal`);
    else if (screen.kind === 'stack') lines.push(`  ${id}["${text}"]:::stack`);
    else lines.push(`  ${id}["${text}"]:::tab`);
  }
  const ids = new Set(screens.map((s) => s.id));
  for (const screen of screens) {
    for (const link of screen.navigatesTo ?? []) {
      if (link?.screenId && ids.has(link.screenId) && link.screenId !== screen.id) {
        lines.push(`  ${nodeId(screen.id)} -->|"${label(link.trigger)}"| ${nodeId(link.screenId)}`);
      }
    }
  }
  lines.push('  classDef tab fill:#1d1010,stroke:#ED2C2C,color:#f5f5f5,stroke-width:1.5px');
  lines.push('  classDef stack fill:#161616,stroke:#8a8a8a,color:#f5f5f5');
  lines.push('  classDef modal fill:#1f150f,stroke:#F65F31,color:#f5f5f5,stroke-dasharray:5 4');
  return lines.join('\n');
}

export function dataModelDiagram(plan: DeepPartial<Plan>): string | null {
  const entities = (plan.dataModel ?? []).filter((e) => e?.entity);
  if (entities.length === 0) return null;
  const names = new Set(entities.map((e) => ident(e.entity)));
  const lines = ['classDiagram'];
  for (const entity of entities) {
    lines.push(`  class ${ident(entity.entity)} {`);
    for (const field of entity.fields ?? []) {
      if (!field?.name) continue;
      const type = String(field.type ?? 'any').split(/[\s(]/)[0]!.replace(/[^A-Za-z0-9_[\]]/g, '') || 'any';
      lines.push(`    +${type} ${ident(field.name)}`);
    }
    lines.push('  }');
  }
  for (const entity of entities) {
    for (const relation of entity.relations ?? []) {
      const match = /(\w+)\.(\w+)\s*(?:→|->|=>|references|refers to)\s*(\w+)/i.exec(String(relation));
      if (match && names.has(match[1]!) && names.has(match[3]!) && match[1] !== match[3]) {
        lines.push(`  ${match[1]} --> ${match[3]} : ${match[2]}`);
      }
    }
  }
  return lines.join('\n');
}
