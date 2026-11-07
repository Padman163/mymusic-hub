import test from 'node:test';
import assert from 'node:assert/strict';
import { articulationPlacement, renderArticulation } from '../src/components/music/articulation.ts';
import { renderRepeatEnd, renderRepeatStart } from '../src/components/music/barline.ts';
import { renderCurve, validateCurves } from '../src/components/music/curve.ts';
import { dynamicsForHairpin } from '../src/components/music/dynamics.ts';
import { collectBeamGroups, flagGlyph, renderDot } from '../src/components/music/rhythm.ts';
import { renderTempoMark, validateTempoChanges } from '../src/components/music/tempo.ts';
import { omitUnchangedTimeSignatures, renderTimeSignature, validateTimeSignature } from '../src/components/music/time-signature.ts';
import { renderNotationSvg } from '../src/lib/notation-renderer.ts';
import { arrangeNotationSystems } from '../src/components/notation/system-layout.ts';

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

test('articulation and curves use caller-provided positions', () => {
  assert.equal(articulationPlacement(true, false, 'below'), 'above');
  assert.equal(articulationPlacement(true, true, 'below'), 'below');
  assert.match(renderArticulation('marcato', 'below', 10, 20, 'music-articulation'), /x="10" y="20"/);
  assert.throws(() => validateCurves([{ from: 1, to: 1, type: 'tie' }], 2), /Ungültiger Bogen/);
  assert.match(renderCurve('slur', '10', '50', 80, 20, 30, true, 'music-curve'), /viewBox="0 0 100 80"/);
});

test('bar and repeat signs use the caller supplied system geometry', () => {
  assert.match(renderRepeatStart(10, 0, 45), /x1="10" y1="0" x2="10" y2="45"/);
  assert.match(renderRepeatEnd('90%', '94%', '98%', 0, 45), /x1="98%" y1="0" x2="98%" y2="45"/);
});

test('system layout repeats the original clef on every rendered line', () => {
  const measures = [{ clef: 'treble', id: 1 }, { clef: false, id: 2 }, { clef: false, id: 3 }];
  const systems = arrangeNotationSystems(measures, 2);
  assert.deepEqual(systems.map((system) => system.map((measure) => measure.clef)), [['treble', false], ['treble']]);
  assert.deepEqual(arrangeNotationSystems(measures, 1).map((system) => system[0].id), [1, 2, 3]);
  assert.throws(() => arrangeNotationSystems([{ clef: 'treble' }, { clef: 'bass' }], 1), /Notenschlüsselwechsel/);
  assert.throws(() => arrangeNotationSystems(measures, 0), /mindestens einen Takt/);
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
