import { findBrokenRefs } from '../src/lib/integrity';
import { loadDataSet } from '../src/lib/load';
import { loadSources } from '../src/lib/sources';

try {
  const data = loadDataSet(process.cwd());
  // Schema check of the cited-source registry (throws with the file name on error).
  loadSources(process.cwd());
  const errors = findBrokenRefs(data);
  if (errors.length > 0) {
    console.error(`✗ 发现 ${errors.length} 个数据问题：`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    `✓ 数据校验通过：${data.blessings.length} 个福佑、${data.heroes.length} 个英雄、` +
      `${data.items.length} 件装备、${data.versions.length} 个版本、${data.builds.length} 份搭配`,
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
