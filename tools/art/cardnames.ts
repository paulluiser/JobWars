// Grid order of the card art sheet (art/PROMPTS_CARDS.md): every card in the game's own order
// (45 general, 7 class, 30 job), then 8 card-effect sprites. 10 columns × 9 rows.
import { ALL_CARDS } from '../../src/data/cards';

export const CARD_EFFECTS = ['fx-pick', 'fx-epic', 'fx-shield', 'fx-phoenix', 'fx-parachute', 'fx-chain', 'fx-rod', 'fx-overtime'] as const;
export const CARD_ART_NAMES: string[] = [...ALL_CARDS.map((c) => c.id), ...CARD_EFFECTS];
