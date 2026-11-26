export type PvpMode = 'classic1' | 'gacha1' | 'classic2' | 'gacha2' | 'royaleClassic' | 'royaleGacha';
export const PVP_MODES: Record<PvpMode, { name: string; tag: boolean; gacha: boolean; royale?: boolean; blurb: string }> = {
  classic1: { name: 'PvP Classic', tag: false, gacha: false, blurb: '1v1. Pick a job, the fight plays out.' },
  gacha1: { name: 'PvP Gacha', tag: false, gacha: true, blurb: '1v1. Draft a card every 15 s. About 2 minutes of combat.' },
  classic2: { name: 'Tag Team Classic', tag: true, gacha: false, blurb: '2v2. Pick two jobs, all four on the field.' },
  gacha2: { name: 'Gacha Tag Team', tag: true, gacha: true, blurb: '2v2 with a card draft every 15 s.' },
  royaleClassic: { name: 'Battle Royale Classic', tag: false, gacha: false, royale: true, blurb: '3–5 players. Last fighter standing.' },
  royaleGacha: { name: 'Battle Royale Gacha', tag: false, gacha: true, royale: true, blurb: '3–5 players. Survivors draft every 15 seconds.' },
};
