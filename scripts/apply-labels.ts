// Merge quality labels exported from /label/ into src/data/blessings.overrides.yaml.
// Usage: npm run labels -- labels.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadBlessingFiles, OVERRIDES_FILE } from '../src/lib/blessings';
import { mergeQualityLabels, validateLabels } from '../src/lib/label-merge';

const file = process.argv[2];
if (!file) {
  console.error('用法：npm run labels -- <labels.json>');
  process.exit(1);
}

try {
  const root = process.cwd();
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const known = new Set(loadBlessingFiles(root).map((b) => b.id));
  const { labels, unknown, invalid } = validateLabels(raw, known);
  if (invalid.length > 0) {
    console.error(`✗ ${invalid.length} 个值不是 r / sr / ssr，未写入：${invalid.join(', ')}`);
    process.exit(1);
  }

  const path = join(root, OVERRIDES_FILE);
  const source = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const { text, added, changed, unchanged } = mergeQualityLabels(source, labels);
  if (added + changed > 0) writeFileSync(path, text);
  // Re-read through the real schema so a bad merge fails loudly instead of breaking the build later.
  loadBlessingFiles(root);

  console.log(`✓ ${OVERRIDES_FILE}：新增 ${added}，修改 ${changed}，未变 ${unchanged}，未知 id ${unknown.length}`);
  if (unknown.length > 0) console.log(`  未知 id（已跳过）：${unknown.join(', ')}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
