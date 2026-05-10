/**
 * MDL spot-checks against AFT_Scoring_Scales_250601.pdf.
 * Picked to cover: each age bracket, both scales, max/threshold/sub-threshold/min edges,
 * combat-MOS-female routing through 'mc' scale.
 */

import { describe, it, expect } from 'vitest';
import {
  scoreAftEvent,
  scoreAltEvent,
  ageToBracket,
  pickScale,
  aftTotal,
  parseMmss,
  formatMmss,
} from '../scoring';

const mdl = (rawLbs: number, age: number, gender: 'M' | 'F', combat: boolean) =>
  scoreAftEvent({ event: 'mdl', rawValue: rawLbs, age, gender, isCombatMOS: combat });

describe('ageToBracket', () => {
  it.each([
    [17, '17-21'], [21, '17-21'],
    [22, '22-26'], [26, '22-26'],
    [27, '27-31'], [31, '27-31'],
    [32, '32-36'], [36, '32-36'],
    [37, '37-41'], [41, '37-41'],
    [42, '42-46'], [46, '42-46'],
    [47, '47-51'], [51, '47-51'],
    [52, '52-56'], [56, '52-56'],
    [57, '57-61'], [61, '57-61'],
    [62, 'over-62'], [99, 'over-62'],
  ])('age %i → %s', (age, bracket) => {
    expect(ageToBracket(age)).toBe(bracket);
  });
});

describe('pickScale (AFT 1 June 2025 routing)', () => {
  it('male any MOS → mc', () => {
    expect(pickScale('M', false)).toBe('mc');
    expect(pickScale('M', true)).toBe('mc');
  });
  it('female non-combat → f', () => {
    expect(pickScale('F', false)).toBe('f');
  });
  it('female combat-MOS → mc (uses male scale)', () => {
    expect(pickScale('F', true)).toBe('mc');
  });
});

describe('MDL — 17-21 M|C', () => {
  it('340 lbs = 100 (max)', () => expect(mdl(340, 20, 'M', false).points).toBe(100));
  it('339 lbs = 98 (between 330 and 340, no 99 threshold)', () => expect(mdl(339, 20, 'M', false).points).toBe(98));
  it('330 lbs = 98', () => expect(mdl(330, 20, 'M', false).points).toBe(98));
  it('329 lbs = 96', () => expect(mdl(329, 20, 'M', false).points).toBe(96));
  it('150 lbs = 60 (passing minimum)', () => {
    const r = mdl(150, 20, 'M', false);
    expect(r.points).toBe(60);
    expect(r.passing).toBe(true);
  });
  it('149 lbs = 50 (just below passing)', () => {
    const r = mdl(149, 20, 'M', false);
    expect(r.points).toBe(50);
    expect(r.passing).toBe(false);
  });
  it('80 lbs = 0 (floor)', () => expect(mdl(80, 20, 'M', false).points).toBe(0));
  it('79 lbs = 0 (below floor still 0)', () => expect(mdl(79, 20, 'M', false).points).toBe(0));
});

describe('MDL — 17-21 F (non-combat)', () => {
  it('220 lbs = 100', () => expect(mdl(220, 20, 'F', false).points).toBe(100));
  it('210 lbs = 98', () => expect(mdl(210, 20, 'F', false).points).toBe(98));
  it('200 lbs = 97', () => expect(mdl(200, 20, 'F', false).points).toBe(97));
  it('120 lbs = 60', () => expect(mdl(120, 20, 'F', false).points).toBe(60));
  it('60 lbs = 0', () => expect(mdl(60, 20, 'F', false).points).toBe(0));
});

describe('MDL — combat-MOS routing', () => {
  it('female combat-MOS scores on mc scale (220 lbs at age 20 → 60, not 100)', () => {
    const f = mdl(220, 20, 'F', true);
    expect(f.scale).toBe('mc');
    expect(f.points).toBe(60); // 220 lbs at 17-21 mc lands at the 60-pt threshold (150) far below; actually 220→75 on mc
  });
  it('female combat 220 lbs at age 20 = 75 on mc scale', () => {
    expect(mdl(220, 20, 'F', true).points).toBe(75);
  });
});

