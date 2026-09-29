// Build-time: average color of a blessing icon (src/data/blessing-colors.yaml, tools/blessing-colors.ts).
import { parseWith, readYaml } from './data-file';
import { blessingColorsSchema } from './schema';

let colors: Record<string, string> | undefined;

export function iconColor(icon: string | undefined): string | undefined {
  if (!icon) return undefined;
  colors ??= parseWith(
    blessingColorsSchema,
    readYaml(process.cwd(), 'src/data/blessing-colors.yaml', {}, { optional: true }),
    'blessing-colors.yaml',
  );
  return colors[icon.replace(/\.webp$/, '')];
}
