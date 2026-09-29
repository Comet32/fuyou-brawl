export const QUALITIES = [
  { id: 'ssr', label: '橙色', color: '#ff910a' },
  { id: 'sr', label: '紫色', color: '#b518ff' },
  { id: 'r', label: '蓝色', color: '#3d8bff' },
] as const;

export type QualityId = (typeof QUALITIES)[number]['id'];
export const QUALITY_IDS: readonly QualityId[] = QUALITIES.map((q) => q.id);

export function qualityOf(id: string | null | undefined): (typeof QUALITIES)[number] | undefined {
  return QUALITIES.find((q) => q.id === id);
}