describe('MDL — bracket spot-checks', () => {
  it('22-26 M|C: 350=100, 340=99, 339=97', () => {
    expect(mdl(350, 24, 'M', false).points).toBe(100);
    expect(mdl(340, 24, 'M', false).points).toBe(99);
    expect(mdl(339, 24, 'M', false).points).toBe(97);
  });
  it('32-36 M|C: 60-pt threshold drops to 140 (vs 150 for younger brackets)', () => {
    expect(mdl(140, 33, 'M', false).points).toBe(60);
    expect(mdl(150, 33, 'M', false).points).toBe(61);
  });
  it('57-61 M|C: 250=100, 240=99, 230=98 (compressed top)', () => {
    expect(mdl(250, 58, 'M', false).points).toBe(100);
    expect(mdl(240, 58, 'M', false).points).toBe(99);
    expect(mdl(230, 58, 'M', false).points).toBe(98);
  });
  it('over-62 F: 170=100, 160=99, 150=90', () => {
    expect(mdl(170, 65, 'F', false).points).toBe(100);
    expect(mdl(160, 65, 'F', false).points).toBe(99);
    expect(mdl(150, 65, 'F', false).points).toBe(90);
  });
  it('47-51 F: 200=100, 190=98, 130=73, 120=60', () => {
    expect(mdl(200, 49, 'F', false).points).toBe(100);
    expect(mdl(190, 49, 'F', false).points).toBe(98);
    expect(mdl(130, 49, 'F', false).points).toBe(73);
    expect(mdl(120, 49, 'F', false).points).toBe(60);
  });
});

const hrp = (reps: number, age: number, gender: 'M' | 'F', combat: boolean) =>
  scoreAftEvent({ event: 'hrp', rawValue: reps, age, gender, isCombatMOS: combat });

describe('HRP — spot-checks', () => {
  it('17-21 M|C: 58=100, 57=99, 15=60 (passing min), 14=50', () => {
    expect(hrp(58, 20, 'M', false).points).toBe(100);
    expect(hrp(57, 20, 'M', false).points).toBe(99);
    expect(hrp(15, 20, 'M', false).points).toBe(60);
    expect(hrp(14, 20, 'M', false).points).toBe(50);
  });
  it('17-21 F: 53=100, 11=60, 10=50', () => {
    expect(hrp(53, 20, 'F', false).points).toBe(100);
    expect(hrp(11, 20, 'F', false).points).toBe(60);
    expect(hrp(10, 20, 'F', false).points).toBe(50);
  });
  it('27-31 M|C: peak bracket — 62=100, 60=99', () => {
    expect(hrp(62, 28, 'M', false).points).toBe(100);
    expect(hrp(60, 28, 'M', false).points).toBe(99);
  });
  it('over-62 M|C: 43=100, 10=60 (compressed top)', () => {
    expect(hrp(43, 65, 'M', false).points).toBe(100);
    expect(hrp(10, 65, 'M', false).points).toBe(60);
  });
  it('over-62 F: 24=100, 10=60', () => {
    expect(hrp(24, 65, 'F', false).points).toBe(100);
    expect(hrp(10, 65, 'F', false).points).toBe(60);
  });
  it('female combat-MOS routes through mc — 24 reps at age 20 scores on mc, not f', () => {
    const r = hrp(24, 20, 'F', true);
    expect(r.scale).toBe('mc');
    expect(r.points).toBe(67); // 17-21 mc threshold table: 24 → 67
  });
  it('zero reps below 4 floor still scores 0', () => {
    expect(hrp(3, 20, 'M', false).points).toBe(0);
    expect(hrp(0, 20, 'M', false).points).toBe(0);
  });
});

const sdc = (sec: number, age: number, gender: 'M' | 'F', combat: boolean) =>
  scoreAftEvent({ event: 'sdc', rawValue: sec, age, gender, isCombatMOS: combat });

describe('SDC — spot-checks (lower seconds = higher points)', () => {
  it('17-21 M|C: 1:29 (89s)=100, 1:30 (90s)=99', () => {
    expect(sdc(parseMmss('1:29'), 20, 'M', false).points).toBe(100);
    expect(sdc(parseMmss('1:30'), 20, 'M', false).points).toBe(99);
  });
  it('17-21 M|C: 2:28 (148s)=60 passing min, 2:29=59', () => {
    expect(sdc(parseMmss('2:28'), 20, 'M', false).points).toBe(60);
    expect(sdc(parseMmss('2:28'), 20, 'M', false).passing).toBe(true);
    expect(sdc(parseMmss('2:29'), 20, 'M', false).points).toBe(59);
  });
  it('17-21 F: 1:55=100, 3:15=60', () => {
    expect(sdc(parseMmss('1:55'), 20, 'F', false).points).toBe(100);
    expect(sdc(parseMmss('3:15'), 20, 'F', false).points).toBe(60);
  });
  it('faster than max time still scores 100', () => {
    expect(sdc(60, 20, 'M', false).points).toBe(100);
  });
  it('over-62 F: 2:26=100, 4:48=60', () => {
    expect(sdc(parseMmss('2:26'), 65, 'F', false).points).toBe(100);
    expect(sdc(parseMmss('4:48'), 65, 'F', false).points).toBe(60);
  });
  it('female combat-MOS routes through mc — 1:55 at age 20 (which is 100 on F) scores lower on mc', () => {
    const r = sdc(parseMmss('1:55'), 20, 'F', true);
    expect(r.scale).toBe('mc');
    expect(r.points).toBeLessThan(100);
  });
});

