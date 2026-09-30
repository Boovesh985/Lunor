import { describe, expect, it } from 'vitest';
import { dataModelDiagram, screenFlowDiagram } from '../src/lib/diagram.ts';
import { readSampleDoc } from './helpers.ts';

describe('screenFlowDiagram', () => {
  it('draws every screen and navigation edge from a plan', () => {
    const plan = readSampleDoc('split-mate', 'plan');
    const diagram = screenFlowDiagram(plan)!;
    expect(diagram.startsWith('flowchart LR')).toBe(true);
    for (const screen of plan.screens) expect(diagram).toContain(`n_${screen.id}`);
    expect(diagram).toContain('n_balances -->|"Tap Add expense"| n_addExpense');
  });

  it('escapes labels so model output can never break Mermaid syntax', () => {
    const diagram = screenFlowDiagram({
      screens: [
        { id: 'home', name: 'Home "main" [v2] {x}', kind: 'tab', navigatesTo: [{ screenId: 'de-tail', trigger: 'Tap | open; now' }] },
        { id: 'de-tail', name: 'Detail', kind: 'stack', navigatesTo: [] },
      ],
    })!;
    expect(diagram).not.toMatch(/"main"|\[v2]|\{x}/);
    expect(diagram).toContain('n_de_tail');
    expect(diagram).toContain("Home 'main' v2 x");
  });

  it('returns null without screens', () => {
    expect(screenFlowDiagram({})).toBeNull();
  });
});

describe('dataModelDiagram', () => {
  it('draws entities, fields and parsed relations', () => {
    const diagram = dataModelDiagram(readSampleDoc('split-mate', 'plan'))!;
    expect(diagram.startsWith('classDiagram')).toBe(true);
    expect(diagram).toContain('class Expense');
    expect(diagram).toContain('Expense --> Member : paidBy');
    expect(diagram).toContain('Settlement --> Member : from');
  });
});
