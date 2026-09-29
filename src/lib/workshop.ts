export interface ChangelogEntry {
  timestamp: number;
  text: string;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m])
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Steam changelog entries are <p id="{unix timestamp}">...</p>.
export function parseChangelog(html: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  for (const m of html.matchAll(/<p id="(\d{9,11})"[^>]*>([\s\S]*?)<\/p>/g)) {
    entries.push({ timestamp: Number(m[1]), text: htmlToText(m[2]) });
  }
  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

export function formatBeijingDate(ts: number): string {
  return new Date((ts + 8 * 3600) * 1000).toISOString().slice(0, 10);
}

export function buildIssue(
  timeUpdated: number,
  entries: ChangelogEntry[],
  changelogUrl: string,
): { key: string; title: string; body: string } {
  const key = `v${timeUpdated}`;
  const date = formatBeijingDate(timeUpdated);
  const entry = entries.find((e) => Math.abs(e.timestamp - timeUpdated) <= 6 * 3600) ?? entries[0];
  const quoted = entry ? entry.text.split('\n').map((l) => `> ${l}`).join('\n') : '';
  const body = [
    `创意工坊在 **${date}**（北京时间）发布了新版本。`,
    '',
    entry ? '### 更新日志原文' : '### ⚠️ 未能解析更新日志，请手动查看',
    '',
    quoted,
    '',
    `原始页面：${changelogUrl}`,
    '',
    '### 处理清单',
    '',
    '- [ ] 更新 `src/data/versions.yaml`（新增版本条目）',
    '- [ ] 更新受影响福佑的 `effect` / `numbers` / `history`',
    '- [ ] `npm run validate` 通过后 push，并关闭本 Issue',
  ].join('\n');
  return { key, title: `[游戏更新] ${date} ${key}`, body };
}