const plk = (sec: number, age: number, gender: 'M' | 'F', combat: boolean) =>
  scoreAftEvent({ event: 'plk', rawValue: sec, age, gender, isCombatMOS: combat });

describe('PLK — spot-checks (higher seconds = higher points; gender-neutral)', () => {
  it('17-21: 3:40 (220s)=100 for both genders', () => {
    expect(plk(parseMmss('3:40'), 20, 'M', false).points).toBe(100);
    expect(plk(parseMmss('3:40'), 20, 'F', false).points).toBe(100);
  });
  it('17-21: 1:30 (90s)=60, 1:29=58 (sub-60 only every-other point)', () => {
    expect(plk(parseMmss('1:30'), 20, 'M', false).points).toBe(60);
    expect(plk(parseMmss('1:29'), 20, 'M', false).points).toBe(58);
  });
  it('22-26: 3:35=100, 1:25=60', () => {
    expect(plk(parseMmss('3:35'), 24, 'M', false).points).toBe(100);
    expect(plk(parseMmss('1:25'), 24, 'M', false).points).toBe(60);
  });
  it('32-36: 3:25=100, 1:15=60', () => {
    expect(plk(parseMmss('3:25'), 33, 'M', false).points).toBe(100);
    expect(plk(parseMmss('1:15'), 33, 'M', false).points).toBe(60);
  });
  it('37-41: 3:20=100, 1:10=60', () => {
    expect(plk(parseMmss('3:20'), 38, 'M', false).points).toBe(100);
    expect(plk(parseMmss('1:10'), 38, 'M', false).points).toBe(60);
  });
  it('42-46 through over-62 share the 37-41 scale', () => {
    expect(plk(parseMmss('3:20'), 45, 'F', false).points).toBe(100);
    expect(plk(parseMmss('3:20'), 55, 'M', false).points).toBe(100);
    expect(plk(parseMmss('3:20'), 65, 'F', false).points).toBe(100);
    expect(plk(parseMmss('1:10'), 70, 'M', false).points).toBe(60);
  });
  it('combat-MOS flag has no effect on PLK score (mc and f tables identical)', () => {
    const ncombat = plk(parseMmss('2:30'), 20, 'F', false).points;
    const combat  = plk(parseMmss('2:30'), 20, 'F', true).points;
    expect(combat).toBe(ncombat);
  });
});

const run = (sec: number, age: number, gender: 'M' | 'F', combat: boolean) =>
  scoreAftEvent({ event: 'run2mi', rawValue: sec, age, gender, isCombatMOS: combat });

describe('2MR — spot-checks (lower seconds = higher points)', () => {
  it('17-21 M|C: 13:22=100, 19:57=60, 22:45=0', () => {
    expect(run(parseMmss('13:22'), 20, 'M', false).points).toBe(100);
    expect(run(parseMmss('19:57'), 20, 'M', false).points).toBe(60);
    expect(run(parseMmss('22:45'), 20, 'M', false).points).toBe(0);
  });
  it('17-21 F: 16:00=100, 22:55=60', () => {
    expect(run(parseMmss('16:00'), 20, 'F', false).points).toBe(100);
    expect(run(parseMmss('22:55'), 20, 'F', false).points).toBe(60);
  });
  it('faster than 100-pt threshold still scores 100', () => {
    expect(run(parseMmss('10:00'), 20, 'M', false).points).toBe(100);
  });
  it('27-31 differs from 22-26 at row 89 (15:55 vs 15:49)', () => {
    expect(run(parseMmss('15:49'), 24, 'M', false).points).toBe(89); // 22-26 mc
    expect(run(parseMmss('15:55'), 28, 'M', false).points).toBe(89); // 27-31 mc — diverges
    expect(run(parseMmss('15:49'), 28, 'M', false).points).toBe(88); // 27-31: 15:55 needed for 89
  });
  it('57-61 M|C ≡ over-62 M|C (identical scale via shared reference)', () => {
    expect(run(parseMmss('15:28'), 58, 'M', false).points).toBe(100);
    expect(run(parseMmss('15:28'), 65, 'M', false).points).toBe(100);
    expect(run(parseMmss('23:36'), 58, 'M', false).points).toBe(60);
    expect(run(parseMmss('23:36'), 65, 'M', false).points).toBe(60);
  });
  it('57-61 F differs from over-62 F at row 60', () => {
    expect(run(parseMmss('24:48'), 58, 'F', false).points).toBe(60); // 57-61 F: 24:48 = 60
    expect(run(parseMmss('25:00'), 65, 'F', false).points).toBe(60); // over-62 F: 25:00 = 60
  });
  it('over-62 F: 17:18=100, 25:00=60', () => {
    expect(run(parseMmss('17:18'), 65, 'F', false).points).toBe(100);
    expect(run(parseMmss('25:00'), 65, 'F', false).points).toBe(60);
  });
  it('female combat-MOS routes through mc — fast 16:00 at age 20 scores below 100 on mc scale', () => {
    const r = run(parseMmss('16:00'), 20, 'F', true);
    expect(r.scale).toBe('mc');
    expect(r.points).toBeLessThan(100);
  });
});

