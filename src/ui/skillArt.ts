export type SkillKind = 'passive' | 'active' | 'special';

export function skillIcon(job: string, kind: SkillKind) {
  return `<img class="skill-icon" src="${import.meta.env.BASE_URL}art/skills/${job}-${kind}.webp" width="144" height="144" alt="" decoding="async">`;
}
