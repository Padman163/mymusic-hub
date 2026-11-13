// @vitest-environment node
const { test } = process.env.VITEST ? await import('vitest') : await import('node:test');
import assert from 'node:assert/strict';
import { articulationPlacement, articulationY, renderArticulation } from '../src/lib/articulation.ts';
import { renderRepeatEnd, renderRepeatEndAtBoundary, renderRepeatStart } from '../src/lib/barline.ts';
import { renderCurve, validateCurves } from '../src/lib/curve.ts';
import { dynamicsForHairpin } from '../src/lib/dynamics.ts';
import { collectBeamGroups, flagGlyph, renderDot, rhythmicPositions } from '../src/lib/rhythm.ts';
import { renderRest, restSymbols } from '../src/lib/rest.ts';
import { renderTempoMark, validateTempoChanges } from '../src/lib/tempo.ts';
import { omitUnchangedTimeSignatures, renderTimeSignature, validateTimeSignature } from '../src/lib/time-signature.ts';
import { beamGroupStemUp, defaultFirstNoteX, measureNumberOffset, minimumFirstNoteX, renderNotationSvg, SPATIUM, sp } from '../src/lib/notation-renderer.ts';
import { layoutNotationEvents } from '../src/lib/notation-layout.ts';
import {
  alignFirstNotesInSystems,
  arrangeNotationSystems,
  estimateMeasureMinWidth,
  layoutNotationSystems,
  normalizeNotationInput,
} from '../src/lib/system-layout.ts';

function beamSegments(svg) {
  const pattern = /<svg x="(calc\([^)]+\))" y="(-?[\d.]+)" width="calc\((calc\([^)]+\)) - (calc\([^)]+\))\)" height="([\d.]+)" overflow="hidden" aria-hidden="true"><line x1="0" y1="(-?[\d.]+)" x2="100%" y2="(-?[\d.]+)" stroke-width="([\d.]+)" stroke-linecap="square" \/><\/svg>/g;
  return [...svg.matchAll(pattern)].map((match) => ({
    index: match.index,
    start: match[1],
    end: match[3],
    widthStart: match[4],
    y1: Number(match[2]) + Number(match[6]),
    y2: Number(match[2]) + Number(match[7]),
    thickness: Number(match[8])
  }));
}

function beamX(expression, width) {
  const match = expression.match(/^calc\(([-.\d]+)% \+ ([-.\d]+)px\)$/);
  assert.ok(match);
  return Number(match[1]) * width / 100 + Number(match[2]);
}

test('time signatures validate and render for arbitrary positions', () => {
  assert.throws(() => validateTimeSignature({ numerator: 4, denominator: 3 }), /Ungültige Taktart/);
  assert.throws(() => validateTimeSignature({ numerator: 0, denominator: 4 }), /Ungültige Taktart/);
  assert.match(renderTimeSignature({ numerator: 4, denominator: 4 }, 20, 10, 30, 'music-time'), /x="20" y="10"/);
  const fourFour = { numerator: 4, denominator: 4 };
  const threeFour = { numerator: 3, denominator: 4 };
  const systems = omitUnchangedTimeSignatures([[{ timeSignature: fourFour }], [{ timeSignature: fourFour }, { timeSignature: threeFour }]]);
  assert.deepEqual(systems.map((system) => system.map((measure) => measure.timeSignature)), [[fourFour], [undefined, threeFour]]);
});

test('tempo marks validate distance and escape text', () => {
  assert.throws(() => validateTempoChanges({ ritAt: 0, aTempoAt: 1 }, 3), /mindestens zwei/);
  assert.throws(() => validateTempoChanges({ ritAt: 3 }, 3), /Ungültige Notenposition/);
  assert.doesNotThrow(() => validateTempoChanges({ ritAt: 0, aTempoAt: 2 }, 3));
  assert.match(renderTempoMark('a & b', '50%', 10, 0, 'tempo'), /a &amp; b/);
});

test('hairpins omit only a repeated initial dynamic', () => {
  assert.deepEqual(dynamicsForHairpin('crescendo', 'piano'), { start: 'piano', end: 'forte', showStart: false });
  assert.deepEqual(dynamicsForHairpin('decrescendo', 'forte'), { start: 'forte', end: 'piano', showStart: false });
  assert.equal(dynamicsForHairpin('decrescendo', 'piano').showStart, true);
});

test('rhythm groups, flags and dots are reusable without pitch positions', () => {
  const events = [{ duration: 'eighth', beamGroup: 'a' }, { duration: 'eighth', beamGroup: 'a' }];
  assert.deepEqual(collectBeamGroups(events).get('a').indices, [0, 1]);
  assert.throws(() => collectBeamGroups([events[0]]), /mindestens zwei/);
  assert.throws(() => collectBeamGroups([events[0], { duration: 'sixteenth', beamGroup: 'a' }]), /zusammenhängende/);
  assert.notEqual(flagGlyph('eighth', true), flagGlyph('eighth', false));
  assert.match(renderDot(40, 20, 6), /cx="40" cy="20"/);
});

test('rhythmic positions reflect notes, rests and dotted durations', () => {
  const events = [
    { type: 'rest', duration: 'eighth' },
    { duration: 'quarter', dotted: true },
    { duration: 'quarter' }
  ];
  const { positions } = rhythmicPositions(events);
  assert.ok(Math.abs((positions[2] - positions[1]) / positions[1] - 3) < 1e-10);
  assert.ok(Math.abs((1 - positions[2]) / positions[1] - 2) < 1e-10);
  const dotted = rhythmicPositions([{ duration: 'sixteenth', dotted: true }, { duration: 'sixteenth' }]).positions;
  assert.ok(Math.abs(dotted[1] / (1 - dotted[1]) - 1.5) < 1e-10);
  assert.deepEqual(rhythmicPositions([]), { positions: [], overfull: false });
  assert.equal(rhythmicPositions([{ duration: 'quarter' }, {}]), undefined);
  assert.throws(() => rhythmicPositions([{ duration: 'invalid' }]), /Ungültiger Noten- oder Pausenwert/);
  const values = ['sixteenth', 'eighth', 'quarter', 'half', 'whole'];
  const scale = rhythmicPositions(values.map((duration) => ({ duration }))).positions;
  const gaps = scale.slice(1).map((position, i) => position - scale[i]);
  gaps.push(1 - scale.at(-1));
  for (let i = 1; i < gaps.length; i++) {
    assert.ok(Math.abs(gaps[i] / gaps[i - 1] - 2) < 1e-10);
  }
});

