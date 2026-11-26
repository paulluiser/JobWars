/**
 * Vertical foreshortening of the floor plane. Painted arenas are drawn in a slight top-down
 * 3/4 view, so their floor is wider than it is deep; the sim arena is square. Instead of
 * stretching the art, the world is squashed vertically by `k` and upright things (fighters,
 * text, big props) undo it so they don't look flattened. k = 1 with the drawn placeholder arena.
 */
export const DEPTH = { k: 1 };
