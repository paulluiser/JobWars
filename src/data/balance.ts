/**
 * Balance multipliers written by `npm run tune` (tools/tune.ts): each job's designed ATK and HP
 * in the roster files are multiplied by these so every job lands near a 50% overall win rate.
 * Re-run the tuner after changing a kit; edit by hand only for small nudges.
 */
export const BALANCE: Record<string, { atk: number; hp: number }> = {
  "chef": {
    "atk": 0.891,
    "hp": 0.913
  },
  "firefighter": {
    "atk": 0.98,
    "hp": 0.984
  },
  "electrician": {
    "atk": 0.953,
    "hp": 0.962
  },
  "nurse": {
    "atk": 0.912,
    "hp": 0.929
  },
  "courier": {
    "atk": 1.102,
    "hp": 1.082
  },
  "fisher": {
    "atk": 1.072,
    "hp": 1.058
  },
  "farmer": {
    "atk": 0.755,
    "hp": 0.802
  },
  "builder": {
    "atk": 1.248,
    "hp": 1.201
  },
  "miner": {
    "atk": 0.833,
    "hp": 0.866
  },
  "welder": {
    "atk": 1.004,
    "hp": 1.004
  },
  "plumber": {
    "atk": 1.066,
    "hp": 1.054
  },
  "mechanic": {
    "atk": 0.766,
    "hp": 0.813
  },
  "engineer": {
    "atk": 1.103,
    "hp": 1.083
  },
  "pilot": {
    "atk": 0.838,
    "hp": 0.869
  },
  "merchant": {
    "atk": 0.858,
    "hp": 0.886
  },
  "waiter": {
    "atk": 0.957,
    "hp": 0.965
  },
  "cleaner": {
    "atk": 1.197,
    "hp": 1.159
  },
  "tailor": {
    "atk": 0.843,
    "hp": 0.877
  },
  "barber": {
    "atk": 1.164,
    "hp": 1.132
  },
  "doctor": {
    "atk": 0.813,
    "hp": 0.848
  },
  "scientist": {
    "atk": 1.526,
    "hp": 1.406
  },
  "teacher": {
    "atk": 1.189,
    "hp": 1.151
  },
  "programmer": {
    "atk": 1.16,
    "hp": 1.126
  },
  "accountant": {
    "atk": 1.067,
    "hp": 1.053
  },
  "lawyer": {
    "atk": 0.908,
    "hp": 0.927
  },
  "police": {
    "atk": 1.027,
    "hp": 1.023
  },
  "soldier": {
    "atk": 0.8,
    "hp": 0.839
  },
  "artist": {
    "atk": 1.223,
    "hp": 1.175
  },
  "musician": {
    "atk": 0.89,
    "hp": 0.912
  },
  "athlete": {
    "atk": 0.957,
    "hp": 0.966
  }
};
