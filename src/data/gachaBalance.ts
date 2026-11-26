/**
 * Per-job ATK/HP multipliers for Gacha matches only, written by `npm run tune:gacha`
 * (tools/tunegacha.ts). Long, card-heavy fights reward different jobs than a 40 s duel, so Gacha
 * has its own layer on top of the normal balance. Jobs not listed are unchanged (×1).
 */
export const GACHA_BALANCE: Record<string, { atk: number; hp: number }> = {
  "chef": {
    "atk": 0.7,
    "hp": 0.757
  },
  "firefighter": {
    "atk": 1.079,
    "hp": 1.063
  },
  "electrician": {
    "atk": 1.149,
    "hp": 1.12
  },
  "nurse": {
    "atk": 0.866,
    "hp": 0.892
  },
  "courier": {
    "atk": 1.245,
    "hp": 1.195
  },
  "fisher": {
    "atk": 1.131,
    "hp": 1.105
  },
  "farmer": {
    "atk": 1.008,
    "hp": 1.008
  },
  "builder": {
    "atk": 1.248,
    "hp": 1.197
  },
  "miner": {
    "atk": 1.209,
    "hp": 1.165
  },
  "welder": {
    "atk": 0.811,
    "hp": 0.848
  },
  "plumber": {
    "atk": 1.194,
    "hp": 1.154
  },
  "mechanic": {
    "atk": 0.915,
    "hp": 0.933
  },
  "engineer": {
    "atk": 1.166,
    "hp": 1.133
  },
  "pilot": {
    "atk": 1.038,
    "hp": 1.031
  },
  "merchant": {
    "atk": 0.827,
    "hp": 0.862
  },
  "waiter": {
    "atk": 1.089,
    "hp": 1.072
  },
  "cleaner": {
    "atk": 0.545,
    "hp": 0.624
  },
  "tailor": {
    "atk": 0.762,
    "hp": 0.81
  },
  "barber": {
    "atk": 1.072,
    "hp": 1.059
  },
  "doctor": {
    "atk": 0.909,
    "hp": 0.927
  },
  "scientist": {
    "atk": 0.698,
    "hp": 0.753
  },
  "teacher": {
    "atk": 1.13,
    "hp": 1.105
  },
  "programmer": {
    "atk": 1.196,
    "hp": 1.155
  },
  "accountant": {
    "atk": 0.936,
    "hp": 0.949
  },
  "lawyer": {
    "atk": 1.149,
    "hp": 1.118
  },
  "police": {
    "atk": 1.146,
    "hp": 1.117
  },
  "soldier": {
    "atk": 1.063,
    "hp": 1.052
  },
  "artist": {
    "atk": 0.929,
    "hp": 0.943
  },
  "musician": {
    "atk": 0.751,
    "hp": 0.8
  },
  "athlete": {
    "atk": 1.205,
    "hp": 1.162
  }
};
