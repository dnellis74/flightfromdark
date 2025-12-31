// Lone Wolf Combat Results Table (CRT) unrolled from crt.xlsx
// Shape: ratio -> dieRoll -> { enemy, loneWolf }
// Where:
// - ratio = (Lone Wolf Combat Skill) - (Enemy Combat Skill)
// - dieRoll = 0..9 (Random Number Table result)
// - "K" means “killed” (instant kill / death marker as represented in the sheet)

export type Damage = number | "K";

export interface CRTCell {
  enemy: Damage;
  loneWolf: Damage;
}

export type CRTByRatio = Record<string | number, Record<number, CRTCell>>;

export const CRT: CRTByRatio = {
  "-11": {
    0: { enemy: 6, loneWolf: 0 },
    1: { enemy: 0, loneWolf: "K" },
    2: { enemy: 0, loneWolf: "K" },
    3: { enemy: 0, loneWolf: 8 },
    4: { enemy: 0, loneWolf: 8 },
    5: { enemy: 1, loneWolf: 7 },
    6: { enemy: 2, loneWolf: 6 },
    7: { enemy: 3, loneWolf: 5 },
    8: { enemy: 4, loneWolf: 4 },
    9: { enemy: 5, loneWolf: 3 }
  },
  "-10": {
    0: { enemy: 7, loneWolf: 0 },
    1: { enemy: 0, loneWolf: "K" },
    2: { enemy: 0, loneWolf: 8 },
    3: { enemy: 0, loneWolf: 7 },
    4: { enemy: 1, loneWolf: 7 },
    5: { enemy: 2, loneWolf: 6 },
    6: { enemy: 3, loneWolf: 6 },
    7: { enemy: 4, loneWolf: 5 },
    8: { enemy: 5, loneWolf: 4 },
    9: { enemy: 6, loneWolf: 3 }
  },
  "-9": {
    0: { enemy: 7, loneWolf: 0 },
    1: { enemy: 0, loneWolf: "K" },
    2: { enemy: 0, loneWolf: 8 },
    3: { enemy: 0, loneWolf: 7 },
    4: { enemy: 0, loneWolf: 7 },
    5: { enemy: 2, loneWolf: 6 },
    6: { enemy: 3, loneWolf: 6 },
    7: { enemy: 4, loneWolf: 5 },
    8: { enemy: 5, loneWolf: 4 },
    9: { enemy: 6, loneWolf: 3 }
  },
  "-8": {
    0: { enemy: 8, loneWolf: 0 },
    1: { enemy: 0, loneWolf: 8 },
    2: { enemy: 0, loneWolf: 7 },
    3: { enemy: 1, loneWolf: 6 },
    4: { enemy: 2, loneWolf: 6 },
    5: { enemy: 3, loneWolf: 5 },
    6: { enemy: 4, loneWolf: 5 },
    7: { enemy: 5, loneWolf: 4 },
    8: { enemy: 6, loneWolf: 3 },
    9: { enemy: 7, loneWolf: 2 }
  },
  "-7": {
    0: { enemy: 8, loneWolf: 0 },
    1: { enemy: 0, loneWolf: 8 },
    2: { enemy: 0, loneWolf: 7 },
    3: { enemy: 1, loneWolf: 6 },
    4: { enemy: 2, loneWolf: 6 },
    5: { enemy: 3, loneWolf: 5 },
    6: { enemy: 4, loneWolf: 5 },
    7: { enemy: 5, loneWolf: 4 },
    8: { enemy: 6, loneWolf: 3 },
    9: { enemy: 7, loneWolf: 2 }
  },
  "-6": {
    0: { enemy: 9, loneWolf: 0 },
    1: { enemy: 0, loneWolf: 6 },
    2: { enemy: 1, loneWolf: 6 },
    3: { enemy: 2, loneWolf: 5 },
    4: { enemy: 3, loneWolf: 5 },
    5: { enemy: 4, loneWolf: 4 },
    6: { enemy: 5, loneWolf: 4 },
    7: { enemy: 6, loneWolf: 3 },
    8: { enemy: 7, loneWolf: 3 },
    9: { enemy: 8, loneWolf: 2 }
  },
  "-5": {
    0: { enemy: 9, loneWolf: 0 },
    1: { enemy: 0, loneWolf: 6 },
    2: { enemy: 1, loneWolf: 6 },
    3: { enemy: 2, loneWolf: 5 },
    4: { enemy: 3, loneWolf: 5 },
    5: { enemy: 4, loneWolf: 4 },
    6: { enemy: 5, loneWolf: 4 },
    7: { enemy: 6, loneWolf: 3 },
    8: { enemy: 7, loneWolf: 3 },
    9: { enemy: 8, loneWolf: 2 }
  },
  "-4": {
    0: { enemy: 10, loneWolf: 0 },
    1: { enemy: 1, loneWolf: 6 },
    2: { enemy: 2, loneWolf: 5 },
    3: { enemy: 3, loneWolf: 5 },
    4: { enemy: 4, loneWolf: 4 },
    5: { enemy: 5, loneWolf: 4 },
    6: { enemy: 6, loneWolf: 3 },
    7: { enemy: 7, loneWolf: 2 },
    8: { enemy: 8, loneWolf: 1 },
    9: { enemy: 9, loneWolf: 0 }
  },
  "-3": {
    0: { enemy: 10, loneWolf: 0 },
    1: { enemy: 1, loneWolf: 6 },
    2: { enemy: 2, loneWolf: 5 },
    3: { enemy: 3, loneWolf: 5 },
    4: { enemy: 4, loneWolf: 4 },
    5: { enemy: 5, loneWolf: 4 },
    6: { enemy: 6, loneWolf: 3 },
    7: { enemy: 7, loneWolf: 2 },
    8: { enemy: 8, loneWolf: 1 },
    9: { enemy: 9, loneWolf: 0 }
  },
  "-2": {
    0: { enemy: 11, loneWolf: 0 },
    1: { enemy: 2, loneWolf: 5 },
    2: { enemy: 3, loneWolf: 5 },
    3: { enemy: 4, loneWolf: 4 },
    4: { enemy: 5, loneWolf: 4 },
    5: { enemy: 6, loneWolf: 3 },
    6: { enemy: 7, loneWolf: 2 },
    7: { enemy: 8, loneWolf: 2 },
    8: { enemy: 9, loneWolf: 1 },
    9: { enemy: 10, loneWolf: 0 }
  },
  "-1": {
    0: { enemy: 11, loneWolf: 0 },
    1: { enemy: 2, loneWolf: 5 },
    2: { enemy: 3, loneWolf: 5 },
    3: { enemy: 4, loneWolf: 4 },
    4: { enemy: 5, loneWolf: 4 },
    5: { enemy: 6, loneWolf: 3 },
    6: { enemy: 7, loneWolf: 2 },
    7: { enemy: 8, loneWolf: 2 },
    8: { enemy: 9, loneWolf: 1 },
    9: { enemy: 10, loneWolf: 0 }
  },
  "0": {
    0: { enemy: 12, loneWolf: 0 },
    1: { enemy: 3, loneWolf: 5 },
    2: { enemy: 4, loneWolf: 4 },
    3: { enemy: 5, loneWolf: 4 },
    4: { enemy: 6, loneWolf: 3 },
    5: { enemy: 7, loneWolf: 2 },
    6: { enemy: 8, loneWolf: 2 },
    7: { enemy: 9, loneWolf: 1 },
    8: { enemy: 10, loneWolf: 0 },
    9: { enemy: 11, loneWolf: 0 }
  },
  "1": {
    0: { enemy: 14, loneWolf: 0 },
    1: { enemy: 4, loneWolf: 5 },
    2: { enemy: 5, loneWolf: 4 },
    3: { enemy: 6, loneWolf: 3 },
    4: { enemy: 7, loneWolf: 3 },
    5: { enemy: 8, loneWolf: 2 },
    6: { enemy: 9, loneWolf: 2 },
    7: { enemy: 10, loneWolf: 1 },
    8: { enemy: 11, loneWolf: 0 },
    9: { enemy: 12, loneWolf: 0 }
  },
  "2": {
    0: { enemy: 14, loneWolf: 0 },
    1: { enemy: 4, loneWolf: 5 },
    2: { enemy: 5, loneWolf: 4 },
    3: { enemy: 6, loneWolf: 3 },
    4: { enemy: 7, loneWolf: 3 },
    5: { enemy: 8, loneWolf: 2 },
    6: { enemy: 9, loneWolf: 2 },
    7: { enemy: 10, loneWolf: 1 },
    8: { enemy: 11, loneWolf: 0 },
    9: { enemy: 12, loneWolf: 0 }
  },
  "3": {
    0: { enemy: 12, loneWolf: 0 },
    1: { enemy: 4, loneWolf: 4 },
    2: { enemy: 5, loneWolf: 3 },
    3: { enemy: 6, loneWolf: 3 },
    4: { enemy: 7, loneWolf: 2 },
    5: { enemy: 8, loneWolf: 2 },
    6: { enemy: 9, loneWolf: 2 },
    7: { enemy: 10, loneWolf: 1 },
    8: { enemy: 11, loneWolf: 0 },
    9: { enemy: 12, loneWolf: 0 }
  },
  "4": {
    0: { enemy: 16, loneWolf: 0 },
    1: { enemy: 5, loneWolf: 4 },
    2: { enemy: 6, loneWolf: 3 },
    3: { enemy: 7, loneWolf: 3 },
    4: { enemy: 8, loneWolf: 2 },
    5: { enemy: 9, loneWolf: 2 },
    6: { enemy: 10, loneWolf: 2 },
    7: { enemy: 11, loneWolf: 1 },
    8: { enemy: 12, loneWolf: 0 },
    9: { enemy: 14, loneWolf: 0 }
  },
  "5": {
    0: { enemy: 18, loneWolf: 0 },
    1: { enemy: 6, loneWolf: 4 },
    2: { enemy: 7, loneWolf: 3 },
    3: { enemy: 8, loneWolf: 3 },
    4: { enemy: 9, loneWolf: 2 },
    5: { enemy: 10, loneWolf: 2 },
    6: { enemy: 11, loneWolf: 2 },
    7: { enemy: 12, loneWolf: 1 },
    8: { enemy: 14, loneWolf: 0 },
    9: { enemy: 16, loneWolf: 0 }
  },
  "6": {
    0: { enemy: 18, loneWolf: 0 },
    1: { enemy: 6, loneWolf: 4 },
    2: { enemy: 7, loneWolf: 3 },
    3: { enemy: 8, loneWolf: 3 },
    4: { enemy: 9, loneWolf: 2 },
    5: { enemy: 10, loneWolf: 2 },
    6: { enemy: 11, loneWolf: 1 },
    7: { enemy: 12, loneWolf: 0 },
    8: { enemy: 14, loneWolf: 0 },
    9: { enemy: 16, loneWolf: 0 }
  },
  "7": {
    0: { enemy: "K", loneWolf: 0 },
    1: { enemy: 7, loneWolf: 4 },
    2: { enemy: 8, loneWolf: 3 },
    3: { enemy: 9, loneWolf: 2 },
    4: { enemy: 10, loneWolf: 2 },
    5: { enemy: 11, loneWolf: 2 },
    6: { enemy: 12, loneWolf: 1 },
    7: { enemy: 14, loneWolf: 0 },
    8: { enemy: 16, loneWolf: 0 },
    9: { enemy: 18, loneWolf: 0 }
  },
  "8": {
    0: { enemy: "K", loneWolf: 0 },
    1: { enemy: 7, loneWolf: 4 },
    2: { enemy: 8, loneWolf: 3 },
    3: { enemy: 9, loneWolf: 2 },
    4: { enemy: 10, loneWolf: 2 },
    5: { enemy: 11, loneWolf: 2 },
    6: { enemy: 12, loneWolf: 1 },
    7: { enemy: 14, loneWolf: 0 },
    8: { enemy: 16, loneWolf: 0 },
    9: { enemy: 18, loneWolf: 0 }
  },
  "9": {
    0: { enemy: "K", loneWolf: 0 },
    1: { enemy: 8, loneWolf: 3 },
    2: { enemy: 9, loneWolf: 3 },
    3: { enemy: 10, loneWolf: 2 },
    4: { enemy: 11, loneWolf: 2 },
    5: { enemy: 12, loneWolf: 2 },
    6: { enemy: 14, loneWolf: 1 },
    7: { enemy: 16, loneWolf: 0 },
    8: { enemy: 18, loneWolf: 0 },
    9: { enemy: "K", loneWolf: 0 }
  },
  "10": {
    0: { enemy: "K", loneWolf: 0 },
    1: { enemy: 8, loneWolf: 3 },
    2: { enemy: 9, loneWolf: 3 },
    3: { enemy: 10, loneWolf: 2 },
    4: { enemy: 11, loneWolf: 2 },
    5: { enemy: 12, loneWolf: 2 },
    6: { enemy: 14, loneWolf: 1 },
    7: { enemy: 16, loneWolf: 0 },
    8: { enemy: 18, loneWolf: 0 },
    9: { enemy: "K", loneWolf: 0 }
  },
  "11": {
    0: { enemy: "K", loneWolf: 0 },
    1: { enemy: 9, loneWolf: 3 },
    2: { enemy: 10, loneWolf: 2 },
    3: { enemy: 11, loneWolf: 2 },
    4: { enemy: 12, loneWolf: 2 },
    5: { enemy: 14, loneWolf: 1 },
    6: { enemy: 16, loneWolf: 1 },
    7: { enemy: 18, loneWolf: 0 },
    8: { enemy: "K", loneWolf: 0 },
    9: { enemy: "K", loneWolf: 0 }
  }
};
