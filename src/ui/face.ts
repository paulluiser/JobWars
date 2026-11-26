import { charArt } from '../render/art';
import type { FighterDef } from '../sim/types';
import { portraitSvg } from './portrait';

/** Portrait markup: the real PNG when the art pipeline has one, otherwise the SVG placeholder. */
export function face(d: FighterDef, mode: 'bust' | 'icon' = 'icon', shout = false): string {
  const art = charArt(d.id);
  const url = mode === 'bust' ? art?.bustUrl : art?.iconUrl;
  if (url) return `<img src="${url}" alt="" draggable="false" class="art-${mode}">`;
  return portraitSvg(d, mode, shout);
}
