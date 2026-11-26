/**
 * Extra multipliers for Tag Team (2v2), written by `npm run tune:tag` (tools/tunetag.ts).
 * They sit on top of the 1v1 balance and apply only when a side has more than one fighter,
 * so 1v1 stays exactly as tuned. Jobs that aren't listed are unchanged (×1).
 */
export const TAG_BALANCE: Record<string, { atk: number; hp: number }> = {
  "chef": {
    "atk": 1.009,
    "hp": 1.008
  },
  "firefighter": {
    "atk": 0.991,
    "hp": 0.994
  },
  "electrician": {
    "atk": 0.949,
    "hp": 0.961
  },
  "nurse": {
    "atk": 1.001,
    "hp": 1.002
  },
  "courier": {
    "atk": 1.001,
    "hp": 1.003
  },
  "fisher": {
    "atk": 1.038,
    "hp": 1.032
  },
  "farmer": {
    "atk": 1.031,
    "hp": 1.028
  },
  "builder": {
    "atk": 0.965,
    "hp": 0.975
  },
  "miner": {
    "atk": 1.037,
    "hp": 1.029
  },
  "welder": {
    "atk": 0.973,
    "hp": 0.979
  },
  "plumber": {
    "atk": 0.974,
    "hp": 0.982
  },
  "mechanic": {
    "atk": 1,
    "hp": 1.001
  },
  "engineer": {
    "atk": 0.978,
    "hp": 0.984
  },
  "pilot": {
    "atk": 1.015,
    "hp": 1.015
  },
  "merchant": {
    "atk": 1.021,
    "hp": 1.019
  },
  "waiter": {
    "atk": 0.963,
    "hp": 0.971
  },
  "cleaner": {
    "atk": 0.968,
    "hp": 0.975
  },
  "tailor": {
    "atk": 0.977,
    "hp": 0.984
  },
  "barber": {
    "atk": 0.976,
    "hp": 0.982
  },
  "doctor": {
    "atk": 1.046,
    "hp": 1.039
  },
  "scientist": {
    "atk": 0.904,
    "hp": 0.925
  },
  "teacher": {
    "atk": 1.004,
    "hp": 1.005
  },
  "programmer": {
    "atk": 0.952,
    "hp": 0.963
  },
  "accountant": {
    "atk": 1.019,
    "hp": 1.016
  },
  "lawyer": {
    "atk": 1.059,
    "hp": 1.048
  },
  "police": {
    "atk": 0.998,
    "hp": 0.998
  },
  "soldier": {
    "atk": 0.992,
    "hp": 0.996
  },
  "artist": {
    "atk": 0.975,
    "hp": 0.982
  },
  "musician": {
    "atk": 0.921,
    "hp": 0.94
  },
  "athlete": {
    "atk": 0.966,
    "hp": 0.974
  }
};
