import { test } from 'vitest';
import assert from 'node:assert/strict';
import { articulationPlacement, articulationY, renderArticulation } from '../src/lib/articulation.ts';
import { renderRepeatEnd, renderRepeatEndAtBoundary, renderRepeatStart } from '../src/lib/barline.ts';
import { renderCurve, validateCurves } from '../src/lib/curve.ts';
import { dynamicsForHairpin } from '../src/lib/dynamics.ts';
import { collectBeamGroups, flagGlyph, renderDot, rhythmicPositions } from '../src/lib/rhythm.ts';
import { renderRest, restSymbols } from '../src/lib/rest.ts';
import { renderTempoMark, validateTempoChanges } from '../src/lib/tempo.ts';
import { omitUnchangedTimeSignatures, renderTimeSignature, validateTimeSignature } from '../src/lib/time-signature.ts';
import { minimumFirstNoteX, renderNotationSvg } from '../src/lib/notation-renderer.ts';
import { alignFirstNotesInSystems, arrangeNotationSystems } from '../src/components/notation/system-layout.ts';

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
  assert.deepEqual(rhythmicPositions(events), [0, 1 / 6, 4 / 6]);
  assert.deepEqual(rhythmicPositions([{ duration: 'sixteenth', dotted: true }, { duration: 'sixteenth' }]), [0, 0.6]);
  assert.deepEqual(rhythmicPositions([]), []);
  assert.equal(rhythmicPositions([{ duration: 'quarter' }, {}]), undefined);
  assert.throws(() => rhythmicPositions([{ duration: 'invalid' }]), /Ungültiger Noten- oder Pausenwert/);
});

test('renderer places timed events proportionally and preserves equal-spacing examples', () => {
  const notes = [
    { type: 'rest', duration: 'eighth' },
    { duration: 'quarter', step: 3, dotted: true },
    { duration: 'quarter', step: 2 }
  ];
  const positions = (svg) => [...svg.matchAll(/class="notation-(?:rest|note)" x="([\d.]+)%"/g)].map((match) => Number(match[1]));
  const svg = renderNotationSvg({ notes, firstNoteX: 26, rightBarStyle: 'final' });
  const actual = positions(svg);
  assert.equal(actual.length, 3);
  for (const [actualValue, expected] of actual.map((value, index) => [value, [0, 100 / 6, 400 / 6][index]])) {
    assert.ok(Math.abs(actualValue - expected) < 1e-10);
  }
  const grouped = [...svg.matchAll(/<g transform="translate\(([-.\d]+) 0\)"><text class="notation-(?:rest|note)" x="([\d.]+)%"/g)];
  const x = grouped.map((match) => Number(match[1]) + Number(match[2]) * 3);
  const distances = [x[1] - x[0], x[2] - x[1], 300 - x[2]];
  assert.ok(Math.abs(distances[1] / distances[0] - 3) < 1e-10);
  assert.ok(Math.abs(distances[2] / distances[0] - 2) < 1e-10);
  const equal = positions(renderNotationSvg({ notes, firstNoteX: 26, spacing: 'equal' }));
  assert.deepEqual(equal, [0, (1 / 3) * 100, (2 / 3) * 100]);
  const unaligned = positions(renderNotationSvg({ notes }));
  assert.deepEqual(unaligned, [25, 37.5, 75]);
  const untimed = renderNotationSvg({ notes: [{ type: 'filled', step: 2 }, { type: 'empty', step: 3 }] });
  assert.deepEqual(positions(untimed), [(1 / 3) * 100, (2 / 3) * 100]);
});

test('beam stems follow their rhythmic x positions with dotted notes', () => {
  const notes = [
    { duration: 'eighth', step: 0, dotted: true, beamGroup: 'a' },
    { duration: 'eighth', step: 1, beamGroup: 'a' },
    { duration: 'eighth', step: 2, beamGroup: 'a' }
  ];
  const svg = renderNotationSvg({ notes, firstNoteX: 10 });
  const stems = [...svg.matchAll(/<line x1="[\d.]+%" y1="[\d.]+?" x2="[\d.]+%" y2="([\d.]+)" transform="translate\([^)]+\)" \/>/g)];
  assert.equal(stems.length, 3);
  assert.ok(Math.abs(Number(stems[1][1]) - 27.1) < 1e-10);
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
  assert.match(svg, /cy="41\.5"/);
  assert.throws(() => renderNotationSvg({ notes: [{ type: 'rest', duration: 'quarter', step: 2 }] }), /Pausen dürfen/);
  assert.throws(() => renderNotationSvg({ notes: [{ type: 'rest', duration: 'eighth', beamGroup: 'a' }] }), /Pausen dürfen/);
  assert.throws(() => renderNotationSvg({ notes, curves: [{ from: 0, to: 1, type: 'slur' }] }), /nicht an Pausen/);
  assert.throws(() => renderNotationSvg({ notes, curves: [{ from: 1, to: 2, type: 'tie' }] }), /nicht an Pausen/);
  assert.throws(() => renderNotationSvg({ notes, curves: [{ from: 0, to: 2, type: 'tie' }] }), /keine Pause überspannen/);
  assert.doesNotThrow(() => renderNotationSvg({ notes, curves: [{ from: 0, to: 2, type: 'slur' }] }));
});