describe('Alternate events — Go/No-Go', () => {
  it('17-21 M|C walk: 31:00 passes, 31:01 fails', () => {
    expect(scoreAltEvent('walk2_5mi', parseMmss('31:00'), 20, 'M', false).passing).toBe(true);
    expect(scoreAltEvent('walk2_5mi', parseMmss('31:01'), 20, 'M', false).passing).toBe(false);
  });
  it('17-21 F walk: 34:00 passes, 34:01 fails', () => {
    expect(scoreAltEvent('walk2_5mi', parseMmss('34:00'), 20, 'F', false).passing).toBe(true);
    expect(scoreAltEvent('walk2_5mi', parseMmss('34:01'), 20, 'F', false).passing).toBe(false);
  });
  it('27-31 M|C bike: 26:00 passes (fastest bike standard)', () => {
    expect(scoreAltEvent('bike12k', parseMmss('26:00'), 28, 'M', false).passing).toBe(true);
    expect(scoreAltEvent('bike12k', parseMmss('26:01'), 28, 'M', false).passing).toBe(false);
  });
  it('over-62 F bike: 30:41 passes', () => {
    expect(scoreAltEvent('bike12k', parseMmss('30:41'), 65, 'F', false).passing).toBe(true);
  });
  it('1k swim and 5k row share standards', () => {
    const a = scoreAltEvent('swim1k', parseMmss('30:48'), 20, 'M', false);
    const b = scoreAltEvent('row5k',  parseMmss('30:48'), 20, 'M', false);
    expect(a.passing).toBe(b.passing);
    expect(a.passing).toBe(true);
  });
  it('female combat-MOS routes through mc — 34:00 walk passes on F but fails on mc', () => {
    expect(scoreAltEvent('walk2_5mi', parseMmss('34:00'), 20, 'F', false).passing).toBe(true);
    expect(scoreAltEvent('walk2_5mi', parseMmss('34:00'), 20, 'F', true).passing).toBe(false);
    expect(scoreAltEvent('walk2_5mi', parseMmss('34:00'), 20, 'F', true).scale).toBe('mc');
  });
});

describe('aftTotal', () => {
  it('sums points and flags allPassing only when every event ≥60', () => {
    const r = aftTotal([
      { event: 'mdl', points: 80 }, { event: 'hrp', points: 75 }, { event: 'sdc', points: 70 },
      { event: 'plk', points: 65 }, { event: 'run2mi', points: 60 },
    ]);
    expect(r.total).toBe(350);
    expect(r.allPassing).toBe(true);
  });
  it('one sub-60 fails the whole AFT', () => {
    const r = aftTotal([
      { event: 'mdl', points: 95 }, { event: 'hrp', points: 95 }, { event: 'sdc', points: 95 },
      { event: 'plk', points: 95 }, { event: 'run2mi', points: 59 },
    ]);
    expect(r.total).toBe(439);
    expect(r.allPassing).toBe(false);
  });
});

describe('mm:ss helpers', () => {
  it('parseMmss', () => {
    expect(parseMmss('1:29')).toBe(89);
    expect(parseMmss('13:22')).toBe(802);
    expect(parseMmss('0:55')).toBe(55);
    expect(parseMmss('bad')).toBeNaN();
    expect(parseMmss('1:60')).toBeNaN();
  });
  it('formatMmss', () => {
    expect(formatMmss(89)).toBe('1:29');
    expect(formatMmss(802)).toBe('13:22');
    expect(formatMmss(55)).toBe('0:55');
  });
  it('round-trips', () => {
    for (const s of ['1:29', '13:22', '0:00', '23:59']) {
      expect(formatMmss(parseMmss(s))).toBe(s);
    }
  });
});
