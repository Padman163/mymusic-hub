import { glyphText } from './svg.ts';

export type Articulation = 'staccato' | 'tenuto' | 'accent' | 'marcato';
export type Placement = 'above' | 'below';

export const articulationSymbols: Record<Articulation, {
  above: string;
  below: string;
  belowOffset: number;
  label: string;
}> = {
  staccato: { above: '\uE4A2', below: '\uE4A3', belowOffset: 12, label: 'Staccato' },
  tenuto: { above: '\uE4A4', below: '\uE4A5', belowOffset: 12, label: 'Tenuto' },
  accent: { above: '\uE4A0', below: '\uE4A1', belowOffset: 14, label: 'Akzent' },
  marcato: { above: '\uE4AC', below: '\uE4AD', belowOffset: 14, label: 'Marcato' }
};

export function articulationPlacement(hasStem: boolean, stemUp: boolean, requested?: Placement): Placement {
  return hasStem && !stemUp ? 'above' : requested ?? 'above';
}

export function renderArticulation(type: Articulation, placement: Placement, x: string | number, y: number, className: string): string {
  const symbol = articulationSymbols[type];
  return glyphText(symbol[placement], x, y, className, 'middle');
}