test('a whole-measure rest remains centered when first notes are aligned', () => {
  const svg = renderNotationSvg({ notes: [{ type: 'rest', duration: 'whole' }], firstNoteX: 20 });
  assert.match(svg, /transform="translate\(10 0\)"><text class="notation-rest" x="50%"/);
  const dotted = renderNotationSvg({ notes: [{ type: 'rest', duration: 'whole', dotted: true }], firstNoteX: 20 });
  assert.match(dotted, /transform="translate\(20 0\)"><text class="notation-rest" x="0%"/);
});

test('articulation and curves use caller-provided positions', () => {
  assert.equal(articulationPlacement(true, false, 'below'), 'above');
  assert.equal(articulationPlacement(true, true, 'below'), 'below');
  assert.match(renderArticulation('marcato', 'below', 10, 20, 'music-articulation'), /x="10" y="20"/);
  assert.throws(() => validateCurves([{ from: 1, to: 1, type: 'tie' }], 2), /Ungültiger Bogen/);
  assert.match(renderCurve('slur', '10', '50', 80, 20, 30, true, 'music-curve'), /viewBox="0 0 100 80"/);
});

test('all articulations share the same clearance above and below noteheads', () => {
  assert.equal(articulationY(50, 'above'), 44);
  assert.equal(articulationY(50, 'below'), 56);
  for (const articulation of ['staccato', 'tenuto', 'accent', 'marcato']) {
    for (const [step, position, expectedY] of [[7, 'above', 22], [2, 'below', 65.5]]) {
      const svg = renderNotationSvg({ notes: [{ duration: 'quarter', step, articulation, articulationPosition: position }] });
      const match = svg.match(/class="notation-articulation"[^>]*y="([\d.]+)"/);
      assert.ok(match);
      assert.equal(Number(match[1]), expectedY);
    }
  }
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
  assert.match(svg, /<svg x="100%" y="28" width="13" height="36"/);
  assert.doesNotMatch(svg, /<line x1="100%" y1="28" x2="100%" y2="64"/);
  const offsets = [...svg.matchAll(/<g transform="translate\(([-.\d]+) 0\)"><text class="notation-note"/g)];
  assert.equal(offsets.length, 8);
  assert.ok(Math.abs(Number(offsets[7][1]) + 16 * 8 / 9) < 0.000001);
});

test('system layout repeats the original clef on every rendered line', () => {
  const measures = [{ clef: 'treble', id: 1 }, { clef: false, id: 2 }, { clef: false, id: 3 }];
  const systems = arrangeNotationSystems(measures, 2);
  assert.deepEqual(systems.map((system) => system.map((measure) => measure.clef)), [['treble', false], ['treble']]);
  assert.equal(systems[0][0].firstNoteX, systems[1][0].firstNoteX);
  assert.deepEqual(arrangeNotationSystems(measures, 1).map((system) => system[0].id), [1, 2, 3]);
  assert.throws(() => arrangeNotationSystems([{ clef: 'treble' }, { clef: 'bass' }], 1), /Notenschlüsselwechsel/);
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
  const repeatX = Number(svg.match(/<line x1="([\d.]+)" y1="28" x2="\1" y2="64" stroke-width="4"/)[1]);
  assert.ok(timeX > 6 && timeX < accidentalX[0]);
  assert.ok(accidentalX[0] < accidentalX[1] && accidentalX[1] + 18 <= repeatX && repeatX + 8 < firstNoteX);

  const withoutTime = { ...options, timeSignature: undefined };
  const repeatSvg = renderNotationSvg({ ...withoutTime, firstNoteX: minimumFirstNoteX(withoutTime) });
  const lastAccidentalX = [...repeatSvg.matchAll(/class="notation-accidental" x="([\d.]+)"/g)].map((match) => Number(match[1])).at(-1);
  const repeatWithoutTimeX = Number(repeatSvg.match(/<line x1="([\d.]+)" y1="28" x2="\1" y2="64" stroke-width="4"/)[1]);
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