test('four quarter notes share the available aligned measure width', () => {
  const notes = Array.from({ length: 4 }, () => ({ duration: 'quarter', step: 2 }));
  const positions = layoutNotationEvents(notes, {
    noteInset: 40, endInset: 0, rhythmicPositions: rhythmicPositions(notes).positions
  });
  for (const width of [200, 400]) {
    const actual = positions.map(({ fraction, offset }) => fraction * width + offset);
    const interval = (width - 40) / 4;
    for (let i = 0; i < actual.length; i++) {
      assert.ok(Math.abs(actual[i] - (40 + i * interval)) < 1e-10);
    }
    assert.equal(width - actual[3], interval);
  }
  const svg = renderNotationSvg({ notes, firstNoteX: 40 });
  const fractions = [...svg.matchAll(/class="notation-note" x="([\d.]+)%"/g)].map((match) => Number(match[1]));
  fractions.forEach((value, i) => assert.equal(value, i * 25));
});

test('default notehead margin applies after prefixes with rhythmic end spacing', () => {
  const gap = 1.5 * sp(1.35);
  const half = sp(1.35) / 2;
  for (const [prefix, prefixEnd] of [
    [{}, 0],
    [{ clef: 'treble' }, 36],
    [{ clef: 'bass', timeSignature: { numerator: 4, denominator: 4 } }, 63],
    [{ clef: 'treble', accidentals: [{ type: 'sharp', step: 8 }], repeatStart: true }, 66]
  ]) {
    const notes = Array.from({ length: 11 }, (_, i) => ({ duration: 'whole', step: i % 9 }));
    const svg = renderNotationSvg({ ...prefix, notes });
    const minWidth = Number(svg.match(/min-width:([\d.]+)px/)[1]);
    const heads = [...svg.matchAll(/<g transform="translate\(([-.\deE+]+) 0\)"><text class="notation-note" x="([\d.]+)%"/g)];
    assert.equal(heads.length, notes.length);
    for (const width of [minWidth, 800]) {
      const x = heads.map((head) => Number(head[1]) + Number(head[2]) * width / 100);
      assert.ok(Math.abs(x[0] - half - prefixEnd - gap) < 1e-9);
      const interval = x[1] - x[0];
      if (prefix.timeSignature) {
        assert.ok(Math.abs(width - x.at(-1) - half - gap) < 1e-9);
      } else {
        assert.ok(Math.abs(width - x.at(-1) - interval) < 1e-9);
      }
      for (let i = 2; i < x.length; i++) {
        assert.ok(Math.abs(x[i] - x[i - 1] - interval) < 1e-9);
      }
    }
  }
  const notes = [{ duration: 'quarter', step: 2 }, { duration: 'quarter', step: 3 }];
  const systems = arrangeNotationSystems([
    { clef: 'treble', notes },
    { notes },
    { notes },
  ], 3);
  assert.equal(systems[0][1].firstNoteX - sp(1.35) / 2, 1.5 * sp(1.35));
  assert.equal(systems[0][2].firstNoteX, systems[0][1].firstNoteX);
  assert.match(renderNotationSvg({ notes, firstNoteX: 10 }), /translate\(10 0\)"><text class="notation-note" x="0%"/);
});

test('ledger lines, note accidentals and ending marks retain extra clearance', () => {
  const gap = 1.5 * sp(1.35);
  const half = sp(1.35) / 2;
  for (const [first, extra] of [
    [{ duration: 'quarter', step: 10 }, sp(0.5)],
    [{ duration: 'quarter', step: 2, accidental: 'sharp' }, sp(1.6)]
  ]) {
    assert.equal(defaultFirstNoteX({ clef: 'treble', notes: [first] }), 36 + gap + half + extra);
  }
  for (const [ending, extra] of [[{}, 0], [{ rightBarStyle: 'final' }, 8], [{ repeatEnd: true }, 16]]) {
    const notes = [{ duration: 'quarter', step: 2 }, { duration: 'whole', step: 10 }];
    const svg = renderNotationSvg({ notes, ...ending, timeSignature: { numerator: 4, denominator: 4 } });
    const heads = [...svg.matchAll(/<g transform="translate\(([-.\d]+) 0\)"><text class="notation-note" x="([\d.]+)%"/g)];
    assert.equal(Number(heads.at(-1)[2]), 100);
    assert.equal(-Number(heads.at(-1)[1]), extra + gap + half + sp(0.5));
  }
  const untimed = [{ type: 'filled', step: 2 }, { type: 'empty', step: 3 }];
  assert.equal(defaultFirstNoteX({ clef: 'treble', notes: untimed }), 36 + gap + half);
});

test('renderer places timed events proportionally', () => {
  const notes = [
    { type: 'rest', duration: 'eighth' },
    { duration: 'quarter', step: 3, dotted: true },
    { duration: 'quarter', step: 2 }
  ];
  const positions = (svg) => [...svg.matchAll(/class="notation-(?:rest|note)" x="([\d.]+)%"/g)].map((match) => Number(match[1]));
  const svg = renderNotationSvg({ notes, firstNoteX: 26, rightBarStyle: 'final' });
  const actual = positions(svg);
  assert.equal(actual.length, 3);
  const rhythmic = rhythmicPositions(notes).positions;
  for (const [actualValue, expected] of actual.map((value, index) => [value, rhythmic[index] * 100])) {
    assert.ok(Math.abs(actualValue - expected) < 1e-10);
  }
  const grouped = [...svg.matchAll(/<g transform="translate\(([-.\d]+) 0\)"><text class="notation-(?:rest|note)" x="([\d.]+)%"/g)];
  const x = grouped.map((match) => Number(match[1]) + Number(match[2]) * 3);
  const distances = [x[1] - x[0], x[2] - x[1]];
  assert.ok(Math.abs(distances[1] / distances[0] - 3) < 1e-10);
  const unaligned = positions(renderNotationSvg({ notes }));
  for (let i = 0; i < unaligned.length; i++) {
    assert.ok(Math.abs(unaligned[i] - actual[i]) < 1e-10);
  }
  const untimed = renderNotationSvg({ notes: [{ type: 'filled', step: 2 }, { type: 'empty', step: 3 }] });
  assert.deepEqual(positions(untimed), [0, 100]);
});

test('meter determines the duration after the last event and incomplete measures', () => {
  const fourFour = { numerator: 4, denominator: 4 };
  const twoFour = { numerator: 2, denominator: 4 };
  const notes = [
    { duration: 'quarter', step: 2 },
    { type: 'rest', duration: 'quarter' },
    { duration: 'half', step: 3 }
  ];
  assert.deepEqual(rhythmicPositions(notes, fourFour), { positions: [0, 0.25, 0.5], overfull: false });
  assert.deepEqual(rhythmicPositions(notes), { positions: [0, 0.25, 0.5], overfull: false });
  assert.deepEqual(rhythmicPositions(notes.slice(0, 2), fourFour).positions, [0, 0.25]);
  assert.deepEqual(rhythmicPositions(notes.slice(0, 2), twoFour).positions, [0, 0.5]);
  assert.deepEqual(rhythmicPositions([
    { duration: 'quarter', dotted: true }, { duration: 'eighth' }, { duration: 'half' }
  ], fourFour).positions, [0, 0.375, 0.5]);
  const svg = renderNotationSvg({ notes, layoutTimeSignature: fourFour, firstNoteX: 27 });
  assert.deepEqual([...svg.matchAll(/class="notation-(?:rest|note)" x="([\d.]+)%"/g)].map((m) => Number(m[1])), [0, 25, 50]);
  assert.doesNotMatch(svg, /class="notation-time"/);
  const heads = [...svg.matchAll(/<g transform="translate\(([-.\d]+) 0\)"><text class="notation-(?:rest|note)" x="([\d.]+)%"/g)];
  for (const width of [200, 400]) {
    const x = heads.map((head) => Number(head[1]) + Number(head[2]) * width / 100);
    assert.ok(Math.abs((width - x[2]) / (width - x[0]) - 0.5) < 1e-10);
  }
});

test('overfull measures use fixed edge margins and proportional internal gaps', () => {
  const timeSignature = { numerator: 4, denominator: 4 };
  const notes = Array.from({ length: 5 }, () => ({ duration: 'whole', step: 2 }));
  assert.deepEqual(rhythmicPositions(notes, timeSignature), {
    positions: [0, 0.25, 0.5, 0.75, 1], overfull: true
  });
  const mixed = [{ duration: 'quarter' }, { duration: 'half', dotted: true }, { duration: 'whole' }];
  assert.deepEqual(rhythmicPositions(mixed, timeSignature), { positions: [0, 0.25, 1], overfull: true });
  const svg = renderNotationSvg({ timeSignature, notes });
  const minWidth = Number(svg.match(/min-width:([\d.]+)px/)[1]);
  const heads = [...svg.matchAll(/<g transform="translate\(([-.\d]+) 0\)"><text class="notation-note" x="([\d.]+)%"/g)];
  for (const width of [minWidth, 400]) {
    const x = heads.map((head) => Number(head[1]) + Number(head[2]) * width / 100);
    assert.equal(x[0], 60);
    assert.equal(width - x.at(-1), 27);
    const spacing = x[1] - x[0];
    for (let i = 2; i < x.length; i++) {
      assert.ok(Math.abs(x[i] - x[i - 1] - spacing) < 1e-10);
    }
  }
});

test('system layout carries the active meter across lines and meter changes', () => {
  const fourFour = { numerator: 4, denominator: 4 };
  const threeFour = { numerator: 3, denominator: 4 };
  const notes = [{ duration: 'quarter', step: 2 }, { duration: 'quarter', step: 3 }];
  const systems = arrangeNotationSystems([
    { clef: 'treble', timeSignature: fourFour, notes },
    { notes },
    { timeSignature: threeFour, notes },
    { notes }
  ], 2);
  assert.deepEqual(systems.flat().map((measure) => measure.layoutTimeSignature), [fourFour, fourFour, threeFour, threeFour]);
  const measure = systems[0][1];
  const svg = renderNotationSvg({ ...measure, clef: undefined });
  assert.deepEqual([...svg.matchAll(/class="notation-note" x="([\d.]+)%"/g)].map((m) => Number(m[1])), [0, 25]);
  assert.doesNotMatch(svg, /class="notation-time"/);
  const hidden = arrangeNotationSystems([
    { clef: 'treble', layoutTimeSignature: threeFour, notes },
    { notes }
  ], 1);
  assert.deepEqual(hidden.flat().map((item) => item.layoutTimeSignature), [threeFour, threeFour]);
});

test('beam stems follow their rhythmic x positions with dotted notes', () => {
  const notes = [
    { duration: 'eighth', step: 0, dotted: true, beamGroup: 'a' },
    { duration: 'eighth', step: 1, beamGroup: 'a' },
    { duration: 'eighth', step: 2, beamGroup: 'a' }
  ];
  const svg = renderNotationSvg({ notes, firstNoteX: 10 });
  const stems = [...svg.matchAll(/<line x1="[\d.]+%" y1="[\d.]+?" x2="[\d.]+%" y2="([\d.]+)" transform="translate\([^)]+\)" stroke-width="1\.2" \/>/g)];
  assert.equal(stems.length, 3);
  const factor = 1.5;
  assert.ok(Math.abs(Number(stems[1][1]) - (29 - 10 * factor / (factor + 1))) < 1e-10);
});

test('notation geometry uses spatium for staff, heads, stems, beams and ledger lines', () => {
  assert.equal(SPATIUM, 10);
  assert.equal(sp(1.35), 13.5);
  const svg = renderNotationSvg({ notes: [
    { duration: 'quarter', step: -2 },
    { duration: 'whole', step: 10 }
  ], firstNoteX: 10 });
  assert.deepEqual([...svg.matchAll(/<line x1="0" y1="(\d+)" x2="100%"/g)].map((m) => Number(m[1])), [24, 34, 44, 54, 64]);
  assert.equal((svg.match(/textLength="13\.5" lengthAdjust="spacingAndGlyphs"/g) ?? []).length, 2);
  assert.match(svg, /y="73\.5" width="23\.5" height="1" transform="translate\(-1\.75 0\)"/);
  assert.match(svg, /y="13\.5" width="23\.5" height="1"/);
  assert.match(svg, /y1="74"[^>]*y2="39"[^>]*stroke-width="1\.2"/);

  for (const steps of [[0, 10, 0], [8, -2, 8]]) {
    const beamed = renderNotationSvg({ firstNoteX: 10, notes: steps.map((step) => ({ duration: 'sixteenth', beamGroup: 'a', step })) });
    const stems = [...beamed.matchAll(/<line x1="[\d.]+%" y1="(-?[\d.]+)" x2="[\d.]+%" y2="(-?[\d.]+)" transform="translate\(([-.\d]+) 0\)" stroke-width="1\.2"/g)];
    assert.equal(stems.length, 3);
    const stemUp = beamGroupStemUp(steps);
    for (const [i, stem] of stems.entries()) {
      const start = Number(stem[1]);
      const end = Number(stem[2]);
      const fraction = [0, 1 / 3, 2 / 3][i];
      const centerOffset = 10 * (1 - fraction);
      assert.ok(Math.abs(end - start) >= sp(2.5));
      assert.equal(end < start, stemUp);
      assert.ok(Math.abs(Number(stem[3]) - centerOffset - (stemUp ? 6.15 : -6.15)) < 1e-10);
    }
    const beams = beamSegments(beamed);
    assert.equal(beams.length, 2);
    assert.equal(beams[0].y1, Number(stems[0][2]));
    assert.equal(beams[0].y2, Number(stems[2][2]));
    assert.equal(beams[1].y1, Number(stems[0][2]) + (stemUp ? 1 : -1) * sp(0.75));
    assert.equal(beams[1].y2, Number(stems[2][2]) + (stemUp ? 1 : -1) * sp(0.75));
  }
});

test('beam group direction follows the majority of notes and the beam slope follows the pitch', () => {
  assert.equal(beamGroupStemUp([3, 5, 6]), false);
  assert.equal(beamGroupStemUp([0, 7, 2]), true);
  assert.equal(beamGroupStemUp([2, 4]), true);
  assert.equal(beamGroupStemUp([6, 4]), false);
  assert.equal(beamGroupStemUp([2, 6]), false);
  assert.equal(beamGroupStemUp([1, 6]), true);

  const svg = renderNotationSvg({
    firstNoteX: 10,
    notes: [3, 5, 6].map((step) => ({ duration: 'eighth', beamGroup: 'a', step }))
  });
  const stems = [...svg.matchAll(/<line x1="[\d.]+%" y1="(-?[\d.]+)" x2="[\d.]+%" y2="(-?[\d.]+)" transform="translate\(([-.\d]+) 0\)" stroke-width="1\.2"/g)];
  assert.equal(stems.length, 3);
  for (const stem of stems) {
    assert.ok(Number(stem[2]) > Number(stem[1]));
    assert.ok(Number(stem[3]) < 10 + 1);
  }
  assert.ok(Number(stems[0][2]) > Number(stems[2][2]));
  const beams = beamSegments(svg);
  assert.equal(beams.length, 1);
  assert.equal(beams[0].y1, Number(stems[0][2]));
  assert.equal(beams[0].y2, Number(stems[2][2]));
});

test('beams cover stem edges and are painted after stems', () => {
  for (const [duration, steps] of [
    ['eighth', [0, 3]], ['sixteenth', [7, 4]],
    ['sixteenth', [0, 7, 2]]
  ]) {
    const svg = renderNotationSvg({ firstNoteX: 10, notes: steps.map((step) => ({ duration, step, beamGroup: 'a' })) });
    const stems = [...svg.matchAll(/<line x1="([\d.]+)%" y1="(-?[\d.]+)" x2="[\d.]+%" y2="(-?[\d.]+)" transform="translate\(([-.\d]+) 0\)" stroke-width="1\.2" \/>/g)];
    const beams = beamSegments(svg);
    const primary = [beams[0]];
    assert.equal(stems.length, steps.length);
    assert.ok(beams.every((beam) => beam.thickness === sp(0.5) && beam.index > stems.at(-1).index));
    for (const beam of primary) {
      const start = stems[0];
      const end = stems[stems.length - 1];
      assert.equal(beam.start, beam.widthStart);
      assert.equal(beam.y1, Number(start[3]));
      assert.equal(beam.y2, Number(end[3]));
      for (const width of [180, 400]) {
        const stemX = (stem) => Number(stem[1]) * width / 100 + Number(stem[4]);
        assert.ok(Math.abs(beamX(beam.start, width) - (stemX(start) - sp(0.12) / 2)) < 1e-9);
        assert.ok(Math.abs(beamX(beam.end, width) - (stemX(end) + sp(0.12) / 2)) < 1e-9);
      }
    }
  }
});

test('stem directions, middle line and dot position follow the note step', () => {
  for (const [step, expectedStart, expectedEnd, offset, dotY] of [
    [-2, 74, 39, 6.15, 69], [3, 49, 14, 6.15, 49],
    [4, 44, 79, -6.15, 39], [5, 39, 74, -6.15, 39],
    [10, 14, 49, -6.15, 9]
  ]) {
    const svg = renderNotationSvg({ notes: [{ duration: 'quarter', step, dotted: true }], firstNoteX: 10 });
    assert.match(svg, new RegExp(`y1="${expectedStart}" x2="0%" y2="${expectedEnd}" transform="translate\\(${10 + offset} 0\\)"`));
    assert.match(svg, new RegExp(`cy="${dotY}" r="1\\.5" transform="translate\\(14\\.25 0\\)"`));
  }
  const svg = renderNotationSvg({ notes: [{ duration: 'quarter', step: 4, accidental: 'sharp' }] });
  assert.match(svg, /transform="translate\(-12\.75 0\)"><text class="notation-accidental"/);
});

test('minimum width preserves clear event spacing in narrow measures', () => {
  {
    const notes = [
      { duration: 'quarter', step: 2, dotted: true },
      { duration: 'quarter', step: 4, accidental: 'sharp' },
      { type: 'rest', duration: 'sixteenth' }
    ];
    const svg = renderNotationSvg({ notes, firstNoteX: 26 });
    const minWidth = Number(svg.match(/min-width:([\d.]+)px/)[1]);
    const grouped = [...svg.matchAll(/<g transform="translate\(([-.\d]+) 0\)"><text class="notation-(?:rest|note)" x="([\d.]+)%"/g)];
    const x = grouped.map((match) => Number(match[1]) + Number(match[2]) * minWidth / 100);
    assert.equal(x.length, 3);
    assert.ok(x[1] - x[0] >= 15.75 + 22.75 + sp(1) - 1e-9);
    assert.ok(x[2] - x[1] >= 6.75 + 6.5 + sp(1) - 1e-9);
  }
  const ledger = renderNotationSvg({ firstNoteX: 10, notes: [
    { duration: 'quarter', step: -2 },
    { duration: 'quarter', step: 10 }
  ] });
  const width = Number(ledger.match(/min-width:([\d.]+)px/)[1]);
  const heads = [...ledger.matchAll(/<g transform="translate\(([-.\d]+) 0\)"><text class="notation-note" x="([\d.]+)%"/g)];
  const centers = heads.map((match) => Number(match[1]) + Number(match[2]) * width / 100);
  assert.ok(centers[1] - centers[0] - 2 * (sp(1.35) / 2 + sp(0.5)) >= sp(1));
});

test('prefix and right bar have minimum clearances at narrow and wide widths', () => {
  for (const [prefix, prefixEnd] of [
    [{ clef: 'treble' }, 36],
    [{ clef: 'treble', timeSignature: { numerator: 4, denominator: 4 } }, 63]
  ]) {
    const notes = [{ duration: 'quarter', step: 2 }, { duration: 'quarter', step: 3, dotted: true }];
    const firstNoteX = minimumFirstNoteX({ ...prefix, notes });
    assert.ok(firstNoteX - sp(1.35) / 2 - prefixEnd >= sp(1.8));
    assert.ok(firstNoteX - sp(1.35) / 2 - prefixEnd <= sp(2));
    for (const ending of [{}, { rightBarStyle: 'final' }, { repeatEnd: true }]) {
      for (const aligned of [true, false]) {
        const svg = renderNotationSvg({ ...prefix, ...ending, notes, ...(aligned ? { firstNoteX } : {}) });
        const minWidth = Number(svg.match(/min-width:([\d.]+)px/)[1]);
        const heads = [...svg.matchAll(/<g transform="translate\(([-.\d]+) 0\)"><text class="notation-note" x="([\d.]+)%"/g)];
        assert.equal(heads.length, 2);
        for (const requestedWidth of [60, 400]) {
          const width = Math.max(requestedWidth, minWidth);
          const x = heads.map((head) => Number(head[1]) + Number(head[2]) * width / 100);
          const endingInset = ending.repeatEnd ? 16 : ending.rightBarStyle === 'final' ? 8 : 0;
          assert.ok(x[0] - sp(1.35) / 2 - prefixEnd >= sp(1.8) - 1e-9);
          assert.ok(width - endingInset - x[1] - 15.75 >= sp(1.5) - 1e-9);
        }
      }
    }
  }
});

test('a single whole note uses the normal start position while retaining bar clearance', () => {
  for (const prefix of [{}, { clef: 'treble', timeSignature: { numerator: 4, denominator: 4 } }]) {
    for (const dotted of [false, true]) {
      const notes = [{ duration: 'whole', step: 2, dotted }];
      const firstNoteX = minimumFirstNoteX({ ...prefix, notes });
      for (const aligned of [true, false]) {
        const svg = renderNotationSvg({ ...prefix, notes, rightBarStyle: 'final', ...(aligned ? { firstNoteX } : {}) });
        const minWidth = Number(svg.match(/min-width:([\d.]+)px/)[1]);
        const head = svg.match(/transform="translate\(([-.\d]+) 0\)"><text class="notation-note" x="([\d.]+)%"/);
        assert.ok(head);
        assert.equal(Number(head[2]), 0);
        const x = Number(head[1]);
        assert.equal(x, aligned ? firstNoteX : defaultFirstNoteX({ ...prefix, notes }));
        for (const requestedWidth of [50, 400]) {
          const width = Math.max(requestedWidth, minWidth);
          assert.ok(width - 8 - x - (dotted ? 15.75 : 6.75) >= sp(1) - 1e-9);
        }
      }
    }
  }
});

test('rests use shared glyphs, staff positions and optional dots', () => {
  for (const [duration, glyph, y] of [
    ['whole', '\uE4E3', 37], ['half', '\uE4E4', 46],
    ['quarter', '\uE4E5', 46], ['eighth', '\uE4E6', 46], ['sixteenth', '\uE4E7', 46]
  ]) {
    const rest = renderRest(duration, '50%', 46);
    assert.match(rest, new RegExp(`class="notation-rest" x="50%" y="${y}"[^>]*>${glyph}</text>`));
    assert.ok(restSymbols[duration].label);
    assert.doesNotMatch(rest, /<circle/);
    assert.match(renderRest(duration, 20, 46, true), /cx="20" cy="41\.5" r="1\.5"/);
  }
  assert.throws(() => renderRest('invalid', 0, 46), /Ungültiger Pausenwert/);
});

test('renderer supports mixed notes and rests and rejects invalid rest combinations', () => {
  const notes = [
    { duration: 'quarter', step: 2 },
    { type: 'rest', duration: 'eighth', dotted: true },
    { duration: 'eighth', step: 4 }
  ];
  const svg = renderNotationSvg({ clef: 'treble', notes });
  assert.match(svg, /Punktierte Achtelpause/);
  assert.equal((svg.match(/class="notation-rest"/g) ?? []).length, 1);
  assert.equal((svg.match(/class="notation-note"/g) ?? []).length, 3);
  assert.match(svg, /cy="39"/);
  assert.throws(() => renderNotationSvg({ notes: [{ type: 'rest', duration: 'quarter', step: 2 }] }), /Pausen dürfen/);
  assert.throws(() => renderNotationSvg({ notes: [{ type: 'rest', duration: 'eighth', beamGroup: 'a' }] }), /Pausen dürfen/);
  assert.throws(() => renderNotationSvg({ notes, curves: [{ from: 0, to: 1, type: 'slur' }] }), /nicht an Pausen/);
  assert.throws(() => renderNotationSvg({ notes, curves: [{ from: 1, to: 2, type: 'tie' }] }), /nicht an Pausen/);
  assert.throws(() => renderNotationSvg({ notes, curves: [{ from: 0, to: 2, type: 'tie' }] }), /keine Pause überspannen/);
  assert.doesNotThrow(() => renderNotationSvg({ notes, curves: [{ from: 0, to: 2, type: 'slur' }] }));
});

test('a whole-measure rest remains centered when first notes are aligned', () => {
  const standalone = renderNotationSvg({ notes: [{ type: 'rest', duration: 'whole' }] });
  assert.match(standalone, /transform="translate\(0 0\)"><text class="notation-rest" x="50%"/);
  const svg = renderNotationSvg({ notes: [{ type: 'rest', duration: 'whole' }], firstNoteX: 20 });
  assert.match(svg, /transform="translate\(10 0\)"><text class="notation-rest" x="50%"/);
  const dotted = renderNotationSvg({ notes: [{ type: 'rest', duration: 'whole', dotted: true }], firstNoteX: 20 });
  assert.match(dotted, /transform="translate\(20 0\)"><text class="notation-rest" x="0%"/);
});

test('single notes of every type use the default start after the prefix', () => {
  for (const note of [
    { duration: 'quarter', step: 2 },
    { duration: 'whole', step: 2 },
    { type: 'filled', step: 2 }
  ]) {
    const svg = renderNotationSvg({ clef: 'treble', notes: [note] });
    assert.match(svg, /transform="translate\(63 0\)"><text class="notation-note" x="0%"/);
    const minimumWidth = Number(svg.match(/min-width:([\d.]+)px/)[1]);
    assert.ok(minimumWidth >= 63 + sp(1.35) / 2 + sp(1));
  }
});

test('articulation and curves use caller-provided positions', () => {
  assert.equal(articulationPlacement(true, true), 'below');
  assert.equal(articulationPlacement(true, false), 'above');
  assert.equal(articulationPlacement(false, true), 'above');
  assert.equal(articulationPlacement(true, false, 'below'), 'above');
  assert.equal(articulationPlacement(true, true, 'below'), 'below');
  assert.equal(articulationPlacement(true, true, 'above'), 'above');
  assert.match(renderArticulation('marcato', 'below', 10, 20, 'music-articulation'), /x="10" y="20"/);
  assert.throws(() => validateCurves([{ from: 1, to: 1, type: 'tie' }], 2), /Ungültiger Bogen/);
  assert.match(renderCurve('slur', '10', '50', 80, 20, 30, true, 'music-curve'), /viewBox="0 0 100 80"/);
});

test('all articulations share the same clearance above and below noteheads', () => {
  assert.equal(articulationY(50, 'above', sp(0.75)), 42.5);
  assert.equal(articulationY(50, 'below', sp(0.75)), 57.5);
  for (const articulation of ['staccato', 'tenuto', 'accent', 'marcato']) {
    for (const [step, position, expectedY] of [[7, 'above', 16.5], [2, 'below', 66.5]]) {
      const svg = renderNotationSvg({ notes: [{ duration: 'quarter', step, articulation, articulationPosition: position }] });
      const match = svg.match(/class="notation-articulation"[^>]*y="([\d.]+)"/);
      assert.ok(match);
      assert.equal(Number(match[1]), expectedY);
    }
  }
  const stemSide = renderNotationSvg({ notes: [{ duration: 'quarter', step: 2, articulation: 'staccato', articulationPosition: 'above' }] });
  assert.match(stemSide, /class="notation-articulation"[^>]*y="11\.5"/);
});

test('bar and repeat signs use the caller supplied system geometry', () => {
  assert.match(renderRepeatStart(10, 0, 45), /x1="10" y1="0" x2="10" y2="45"/);
  assert.match(renderRepeatEnd('90%', '94%', '98%', 0, 45), /x1="98%" y1="0" x2="98%" y2="45"/);
  const boundary = renderRepeatEndAtBoundary(28, 64);
  assert.match(boundary, /x="100%" y="28" width="13" height="36"/);
  assert.match(boundary, /cx="2" cy="13\.5"/);
  assert.match(boundary, /cx="2" cy="22\.5"/);
  assert.match(boundary, /x1="5\.5" y1="0" x2="5\.5" y2="36"/);
  assert.match(boundary, /x1="11" y1="0" x2="11" y2="36" stroke-width="4"/);
});

test('repeat end replaces the ordinary right bar and reserves space for the final note', () => {
  const notes = Array.from({ length: 8 }, () => ({ duration: 'quarter', step: 2 }));
  const svg = renderNotationSvg({ notes, repeatEnd: true, showRightBar: true });
  assert.match(svg, /<svg x="100%" y="24" width="13" height="40"/);
  assert.doesNotMatch(svg, /<line x1="100%" y1="24" x2="100%" y2="64"/);
  const offsets = [...svg.matchAll(/<g transform="translate\(([-.\d]+) 0\)"><text class="notation-note"/g)];
  assert.equal(offsets.length, 8);
  const withoutRepeat = renderNotationSvg({ notes });
  const normalOffsets = [...withoutRepeat.matchAll(/<g transform="translate\(([-.\d]+) 0\)"><text class="notation-note"/g)];
  assert.ok(Math.abs(Number(normalOffsets[7][1]) - Number(offsets[7][1]) - 16 * 7 / 8) < 0.000001);
});

test('system layout repeats the original clef on every rendered line', () => {
  const measures = [{ clef: 'treble', id: 1 }, { clef: false, id: 2 }, { clef: false, id: 3 }];
  const systems = arrangeNotationSystems(measures, 2);
  assert.deepEqual(systems.map((system) => system.map((measure) => measure.clef)), [['treble', false], ['treble']]);
  assert.equal(systems[0][0].firstNoteX, systems[1][0].firstNoteX);
  assert.deepEqual(arrangeNotationSystems(measures, 1).map((system) => system[0].id), [1, 2, 3]);
  assert.deepEqual(
    arrangeNotationSystems([{ clef: 'treble' }, { clef: 'bass' }], 1).map((system) => system.map((m) => m.clef)),
    [['treble'], ['bass']]
  );
  assert.throws(() => arrangeNotationSystems(measures, 0), /mindestens einen Takt/);
});

test('key signatures persist across line breaks, changes and mixed system sizes', () => {
  const sharps = [{ type: 'sharp', step: 8 }, { type: 'sharp', step: 5 }];
  const flats = [{ type: 'flat', step: 4 }];
  const measures = [
    { clef: 'treble', accidentals: sharps },
    { clef: false },
    { clef: false },
    { clef: false, accidentals: flats },
    { clef: false },
    { clef: false, accidentals: [] },
    { clef: false },
    { clef: false, accidentals: sharps },
    { clef: false }
  ];
  const wide = arrangeNotationSystems(measures, [2, 2, 3, 2]);
  assert.deepEqual(wide[0].map((m) => m.accidentals), [sharps, undefined]);
  assert.deepEqual(wide[1][0].accidentals, sharps);
  assert.deepEqual(wide[1][1].accidentals, [
    { type: 'natural', step: 8 }, { type: 'natural', step: 5 }, ...flats
  ]);
  assert.deepEqual(wide[2].map((m) => m.accidentals), [flats, [{ type: 'natural', step: 4 }], undefined]);
  assert.deepEqual(wide[3].map((m) => m.accidentals), [sharps, undefined]);
  const narrow = arrangeNotationSystems(measures, 1);
  assert.deepEqual(narrow[2][0].accidentals, sharps);
  assert.deepEqual(narrow[3][0].accidentals, wide[1][1].accidentals);
  assert.deepEqual(narrow[5][0].accidentals, [{ type: 'natural', step: 4 }]);
  assert.deepEqual(narrow[6][0].accidentals, []);
  assert.throws(() => arrangeNotationSystems(measures, [2, 2]), /alle Takte umfassen/);
  assert.throws(() => arrangeNotationSystems([{ clef: 'treble', accidentals: [{ type: 'natural', step: 4 }] }], 1), /Tonartvorzeichnung/);
});

test('time signature precedes key signature and repeat marks without overlapping the first note', () => {
  const options = {
    clef: 'treble',
    accidentals: [{ type: 'sharp', step: 8 }, { type: 'sharp', step: 5 }],
    timeSignature: { numerator: 4, denominator: 4 },
    repeatStart: true,
    notes: [{ duration: 'quarter', step: 2 }]
  };
  const firstNoteX = minimumFirstNoteX(options);
  const svg = renderNotationSvg({ ...options, firstNoteX });
  const accidentalX = [...svg.matchAll(/class="notation-accidental" x="([\d.]+)"/g)].map((match) => Number(match[1]));
  const timeX = Number(svg.match(/class="notation-time" x="([\d.]+)"/)[1]);
  const repeatX = Number(svg.match(/<line x1="([\d.]+)" y1="24" x2="\1" y2="64" stroke-width="4"/)[1]);
  assert.ok(timeX > 6 && timeX < accidentalX[0]);
  assert.ok(accidentalX[0] < accidentalX[1] && accidentalX[1] + 18 <= repeatX && repeatX + 8 < firstNoteX);

  const withoutTime = { ...options, timeSignature: undefined };
  const repeatSvg = renderNotationSvg({ ...withoutTime, firstNoteX: minimumFirstNoteX(withoutTime) });
  const lastAccidentalX = [...repeatSvg.matchAll(/class="notation-accidental" x="([\d.]+)"/g)].map((match) => Number(match[1])).at(-1);
  const repeatWithoutTimeX = Number(repeatSvg.match(/<line x1="([\d.]+)" y1="24" x2="\1" y2="64" stroke-width="4"/)[1]);
  assert.ok(repeatWithoutTimeX - lastAccidentalX >= 18);
});

test('first notes align by measure column while leaving space for the widest prefix', () => {
  const notes = [{ duration: 'quarter', step: 2 }];
  const layouts = [
    [{ clef: 'treble', timeSignature: { numerator: 4, denominator: 4 }, accidentals: [{ type: 'sharp', step: 8 }, { type: 'sharp', step: 5 }], notes },
      { clef: false, notes }],
    [{ clef: 'treble', repeatStart: true, notes },
      { clef: false, notes: [{ duration: 'quarter', step: 2, accidental: 'sharp' }, ...notes] }],
    [{ clef: 'treble', timeSignature: { numerator: 3, denominator: 4 }, notes: [...notes, ...notes] },
      { clef: false, notes: [...notes, ...notes, ...notes] }]
  ];
  const aligned = alignFirstNotesInSystems(layouts);
  for (const column of [0, 1]) {
    const positions = aligned.map((system) => system[column].firstNoteX);
    assert.equal(new Set(positions).size, 1);
    assert.ok(positions[0] >= Math.max(...layouts.map((row) => minimumFirstNoteX({ ...row[column], clef: row[column].clef || undefined }))));
  }
  for (const system of aligned) {
    for (const measure of system) {
      const svg = renderNotationSvg({ ...measure, clef: measure.clef || undefined });
      assert.match(svg, new RegExp(`<g transform="translate\\(${measure.firstNoteX} 0\\)">`));
      assert.match(svg, /class="notation-note" x="0%"[^>]*text-anchor="middle"/);
    }
  }
  assert.throws(() => renderNotationSvg({ clef: 'treble', notes, firstNoteX: 10 }), /Abstand zum Taktanfang/);
});

test('mixed system lengths align their first events and share a safe inset in later measures', () => {
  const note = { duration: 'quarter', step: 2 };
  const rest = { type: 'rest', duration: 'quarter' };
  const systems = alignFirstNotesInSystems([
    [{ clef: 'treble', accidentals: [{ type: 'sharp', step: 8 }], notes: [note] },
      { clef: false, notes: [{ ...note, accidental: 'sharp' }, note] }],
    [{ clef: 'treble', timeSignature: { numerator: 4, denominator: 4 }, notes: [note, rest] },
      { clef: false, notes: [rest, note] }, { clef: false, notes: [rest, note] }]
  ]);
  assert.equal(systems[0][0].firstNoteX, systems[1][0].firstNoteX);
  assert.equal(systems[0][1].firstNoteX, systems[1][1].firstNoteX);
  assert.equal(systems[0][1].firstNoteX, systems[1][2].firstNoteX);
  assert.ok(systems[1][2].firstNoteX >= minimumFirstNoteX({ notes: [{ ...note, accidental: 'sharp' }] }));
  for (const measure of systems[1].slice(1)) {
    const svg = renderNotationSvg({ ...measure, clef: undefined });
    assert.match(svg, new RegExp(`<g transform="translate\\(${measure.firstNoteX} 0\\)"><text class="notation-rest" x="0%"`));
  }
});

test('notation renderer still enforces shared rules and renders their signs', () => {
  const notes = [
    { duration: 'quarter', step: 2 },
    { duration: 'eighth', step: 4, beamGroup: 'a', dotted: true },
    { duration: 'eighth', step: 6, beamGroup: 'a', articulation: 'marcato', articulationPosition: 'below' }
  ];
  assert.throws(() => renderNotationSvg({ notes, ritAt: 0, aTempoAt: 1 }), /mindestens zwei/);
  const svg = renderNotationSvg({ notes, clef: 'treble', timeSignature: { numerator: 4, denominator: 4 }, repeatStart: true, ritAt: 0, aTempoAt: 2 });
  assert.match(svg, /class="notation-time"/);
  assert.match(svg, /class="notation-tempo"[^>]*>rit\.<\/text>/);
  assert.match(svg, /class="notation-articulation"[^>]*><\/text>/);
  assert.match(svg, /r="1\.5"/);
});

test('normalizeNotationInput converts single-measure notes and inherits top-level context', () => {
  const notes = [{ duration: 'quarter', step: 2 }, { duration: 'quarter', step: 4 }];
  const single = normalizeNotationInput({ notes });
  assert.equal(single.length, 1);
  assert.equal(single[0].clef, 'treble');
  assert.equal(single[0].timeSignature, undefined);
  assert.equal(single[0].accidentals, undefined);
  assert.deepEqual(single[0].notes, notes);

  const sharps = [{ type: 'sharp', step: 8 }];
  const fourFour = { numerator: 4, denominator: 4 };
  const inherited = normalizeNotationInput({
    clef: 'bass',
    timeSignature: fourFour,
    accidentals: sharps,
    measures: [
      { notes },
      { notes: [{ duration: 'whole', step: 3 }] }
    ]
  });
  assert.equal(inherited.length, 2);
  assert.equal(inherited[0].clef, 'bass');
  assert.deepEqual(inherited[0].timeSignature, fourFour);
  assert.deepEqual(inherited[0].accidentals, sharps);
  assert.equal(inherited[1].clef, undefined);
  assert.equal(inherited[1].timeSignature, undefined);
  assert.equal(inherited[1].accidentals, undefined);
});

test('measureWidth supports equal and rhythmic column weights', () => {
  const sparseMeasure = {
    clef: 'treble',
    timeSignature: { numerator: 4, denominator: 4 },
    notes: [{ duration: 'whole', step: 2 }]
  };
  const denseMeasure = {
    notes: Array.from({ length: 8 }, (_, i) => ({
      duration: 'eighth',
      step: (i % 4) + 2,
      beamGroup: i < 4 ? 'a' : 'b'
    }))
  };

  const equalSystems = arrangeNotationSystems([sparseMeasure, denseMeasure], 2, { measureWidth: 'equal' });
  assert.deepEqual(equalSystems[0].map((m) => m.columnWeight), [1, 1]);

  const rhythmicSystems = arrangeNotationSystems([sparseMeasure, denseMeasure], 2, { measureWidth: 'rhythmic' });
  assert.ok(rhythmicSystems[0][1].columnWeight > rhythmicSystems[0][0].columnWeight);
  assert.equal(rhythmicSystems[0][0].columnWeight, rhythmicSystems[0][0].minWidth);
  assert.equal(rhythmicSystems[0][1].columnWeight, rhythmicSystems[0][1].minWidth);
});

test('layout="auto" wraps systems based on summed minimum measure widths', () => {
  const notes = Array.from({ length: 4 }, () => ({ duration: 'quarter', step: 2 }));
  const measures = [
    { clef: 'treble', timeSignature: { numerator: 4, denominator: 4 }, notes },
    { notes },
    { notes },
    { notes }
  ];
  const singleMin = estimateMeasureMinWidth({ notes });
  const twoMeasureBudget = estimateMeasureMinWidth(measures[0]) + singleMin + 10;

  const autoWrapped = arrangeNotationSystems(measures, 'auto', { maxSystemWidth: twoMeasureBudget });
  assert.equal(autoWrapped.length, 2);
  assert.deepEqual(autoWrapped.map((row) => row.length), [2, 2]);
  assert.equal(autoWrapped[1][0].clef, 'treble');

  const wideWrapped = arrangeNotationSystems(measures, 'auto', { maxSystemWidth: 1200 });
  assert.equal(wideWrapped.length, 1);
  assert.equal(wideWrapped[0].length, 4);
});

test('incomplete last system row is proportionally bounded for justification', () => {
  const notes = [{ duration: 'quarter', step: 2 }, { duration: 'quarter', step: 4 }];
  const measures = [
    { clef: 'treble', notes },
    { notes },
    { notes }
  ];

  const equalRows = layoutNotationSystems({
    measures,
    layout: 2,
    measureWidth: 'equal'
  });
  assert.equal(equalRows.length, 2);
  assert.equal(equalRows[0].widthRatio, 1);
  assert.equal(equalRows[1].widthRatio, 0.5);

  const rhythmicRows = layoutNotationSystems({
    measures,
    layout: 2,
    measureWidth: 'rhythmic'
  });
  assert.equal(rhythmicRows[0].widthRatio, 1);
  assert.ok(rhythmicRows[1].widthRatio >= 0.5 && rhythmicRows[1].widthRatio < 1);

  const singleRow = layoutNotationSystems({ notes });
  assert.equal(singleRow.length, 1);
  assert.equal(singleRow[0].widthRatio, 1);
});

test('pickup scales pickup and closing measures so their weights sum to one full measure', () => {
  const fourQuarters = Array.from({ length: 4 }, () => ({ duration: 'quarter', step: 2 }));
  const measures = [
    { notes: [{ duration: 'quarter', step: 2 }] },
    { measureNumber: 1, notes: fourQuarters },
    { measureNumber: 2, repeatStart: true, repeatEnd: true, notes: fourQuarters },
    { measureNumber: 3, rightBarStyle: 'final', notes: [{ duration: 'half', step: 5, dotted: true }] }
  ];

  const equalRows = layoutNotationSystems({
    clef: 'treble',
    timeSignature: { numerator: 4, denominator: 4 },
    pickup: true,
    layout: [2, 2],
    measureWidth: 'equal',
    measures
  });
  assert.deepEqual(equalRows[0].columnWeights, [25, 100]);
  assert.deepEqual(equalRows[1].columnWeights, [100, 75]);
  assert.equal(equalRows[0].columnWeights[0] + equalRows[1].columnWeights[1], 100);

  const rhythmicRows = layoutNotationSystems({
    clef: 'treble',
    timeSignature: { numerator: 4, denominator: 4 },
    pickup: true,
    layout: [2, 2],
    measureWidth: 'rhythmic',
    measures
  });
  const pickupWeight = rhythmicRows[0].columnWeights[0];
  const closingWeight = rhythmicRows[1].columnWeights[1];
  assert.ok(Math.abs(closingWeight - pickupWeight * 3) <= 2);
});

test('note dynamics and measure hairpins render independently in SVG', () => {
  const onlyHairpin = renderNotationSvg({
    hairpin: 'crescendo',
    notes: [
      { duration: 'quarter', step: -2 },
      { duration: 'quarter', step: 1 }
    ]
  });
  assert.match(onlyHairpin, /class="notation-hairpin crescendo"/);
  assert.doesNotMatch(onlyHairpin, /class="notation-dynamic"/);

  const onlyDynamics = renderNotationSvg({
    notes: [
      { duration: 'quarter', step: -2, dynamic: 'p' },
      { duration: 'quarter', step: 1, dynamic: 'f' }
    ]
  });
  assert.doesNotMatch(onlyDynamics, /class="notation-hairpin/);
  assert.equal((onlyDynamics.match(/class="notation-dynamic"/g) ?? []).length, 2);

  const combined = renderNotationSvg({
    hairpin: { type: 'decrescendo', from: 0, to: 1 },
    notes: [
      { duration: 'quarter', step: 2, dynamic: 'f' },
      { duration: 'quarter', step: 0, dynamic: 'p' }
    ]
  });
  assert.match(combined, /class="notation-hairpin decrescendo"/);
  assert.equal((combined.match(/class="notation-dynamic"/g) ?? []).length, 2);

  const multiMeasureRows = layoutNotationSystems({
    clef: 'treble',
    timeSignature: { numerator: 4, denominator: 4 },
    layout: 2,
    measures: [
      {
        notes: [
          { duration: 'quarter', step: -2, dynamic: 'p', hairpinStart: 'crescendo' },
          { duration: 'quarter', step: -1 },
          { duration: 'quarter', step: 0 },
          { duration: 'quarter', step: 1 }
        ]
      },
      {
        notes: [
          { duration: 'quarter', step: 2 },
          { duration: 'quarter', step: 3, dynamic: 'f', hairpinEnd: true, hairpinStart: 'decrescendo' },
          { duration: 'quarter', step: 2 },
          { duration: 'quarter', step: 0, dynamic: 'p', hairpinEnd: true }
        ]
      }
    ]
  });
  const m1Hairpins = multiMeasureRows[0].measures[0].hairpins;
  const m2Hairpins = multiMeasureRows[0].measures[1].hairpins;
  assert.equal(m1Hairpins.length, 1);
  assert.equal(m2Hairpins.length, 2);
  assert.equal(m1Hairpins[0].toBarline, true);
  assert.equal(m2Hairpins[0].fromBarline, true);
  assert.equal(m1Hairpins[0].endOpen, m2Hairpins[0].startOpen);

  const extendedDynamics = renderNotationSvg({
    notes: [
      { duration: 'quarter', step: 0, dynamic: 'sfz' },
      { duration: 'quarter', step: 1, dynamic: 'fp' },
      { duration: 'quarter', step: 2, dynamic: 'cresc.' },
      { duration: 'quarter', step: 3, dynamic: 'p', dynamicText: 'dolce' }
    ]
  });
  assert.equal((extendedDynamics.match(/class="notation-dynamic"/g) ?? []).length, 3);
  assert.match(extendedDynamics, /class="notation-dynamic-text"[^>]*>cresc\.<\/text>/);
  assert.match(extendedDynamics, /class="notation-dynamic-text"[^>]*>dolce<\/text>/);

  const clefChangeRows = layoutNotationSystems({
    layout: 1,
    measures: [
      { clef: 'treble', notes: [{ duration: 'whole', step: -2 }] },
      { clef: 'bass', notes: [{ duration: 'whole', step: 10 }] }
    ]
  });
  assert.equal(clefChangeRows[0].measures[0].clef, 'treble');
  assert.equal(clefChangeRows[1].measures[0].clef, 'bass');
});

test('measureNumberOffset places measure numbers after clef, meter, accidentals and repeatStart', () => {
  const sharps = [{ type: 'sharp', step: 8 }, { type: 'sharp', step: 5 }];
  const fourFour = { numerator: 4, denominator: 4 };
  assert.equal(measureNumberOffset(), 4);
  assert.equal(measureNumberOffset({ clef: 'treble' }), 36);
  assert.equal(measureNumberOffset({ clef: 'treble', accidentals: sharps }), 60);
  assert.equal(
    measureNumberOffset({ clef: 'treble', timeSignature: fourFour, accidentals: sharps }),
    87,
  );
  assert.equal(
    measureNumberOffset({ clef: 'treble', accidentals: sharps, repeatStart: true }),
    78,
  );
  assert.equal(measureNumberOffset({ repeatStart: true }), 12);
});


