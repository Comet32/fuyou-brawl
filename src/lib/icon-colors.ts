// Build-time: average color of a blessing icon (src/data/blessing-colors.yaml, tools/blessing-colors.ts).
import { renderBlessingColors } from './render-data';

export function iconColor(icon: string | undefined): string | undefined {
  if (!icon) return undefined;
  return renderBlessingColors()[icon.replace(/\.webp$/, '')];
}
