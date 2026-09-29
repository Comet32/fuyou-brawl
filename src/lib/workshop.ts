export interface ChangelogEntry {
  timestamp: number;
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntity(m: string, body: string): string {
  if (body[0] === '#') {
    const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  }
  return NAMED_ENTITIES[body.toLowerCase()] ?? m;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)\s*>/gi, '\n')
    .replace(/<li(\s[^>]*)?>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Quoted third-party text must not ping users or auto-link issues/PRs on GitHub.
function neutralizeGithubRefs(line: string): string {
  return line.replace(/@/g, '@\u200b').replace(/#(?=\d)/g, '#\u200b');
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
  const exact = entries.find((e) => Math.abs(e.timestamp - timeUpdated) <= 6 * 3600);
  const entry = exact ?? entries[0];
  const quoted = entry ? entry.text.split('\n').map((l) => `> ${neutralizeGithubRefs(l)}`).join('\n') : '';
  const heading = exact
    ? '### 更新日志原文'
    : entry
      ? '### ⚠️ 未找到对应时间的日志，以下为最新一条'
      : '### ⚠️ 未能解析更新日志，请手动查看';
  const body = [
    `创意工坊在 **${date}**（北京时间）发布了新版本。`,
    '',
    heading,
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
