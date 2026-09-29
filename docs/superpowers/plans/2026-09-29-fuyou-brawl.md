# 福佑大乱斗 · 图鉴与攻略 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Dota2 游廊游戏《福佑大乱斗》做一个纯静态的图鉴与攻略站，支持拼音搜索和三选一对比，部署到 GitHub Pages 和 Cloudflare Pages，零成本、国内可访问。

**Architecture:** 所有数据以 YAML（福佑 / 英雄 / 装备 / 版本）和 Markdown（英雄搭配 / 攻略）的形式放在仓库里，由 Astro content collections 加载，并用共享的 zod schema 校验。纯逻辑（schema、引用完整性、拼音索引、搜索、对比 URL、创意工坊更新日志解析、Dota 数据源映射）集中在 `src/lib/`，用 vitest 测试。页面在服务端渲染出完整的卡片列表，客户端脚本只负责根据搜索结果对已有 DOM 做显示、隐藏和排序。GitHub Actions 负责部署、每日检查创意工坊更新，以及拉取 Dota 官方素材。

**Tech Stack:** Astro 7、TypeScript、zod（通过 `astro/zod`）、Fuse.js 7、pinyin-pro 3、yaml 2、vitest 5、tsx、GitHub Actions、Cloudflare Pages；本机工具 cwebp / ImageMagick / yt-dlp / ffmpeg。

**Spec:** `docs/superpowers/specs/2026-09-29-fuyou-brawl-design.md`

---

## 执行前须知

- **外网问题**：本机访问 Steam / B 站失败（代理 `127.0.0.1:7897` 的 TLS 握手出错），npm 正常。需要访问 Steam / dota2.com 的步骤都给了 GitHub Actions 的跑法；本地跑的前提是代理已经修好。
- **需要用户确认的动作**（执行到对应步骤时先停下来问）：创建公开 GitHub 仓库（Task 9）、下载 ValveResourceFormat 可执行文件（Task 17）、下载任何 B 站视频（Task 18）。
- **需要用户亲自完成的动作**：注册并配置 Cloudflare 账号（Task 10）、从 Windows 电脑打包创意工坊目录（Task 17）。
- 仓库所有者是 `Comet32`（Pages 域名为小写 `comet32.github.io`），只在 `src/lib/site.ts`、`astro.config.mjs` 的 CI 环境变量和 `.github/workflows/deploy.yml` 里出现。如果最终所有者不同，只改这三处。

## 文件结构

```
fuyou-brawl/
├── astro.config.mjs              # site/base from env (GitHub Pages vs Cloudflare)
├── package.json / tsconfig.json / vitest.config.ts / .gitignore
├── README.md                     # 内容维护指南（中文）
├── public/
│   ├── favicon.svg
│   └── img/{heroes,items,blessings}/*.webp
├── src/
│   ├── content.config.ts         # collections wired to shared schemas
│   ├── data/                     # blessings.yaml heroes.yaml items.yaml versions.yaml
│   ├── content/
│   │   ├── builds/<hero-id>.md   # 英雄搭配
│   │   └── guides/<slug>.md      # 攻略文章
│   ├── lib/                      # pure, unit-tested logic
│   │   ├── schema.ts             # zod schemas + types + CATEGORIES
│   │   ├── integrity.ts          # cross-reference checks
│   │   ├── load.ts               # fs loader for validate script
│   │   ├── search-record.ts      # build-time pinyin index
│   │   ├── searcher.ts           # client-side Fuse search
│   │   ├── compare.ts            # compare-page URL state
│   │   ├── hero-blessings.ts     # hero <-> blessing reverse index
│   │   ├── workshop.ts           # changelog parsing + issue body
│   │   ├── dota-feed.ts          # dota2.com datafeed mapping
│   │   ├── url.ts / json.ts / categories.ts / site.ts / assets.ts
│   ├── components/               # BlessingIcon BlessingCard HeroImage ItemImage
│   ├── layouts/Base.astro
│   ├── pages/                    # index compare blessings/[id] heroes/ versions guides/
│   ├── scripts/                  # search-page.ts compare-page.ts (browser)
│   └── styles/global.css
├── scripts/                      # validate-data.ts check-workshop-update.ts fetch-dota-assets.ts
├── tests/                        # *.test.ts + fixtures.ts
└── .github/workflows/            # deploy.yml watch-workshop.yml fetch-dota-assets.yml
```

## 阶段总览

| 阶段 | 任务 | 产出 |
|---|---|---|
| 1 基础与核心逻辑 | Task 1–4 | 可测试的 schema / 校验 / 搜索 / 对比 / 反查逻辑 |
| 2 页面 | Task 5–8 | 本地 `npm run dev` 能用的完整网站（样例数据） |
| 3 部署 | Task 9–10 | GitHub Pages 主站 + Cloudflare Pages 备用 |
| 4 自动化 | Task 11–12 | 每日更新检查 Issue；Dota 英雄 / 装备数据和图片 |
| 5 内容 | Task 13–16 | 真实福佑数据、版本记录、社区补充、搭配和攻略 |
| 6 福佑图标 | Task 17–18 | VPK 解包图标 + 视频截图补缺 |
| 7 收尾 | Task 19 | README、最终验收 |

---

## 阶段 1：基础与核心逻辑

### Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `astro.config.mjs`, `.gitignore`, `src/lib/url.ts`, `tests/url.test.ts`

- [ ] **Step 1: 初始化 git 和 package.json**

```bash
cd ~/Documents/GitHub/fuyou-brawl
git init -b main
```

创建 `package.json`：

```json
{
  "name": "fuyou-brawl",
  "type": "module",
  "private": true,
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "validate": "tsx scripts/validate-data.ts"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
npm install astro fuse.js pinyin-pro yaml
npm install -D vitest tsx typescript @astrojs/check
```

预期：安装成功。写计划时的最新版本是 astro 7.3.x、fuse.js 7.5.x、pinyin-pro 3.29.x、yaml 2.9.x、vitest 5.0.x。

- [ ] **Step 3: 写配置文件**

`tsconfig.json`：

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

`astro.config.mjs`：

```js
import { defineConfig } from 'astro/config';

// GitHub Pages serves under /fuyou-brawl/; Cloudflare Pages serves at root.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://fuyou-brawl.pages.dev',
  base: process.env.SITE_BASE ?? '/',
  trailingSlash: 'always',
});
```

`.gitignore`：

```
node_modules/
dist/
.astro/
.DS_Store
tmp/
issue-key.txt
issue-title.txt
issue-body.md
```

- [ ] **Step 4: 写失败测试 `tests/url.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { joinBase } from '../src/lib/url';

describe('joinBase', () => {
  it('joins a sub-path base with a leading-slash path', () => {
    expect(joinBase('/fuyou-brawl/', '/heroes/')).toBe('/fuyou-brawl/heroes/');
  });
  it('tolerates a base without trailing slash', () => {
    expect(joinBase('/fuyou-brawl', 'heroes/')).toBe('/fuyou-brawl/heroes/');
  });
  it('maps root path to the base itself', () => {
    expect(joinBase('/fuyou-brawl/', '/')).toBe('/fuyou-brawl/');
    expect(joinBase('/', '/')).toBe('/');
  });
});
```

- [ ] **Step 5: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL，报错 `Failed to resolve import "../src/lib/url"`

- [ ] **Step 6: 实现 `src/lib/url.ts`**

```ts
export function joinBase(base: string, path: string): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  return b + path.replace(/^\/+/, '');
}

// Prefix a site-absolute path with the configured Astro base.
export const url = (path: string): string => joinBase(import.meta.env.BASE_URL, path);
```

- [ ] **Step 7: 运行测试，确认通过**

Run: `npm test`
Expected: PASS（3 个测试）

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro project with vitest"
```

---

### Task 2: 数据 schema 与引用完整性校验

**Files:**
- Create: `src/lib/schema.ts`, `src/lib/integrity.ts`, `tests/fixtures.ts`, `tests/integrity.test.ts`

- [ ] **Step 1: 实现 `src/lib/schema.ts`**（纯声明，由后面的测试覆盖）

```ts
import { z } from 'astro/zod';

export const CATEGORIES = ['装备类', '属性类', '技能类', '召唤类', '经济类', '团队类', '其他'] as const;
export type Category = (typeof CATEGORIES)[number];

export const ATTRS = ['str', 'agi', 'int', 'all'] as const;
export const ATTR_LABELS: Record<(typeof ATTRS)[number], string> = {
  str: '力量',
  agi: '敏捷',
  int: '智力',
  all: '全才',
};

const slug = z.string().regex(/^[a-z0-9_-]+$/, 'id 只能包含小写字母、数字、- 和 _');
// Astro's YAML/frontmatter parser turns unquoted 2026-09-28 into a Date; normalize back to a string.
const isoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
);

export const blessingSchema = z.object({
  id: slug,
  name: z.string().min(1),
  category: z.enum(CATEGORIES),
  exclusive_hero: slug.nullable().default(null),
  effect: z.string().min(1),
  // Keys are human-readable Chinese labels, e.g. { 金币: 3500 }
  numbers: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  tags: z.array(z.string()).default([]),
  // File name under public/img/blessings/
  icon: z.string().optional(),
  since_version: isoDate.optional(),
  sources: z.array(z.url()).default([]),
  history: z.array(z.object({ version: isoDate, change: z.string().min(1) })).default([]),
});

export const heroSchema = z.object({
  id: slug,
  name: z.string().min(1),
  name_en: z.string().min(1),
  attr: z.enum(ATTRS),
});

export const itemSchema = z.object({
  id: slug,
  name: z.string().min(1),
  name_en: z.string().min(1),
});

export const versionSchema = z.object({
  id: isoDate,
  title: z.string().min(1),
  source_url: z.url().optional(),
  changes: z
    .array(z.object({ blessing: slug.nullable().default(null), text: z.string().min(1) }))
    .default([]),
});

export const buildSchema = z.object({
  hero: slug,
  summary: z.string().min(1),
  blessings: z.array(z.object({ id: slug, note: z.string().optional() })).default([]),
  items: z.array(slug).default([]),
  updated: isoDate,
  sources: z.array(z.url()).default([]),
});

export const guideSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  order: z.number().default(100),
  updated: isoDate,
  sources: z.array(z.url()).default([]),
});

export type Blessing = z.infer<typeof blessingSchema>;
export type Hero = z.infer<typeof heroSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Version = z.infer<typeof versionSchema>;
export type Build = z.infer<typeof buildSchema>;
export type Guide = z.infer<typeof guideSchema>;
```

- [ ] **Step 2: 写测试夹具 `tests/fixtures.ts`**

```ts
import { blessingSchema, buildSchema, heroSchema, itemSchema, versionSchema } from '../src/lib/schema';
import type { DataSet } from '../src/lib/integrity';

export const blessings = [
  blessingSchema.parse({
    id: 'wolf-core',
    name: '狼王核心',
    category: '团队类',
    effect: '在双方泉水生成 3 个狼王核心，拾取者冷却缩减 8%',
    numbers: { 冷却缩减: '8%' },
    tags: ['冷却'],
    since_version: '2026-09-01',
  }),
  blessingSchema.parse({
    id: 'electric-hammer',
    name: '电锤思维',
    category: '装备类',
    effect: '获得 3500 金币，携带的第一把深渊之刃升级为雷神之锤（真）',
    numbers: { 金币: 3500 },
    tags: ['经济', '前期'],
    history: [{ version: '2026-09-01', change: '金币 3000→3500' }],
  }),
  blessingSchema.parse({
    id: 'rescue',
    name: '救援',
    category: '其他',
    effect: '死亡后留下墓碑，3 秒后可在队友附近复活，期间可以购物',
    exclusive_hero: 'axe',
  }),
];

export const heroes = [
  heroSchema.parse({ id: 'axe', name: '斧王', name_en: 'Axe', attr: 'str' }),
  heroSchema.parse({ id: 'antimage', name: '敌法师', name_en: 'Anti-Mage', attr: 'agi' }),
];

export const items = [
  itemSchema.parse({ id: 'abyssal_blade', name: '深渊之刃', name_en: 'Abyssal Blade' }),
  itemSchema.parse({ id: 'blink', name: '闪烁匕首', name_en: 'Blink Dagger' }),
];

export const versions = [
  versionSchema.parse({
    id: '2026-09-01',
    title: '秋季更新',
    changes: [{ blessing: 'electric-hammer', text: '金币 3000→3500' }],
  }),
];

export const builds = [
  {
    file: 'axe.md',
    data: buildSchema.parse({
      hero: 'axe',
      summary: '跳吼开团',
      blessings: [{ id: 'electric-hammer', note: '前期经济' }, { id: 'wolf-core' }],
      items: ['blink'],
      updated: '2026-09-20',
    }),
  },
];

export function validSet(): DataSet {
  return structuredClone({ blessings, heroes, items, versions, builds });
}
```

- [ ] **Step 3: 写失败测试 `tests/integrity.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { findBrokenRefs } from '../src/lib/integrity';
import { buildSchema } from '../src/lib/schema';
import { validSet } from './fixtures';

describe('isoDate fields', () => {
  it('accept Date objects produced by frontmatter parsers', () => {
    const b = buildSchema.parse({ hero: 'axe', summary: 's', updated: new Date('2026-09-28') });
    expect(b.updated).toBe('2026-09-28');
  });
});

describe('findBrokenRefs', () => {
  it('returns no errors for a consistent data set', () => {
    expect(findBrokenRefs(validSet())).toEqual([]);
  });

  it('reports duplicate blessing ids and names', () => {
    const d = validSet();
    d.blessings.push({ ...d.blessings[0] });
    const errors = findBrokenRefs(d);
    expect(errors).toContain('福佑 id 重复：wolf-core');
    expect(errors).toContain('福佑名称重复：狼王核心');
  });

  it('reports unknown exclusive hero', () => {
    const d = validSet();
    d.blessings[2].exclusive_hero = 'nobody';
    expect(findBrokenRefs(d)).toContain('福佑 rescue：exclusive_hero "nobody" 不存在');
  });

  it('reports unknown versions in since_version and history', () => {
    const d = validSet();
    d.blessings[0].since_version = '2020-01-01';
    d.blessings[1].history[0].version = '2020-01-02';
    const errors = findBrokenRefs(d);
    expect(errors).toContain('福佑 wolf-core：since_version "2020-01-01" 不在 versions.yaml 中');
    expect(errors).toContain('福佑 electric-hammer：history 版本 "2020-01-02" 不在 versions.yaml 中');
  });

  it('reports unknown blessing in version changes', () => {
    const d = validSet();
    d.versions[0].changes[0].blessing = 'ghost';
    expect(findBrokenRefs(d)).toContain('版本 2026-09-01：引用了不存在的福佑 "ghost"');
  });

  it('reports build file / hero mismatch and bad refs', () => {
    const d = validSet();
    d.builds[0].file = 'antimage.md';
    d.builds[0].data.blessings.push({ id: 'ghost' });
    d.builds[0].data.items.push('nothing');
    const errors = findBrokenRefs(d);
    expect(errors).toContain('搭配 antimage.md：文件名应为 axe.md');
    expect(errors).toContain('搭配 antimage.md：福佑 "ghost" 不存在');
    expect(errors).toContain('搭配 antimage.md：装备 "nothing" 不存在');
  });

  it('reports build for unknown hero and duplicate builds', () => {
    const d = validSet();
    d.builds.push({ file: 'zeus.md', data: { ...d.builds[0].data, hero: 'zeus' } });
    d.builds.push({ ...d.builds[0] });
    const errors = findBrokenRefs(d);
    expect(errors).toContain('搭配 zeus.md：英雄 "zeus" 不存在');
    expect(errors).toContain('英雄 axe 有多个搭配文件');
  });
});
```

- [ ] **Step 4: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL，报错 `Failed to resolve import "../src/lib/integrity"`

- [ ] **Step 5: 实现 `src/lib/integrity.ts`**

```ts
import type { Blessing, Build, Hero, Item, Version } from './schema';

export interface DataSet {
  blessings: Blessing[];
  heroes: Hero[];
  items: Item[];
  versions: Version[];
  builds: { file: string; data: Build }[];
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

export function findBrokenRefs(d: DataSet): string[] {
  const errors: string[] = [];
  const blessingIds = new Set(d.blessings.map((b) => b.id));
  const heroIds = new Set(d.heroes.map((h) => h.id));
  const itemIds = new Set(d.items.map((i) => i.id));
  const versionIds = new Set(d.versions.map((v) => v.id));

  for (const id of duplicates(d.blessings.map((b) => b.id))) errors.push(`福佑 id 重复：${id}`);
  for (const name of duplicates(d.blessings.map((b) => b.name))) errors.push(`福佑名称重复：${name}`);
  for (const id of duplicates(d.heroes.map((h) => h.id))) errors.push(`英雄 id 重复：${id}`);
  for (const id of duplicates(d.items.map((i) => i.id))) errors.push(`装备 id 重复：${id}`);
  for (const id of duplicates(d.versions.map((v) => v.id))) errors.push(`版本 id 重复：${id}`);

  for (const b of d.blessings) {
    if (b.exclusive_hero && !heroIds.has(b.exclusive_hero)) {
      errors.push(`福佑 ${b.id}：exclusive_hero "${b.exclusive_hero}" 不存在`);
    }
    if (b.since_version && !versionIds.has(b.since_version)) {
      errors.push(`福佑 ${b.id}：since_version "${b.since_version}" 不在 versions.yaml 中`);
    }
    for (const h of b.history) {
      if (!versionIds.has(h.version)) {
        errors.push(`福佑 ${b.id}：history 版本 "${h.version}" 不在 versions.yaml 中`);
      }
    }
  }

  for (const v of d.versions) {
    for (const c of v.changes) {
      if (c.blessing && !blessingIds.has(c.blessing)) {
        errors.push(`版本 ${v.id}：引用了不存在的福佑 "${c.blessing}"`);
      }
    }
  }

  for (const { file, data } of d.builds) {
    if (file !== `${data.hero}.md`) errors.push(`搭配 ${file}：文件名应为 ${data.hero}.md`);
    if (!heroIds.has(data.hero)) errors.push(`搭配 ${file}：英雄 "${data.hero}" 不存在`);
    for (const ref of data.blessings) {
      if (!blessingIds.has(ref.id)) errors.push(`搭配 ${file}：福佑 "${ref.id}" 不存在`);
    }
    for (const item of data.items) {
      if (!itemIds.has(item)) errors.push(`搭配 ${file}：装备 "${item}" 不存在`);
    }
  }
  for (const hero of duplicates(d.builds.map((b) => b.data.hero))) {
    errors.push(`英雄 ${hero} 有多个搭配文件`);
  }

  return errors;
}
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `npm test`
Expected: PASS（integrity 8 个 + url 3 个）

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add data schemas and cross-reference integrity checks"
```

---

### Task 3: 拼音索引与搜索

**Files:**
- Create: `src/lib/search-record.ts`, `src/lib/searcher.ts`, `src/lib/json.ts`, `tests/search.test.ts`

- [ ] **Step 1: 写失败测试 `tests/search.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { toSearchRecord } from '../src/lib/search-record';
import { applyCategory, createSearcher } from '../src/lib/searcher';
import { safeJson } from '../src/lib/json';
import { blessings } from './fixtures';

const records = blessings.map(toSearchRecord);
const search = createSearcher(records);
const ids = (q: string) => search(q).map((r) => r.id);

describe('toSearchRecord', () => {
  it('builds full pinyin and initials without tones or punctuation', () => {
    const r = toSearchRecord(blessings[1]);
    expect(r.py).toBe('dianchuisiwei');
    expect(r.pyInitials).toBe('dcsw');
  });
});

describe('createSearcher', () => {
  it('returns all records for an empty query', () => {
    expect(ids('  ')).toEqual(['wolf-core', 'electric-hammer', 'rescue']);
  });
  it('matches Chinese name substring first', () => {
    expect(ids('电锤')[0]).toBe('electric-hammer');
  });
  it('matches pinyin initials', () => {
    expect(ids('dc')[0]).toBe('electric-hammer');
    expect(ids('LWHX')[0]).toBe('wolf-core');
  });
  it('matches full pinyin with spaces', () => {
    expect(ids('dian chui')[0]).toBe('electric-hammer');
  });
  it('matches effect keywords', () => {
    expect(ids('冷却')).toContain('wolf-core');
    expect(ids('墓碑')).toContain('rescue');
  });
  it('returns nothing for garbage', () => {
    expect(ids('zzzzqqq')).toEqual([]);
  });
});

describe('applyCategory', () => {
  it('keeps everything when category is empty', () => {
    expect(applyCategory(records, '')).toHaveLength(3);
  });
  it('filters by category', () => {
    expect(applyCategory(records, '装备类').map((r) => r.id)).toEqual(['electric-hammer']);
  });
});

describe('safeJson', () => {
  it('escapes < so data cannot close a script tag', () => {
    expect(safeJson({ a: '</script>' })).toBe('{"a":"\\u003c/script>"}');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/search.test.ts`
Expected: FAIL，报错 `Failed to resolve import "../src/lib/search-record"`

- [ ] **Step 3: 实现 `src/lib/search-record.ts`**（只在构建时运行，pinyin-pro 不会进前端包）

```ts
import { pinyin } from 'pinyin-pro';
import type { Blessing } from './schema';

export interface SearchRecord {
  id: string;
  name: string;
  category: string;
  effect: string;
  tags: string[];
  py: string;
  pyInitials: string;
}

const toKey = (parts: string[]) => parts.join('').toLowerCase().replace(/[^a-z0-9]/g, '');

export function toSearchRecord(b: Blessing): SearchRecord {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    effect: b.effect,
    tags: b.tags,
    py: toKey(pinyin(b.name, { toneType: 'none', type: 'array' })),
    pyInitials: toKey(pinyin(b.name, { pattern: 'first', toneType: 'none', type: 'array' })),
  };
}
```

- [ ] **Step 4: 实现 `src/lib/searcher.ts`**

```ts
import Fuse from 'fuse.js';
import type { SearchRecord } from './search-record';

const normalize = (q: string) => q.trim().toLowerCase().replace(/\s+/g, '');

export function createSearcher(records: SearchRecord[]) {
  const fuse = new Fuse(records, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'pyInitials', weight: 2 },
      { name: 'py', weight: 2 },
      { name: 'tags', weight: 1.5 },
      { name: 'effect', weight: 1 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
  });

  return function search(query: string): SearchRecord[] {
    const q = normalize(query);
    if (!q) return records;
    // Exact name / pinyin prefix hits always rank above fuzzy hits.
    const exact = records.filter(
      (r) => r.name.toLowerCase().includes(q) || r.py.startsWith(q) || r.pyInitials.startsWith(q),
    );
    const seen = new Set(exact.map((r) => r.id));
    const fuzzy = fuse
      .search(q)
      .map((res) => res.item)
      .filter((r) => !seen.has(r.id));
    return [...exact, ...fuzzy];
  };
}

export function applyCategory(records: SearchRecord[], category: string): SearchRecord[] {
  return category ? records.filter((r) => r.category === category) : records;
}
```

- [ ] **Step 5: 实现 `src/lib/json.ts`**

```ts
// JSON for embedding inside <script type="application/json">.
export const safeJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `npm test`
Expected: PASS。如果 `zzzzqqq` 用例因为模糊匹配命中而失败，把 `threshold` 调到 `0.25` 再跑，**不要**改测试。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add pinyin search index and fuzzy searcher"
```

---

### Task 4: 对比 URL 状态与英雄 ↔ 福佑反查

**Files:**
- Create: `src/lib/compare.ts`, `src/lib/hero-blessings.ts`, `tests/compare.test.ts`, `tests/hero-blessings.test.ts`

- [ ] **Step 1: 写失败测试 `tests/compare.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { parseCompareIds, serializeCompareIds } from '../src/lib/compare';

const valid = new Set(['a', 'b', 'c', 'd']);

describe('parseCompareIds', () => {
  it('reads ids in order', () => {
    expect(parseCompareIds('?ids=b,a', valid)).toEqual(['b', 'a']);
  });
  it('drops unknown and duplicate ids and caps at 3', () => {
    expect(parseCompareIds('?ids=a,x,a,b,c,d', valid)).toEqual(['a', 'b', 'c']);
  });
  it('handles missing param', () => {
    expect(parseCompareIds('', valid)).toEqual([]);
  });
});

describe('serializeCompareIds', () => {
  it('skips empty slots', () => {
    expect(serializeCompareIds(['a', null, 'c'])).toBe('?ids=a,c');
  });
  it('returns empty string when nothing selected', () => {
    expect(serializeCompareIds([null, null, null])).toBe('');
  });
});
```

- [ ] **Step 2: 写失败测试 `tests/hero-blessings.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { blessingsForHero, heroesForBlessing } from '../src/lib/hero-blessings';
import { blessings, builds } from './fixtures';

describe('blessingsForHero', () => {
  it('lists build blessings in order with notes, then exclusive ones', () => {
    const out = blessingsForHero('axe', blessings, builds[0].data);
    expect(out.map((r) => [r.blessing.id, r.reason, r.note])).toEqual([
      ['electric-hammer', 'build', '前期经济'],
      ['wolf-core', 'build', undefined],
      ['rescue', 'exclusive', undefined],
    ]);
  });
  it('works without a build', () => {
    expect(blessingsForHero('antimage', blessings, undefined)).toEqual([]);
  });
});

describe('heroesForBlessing', () => {
  it('finds heroes whose build recommends the blessing', () => {
    expect(heroesForBlessing('wolf-core', builds.map((b) => b.data))).toEqual(['axe']);
    expect(heroesForBlessing('rescue', builds.map((b) => b.data))).toEqual([]);
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL，报错 `Failed to resolve import "../src/lib/compare"` 和 `"../src/lib/hero-blessings"`

- [ ] **Step 4: 实现 `src/lib/compare.ts`**

```ts
export const MAX_COMPARE = 3;

export function parseCompareIds(search: string, validIds: Set<string>): string[] {
  const raw = new URLSearchParams(search).get('ids') ?? '';
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((id) => validIds.has(id));
  return [...new Set(ids)].slice(0, MAX_COMPARE);
}

export function serializeCompareIds(slots: (string | null)[]): string {
  const ids = slots.filter((id): id is string => Boolean(id));
  return ids.length ? `?ids=${ids.join(',')}` : '';
}
```

- [ ] **Step 5: 实现 `src/lib/hero-blessings.ts`**

```ts
import type { Blessing, Build } from './schema';

export interface HeroBlessing {
  blessing: Blessing;
  note?: string;
  reason: 'build' | 'exclusive';
}

export function blessingsForHero(heroId: string, blessings: Blessing[], build: Build | undefined): HeroBlessing[] {
  const byId = new Map(blessings.map((b) => [b.id, b]));
  const seen = new Set<string>();
  const out: HeroBlessing[] = [];
  for (const ref of build?.blessings ?? []) {
    const b = byId.get(ref.id);
    if (!b || seen.has(b.id)) continue;
    seen.add(b.id);
    out.push({ blessing: b, note: ref.note, reason: 'build' });
  }
  for (const b of blessings) {
    if (b.exclusive_hero !== heroId || seen.has(b.id)) continue;
    seen.add(b.id);
    out.push({ blessing: b, reason: 'exclusive' });
  }
  return out;
}

export function heroesForBlessing(blessingId: string, builds: Build[]): string[] {
  return builds.filter((b) => b.blessings.some((ref) => ref.id === blessingId)).map((b) => b.hero);
}
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `npm test`
Expected: PASS（全部）

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add compare URL state and hero/blessing reverse index"
```

---

## 阶段 2：页面

### Task 5: 数据文件、collections 与校验脚本

**Files:**
- Create: `src/data/blessings.yaml`, `src/data/heroes.yaml`, `src/data/items.yaml`, `src/data/versions.yaml`, `src/content/builds/.gitkeep`, `src/content/guides/getting-started.md`, `src/content.config.ts`, `src/lib/load.ts`, `scripts/validate-data.ts`, `tests/load.test.ts`

- [ ] **Step 1: 写样例数据**（阶段 5 会用核实过的真实数据替换）

`src/data/blessings.yaml`：

```yaml
# 样例数据：名称与效果来自创意工坊描述的转述，Task 13 按原文校对后替换。
- id: wolf-core
  name: 狼王核心
  category: 团队类
  effect: 在双方泉水生成 3 个狼王核心，拾取者冷却缩减 8%，福佑持有者冷却缩减 3%
  numbers: { 拾取者冷却缩减: 8%, 持有者冷却缩减: 3% }
  tags: [冷却, 待核实]
  sources: [https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696]
- id: electric-hammer
  name: 电锤思维
  category: 装备类
  effect: 获得 3500 金币，携带的第一把深渊之刃升级为雷神之锤（真）
  numbers: { 金币: 3500 }
  tags: [经济, 待核实]
  sources: [https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696]
- id: rescue
  name: 救援
  category: 其他
  effect: 死亡后留下墓碑，3 秒后可在队友附近复活，等待期间可以购物
  tags: [复活, 待核实]
  sources: [https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696]
```

`src/data/heroes.yaml`（Task 12 会用脚本生成全量数据覆盖）：

```yaml
- { id: axe, name: 斧王, name_en: Axe, attr: str }
- { id: antimage, name: 敌法师, name_en: Anti-Mage, attr: agi }
- { id: crystal_maiden, name: 水晶室女, name_en: Crystal Maiden, attr: int }
```

`src/data/items.yaml`（Task 12 会覆盖）：

```yaml
- { id: abyssal_blade, name: 深渊之刃, name_en: Abyssal Blade }
- { id: blink, name: 闪烁匕首, name_en: Blink Dagger }
```

`src/data/versions.yaml`：

```yaml
# Newest first. id = 更新日期（北京时间）
[]
```

`src/content/guides/getting-started.md`：

```markdown
---
title: 新手入门
description: 五分钟了解福佑大乱斗和普通 Dota 的区别
order: 1
updated: 2026-09-29
sources:
  - https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696
---

福佑大乱斗是在原版 Dota 基础上加入 roguelike「三选一」元素的 PVP 地图。

- **福佑**：英雄每升 5 级可以从三个福佑中选一个，所有玩家抽到的福佑品质相同。
- **节奏更快**：中路机制和数值经过调整，有额外的经济、经验和英雄生命成长。

> 本文会在 Task 16 中按真实资料扩写。
```

然后执行 `touch src/content/builds/.gitkeep`。

- [ ] **Step 2: 写 `src/content.config.ts`**

```ts
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { blessingSchema, buildSchema, guideSchema, heroSchema, itemSchema, versionSchema } from './lib/schema';

export const collections = {
  blessings: defineCollection({ loader: file('src/data/blessings.yaml'), schema: blessingSchema }),
  heroes: defineCollection({ loader: file('src/data/heroes.yaml'), schema: heroSchema }),
  items: defineCollection({ loader: file('src/data/items.yaml'), schema: itemSchema }),
  versions: defineCollection({ loader: file('src/data/versions.yaml'), schema: versionSchema }),
  builds: defineCollection({ loader: glob({ base: './src/content/builds', pattern: '*.md' }), schema: buildSchema }),
  guides: defineCollection({ loader: glob({ base: './src/content/guides', pattern: '*.md' }), schema: guideSchema }),
};
```

- [ ] **Step 3: 写失败测试 `tests/load.test.ts`**

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDataSet, readFrontmatter } from '../src/lib/load';

function makeRepo(blessingsYaml: string): string {
  const root = mkdtempSync(join(tmpdir(), 'fuyou-'));
  mkdirSync(join(root, 'src/data'), { recursive: true });
  mkdirSync(join(root, 'src/content/builds'), { recursive: true });
  writeFileSync(join(root, 'src/data/blessings.yaml'), blessingsYaml);
  writeFileSync(join(root, 'src/data/heroes.yaml'), '- { id: axe, name: 斧王, name_en: Axe, attr: str }\n');
  writeFileSync(join(root, 'src/data/items.yaml'), '[]\n');
  writeFileSync(join(root, 'src/data/versions.yaml'), '[]\n');
  writeFileSync(
    join(root, 'src/content/builds/axe.md'),
    '---\nhero: axe\nsummary: 跳吼\nupdated: 2026-09-20\n---\n正文\n',
  );
  return root;
}

describe('readFrontmatter', () => {
  it('parses YAML between --- fences', () => {
    expect(readFrontmatter('---\na: 1\n---\nbody')).toEqual({ a: 1 });
  });
  it('returns empty object when absent', () => {
    expect(readFrontmatter('no fm')).toEqual({});
  });
});

describe('loadDataSet', () => {
  it('loads and applies schema defaults', () => {
    const root = makeRepo('- { id: x, name: 甲, category: 其他, effect: 效果 }\n');
    const d = loadDataSet(root);
    expect(d.blessings[0].tags).toEqual([]);
    expect(d.builds).toEqual([expect.objectContaining({ file: 'axe.md' })]);
    expect(d.builds[0].data.blessings).toEqual([]);
  });
  it('names the file when schema validation fails', () => {
    const root = makeRepo('- { id: x, name: 甲, category: 不存在的分类, effect: 效果 }\n');
    expect(() => loadDataSet(root)).toThrow(/blessings\.yaml/);
  });
});
```

- [ ] **Step 4: 运行测试，确认失败**

Run: `npm test -- tests/load.test.ts`
Expected: FAIL，报错 `Failed to resolve import "../src/lib/load"`

- [ ] **Step 5: 实现 `src/lib/load.ts`**

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import { blessingSchema, buildSchema, heroSchema, itemSchema, versionSchema } from './schema';
import type { DataSet } from './integrity';

function parseWith<T extends z.ZodType>(schema: T, raw: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`${label} 校验失败：\n${z.prettifyError(result.error)}`);
  return result.data;
}

function readYamlArray<T extends z.ZodType>(root: string, rel: string, schema: T): z.infer<T>[] {
  const raw = parse(readFileSync(join(root, rel), 'utf8')) ?? [];
  return parseWith(z.array(schema), raw, rel);
}

export function readFrontmatter(src: string): unknown {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
  return m ? (parse(m[1]) ?? {}) : {};
}

export function loadDataSet(root: string): DataSet {
  const buildsDir = join(root, 'src/content/builds');
  const buildFiles = existsSync(buildsDir) ? readdirSync(buildsDir).filter((f) => f.endsWith('.md')) : [];
  return {
    blessings: readYamlArray(root, 'src/data/blessings.yaml', blessingSchema),
    heroes: readYamlArray(root, 'src/data/heroes.yaml', heroSchema),
    items: readYamlArray(root, 'src/data/items.yaml', itemSchema),
    versions: readYamlArray(root, 'src/data/versions.yaml', versionSchema),
    builds: buildFiles.map((file) => ({
      file,
      data: parseWith(buildSchema, readFrontmatter(readFileSync(join(buildsDir, file), 'utf8')), `builds/${file}`),
    })),
  };
}
```

- [ ] **Step 6: 实现 `scripts/validate-data.ts`**

```ts
import { findBrokenRefs } from '../src/lib/integrity';
import { loadDataSet } from '../src/lib/load';

try {
  const data = loadDataSet(process.cwd());
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
```

- [ ] **Step 7: 运行测试和校验**

Run: `npm test && npm run validate`
Expected: 测试全部 PASS；validate 输出 `✓ 数据校验通过：3 个福佑、3 个英雄、2 件装备、0 个版本、0 份搭配`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add data files, content collections and validate script"
```

---

### Task 6: 布局、样式与通用组件

**Files:**
- Create: `src/lib/site.ts`, `src/lib/categories.ts`, `src/lib/assets.ts`, `src/styles/global.css`, `src/layouts/Base.astro`, `src/components/BlessingIcon.astro`, `src/components/BlessingCard.astro`, `src/components/HeroImage.astro`, `src/components/ItemImage.astro`, `public/favicon.svg`

- [ ] **Step 1: 写常量模块**

`src/lib/site.ts`：

```ts
export const SITE_NAME = '福佑大乱斗 · 图鉴与攻略';
export const REPO_URL = 'https://github.com/Comet32/fuyou-brawl';
export const WORKSHOP_ID = '2841152696';
export const WORKSHOP_URL = `https://steamcommunity.com/sharedfiles/filedetails/?id=${WORKSHOP_ID}`;
```

`src/lib/categories.ts`：

```ts
import type { Category } from './schema';

// Mid-saturation colors readable on both dark and light surfaces.
export const CATEGORY_COLORS: Record<Category, string> = {
  装备类: '#d9a441',
  属性类: '#e0625a',
  技能类: '#5b8def',
  召唤类: '#9b6cd8',
  经济类: '#e8c547',
  团队类: '#3fb68b',
  其他: '#8a94a6',
};
```

`src/lib/assets.ts`：

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Build-time check so pages can fall back when an image has not been fetched yet.
export const publicFileExists = (rel: string): boolean => existsSync(join(process.cwd(), 'public', rel));
```

- [ ] **Step 2: 写 `src/styles/global.css`**

```css
:root {
  --bg: #0f1115;
  --surface: #181b22;
  --surface-2: #20242d;
  --border: #2c313c;
  --text: #e6e8ec;
  --muted: #9aa1ad;
  --accent: #d9a441;
  --accent-text: #1a1406;
  --radius: 10px;
  --gap: 12px;
  --header-h: 48px;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme='dark']) {
    --bg: #f6f7f9;
    --surface: #ffffff;
    --surface-2: #eef0f3;
    --border: #dde1e7;
    --text: #1b1e24;
    --muted: #5f6673;
    --accent: #a8741a;
    --accent-text: #ffffff;
    color-scheme: light;
  }
}
:root[data-theme='light'] {
  --bg: #f6f7f9;
  --surface: #ffffff;
  --surface-2: #eef0f3;
  --border: #dde1e7;
  --text: #1b1e24;
  --muted: #5f6673;
  --accent: #a8741a;
  --accent-text: #ffffff;
  color-scheme: light;
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.6 system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
a { color: var(--accent); }
h1 { font-size: 24px; margin: 8px 0 12px; }
h2 { font-size: 18px; margin: 24px 0 8px; }
main { max-width: 960px; margin: 0 auto; padding: 16px; }
.muted { color: var(--muted); }
.empty { padding: 16px; border: 1px dashed var(--border); border-radius: var(--radius); color: var(--muted); }

.site-header {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 8px;
  height: var(--header-h); padding: 0 16px;
  background: var(--surface); border-bottom: 1px solid var(--border);
  overflow-x: auto;
}
.brand { font-weight: 700; color: var(--text); text-decoration: none; white-space: nowrap; }
.site-header nav { display: flex; gap: 2px; }
.site-header nav a { padding: 6px 10px; border-radius: 6px; color: var(--muted); text-decoration: none; white-space: nowrap; }
.site-header nav a[aria-current='page'] { color: var(--text); background: var(--surface-2); }
#theme-toggle {
  margin-left: auto; flex: none;
  background: none; border: 1px solid var(--border); color: var(--text);
  border-radius: 6px; padding: 4px 10px; font-size: 16px;
}
.site-footer { max-width: 960px; margin: 32px auto; padding: 0 16px; color: var(--muted); font-size: 13px; }

.search-box { position: sticky; top: var(--header-h); z-index: 5; background: var(--bg); padding: 8px 0; }
.search-input {
  width: 100%; font-size: 18px; padding: 12px 14px;
  border-radius: var(--radius); border: 1px solid var(--border);
  background: var(--surface); color: var(--text);
}
.search-input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
.chips { display: flex; gap: 6px; overflow-x: auto; padding: 8px 0 4px; }
.chip {
  flex: none; border: 1px solid var(--border); background: var(--surface); color: var(--muted);
  border-radius: 999px; padding: 4px 12px; font-size: 14px;
}
.chip[aria-pressed='true'] { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }

.card-list {
  list-style: none; padding: 0; margin: 0;
  display: grid; gap: var(--gap); grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}
.blessing-card {
  display: flex; gap: 12px; padding: 12px; height: 100%;
  background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--cat);
  border-radius: var(--radius);
}
.blessing-card h3 { margin: 0; font-size: 17px; }
.blessing-card h3 a { color: var(--text); text-decoration: none; }
.blessing-meta { margin: 2px 0 6px; display: flex; flex-wrap: wrap; gap: 4px; font-size: 12px; }
.blessing-meta .cat { color: var(--cat); font-weight: 600; margin-right: 4px; }
.tag { padding: 0 6px; border-radius: 4px; background: var(--surface-2); color: var(--muted); }
.blessing-effect { margin: 0; font-size: 15px; }
.blessing-note { margin: 6px 0 0; font-size: 14px; color: var(--muted); }
.blessing-icon {
  flex: none; width: 48px; height: 48px; border-radius: 8px;
  background: var(--cat); display: grid; place-items: center;
  font-weight: 700; font-size: 20px; color: #111;
}
.blessing-icon img { width: 100%; height: 100%; border-radius: 8px; object-fit: cover; }

.hero-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); padding: 0; list-style: none; }
.hero-tile { display: block; text-decoration: none; color: var(--text); font-size: 13px; text-align: center; }
.hero-tile.no-build { opacity: 0.55; }
.hero-img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 6px; background: var(--surface-2); display: grid; place-items: center; }
.hero-head { display: flex; gap: 12px; align-items: center; }
.hero-head .hero-img { width: 128px; flex: none; }
.item-list { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.item-list li { display: flex; align-items: center; gap: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px 4px 4px; }
.item-img { width: 44px; height: 32px; object-fit: cover; border-radius: 4px; }

.compare-grid { display: grid; gap: var(--gap); grid-template-columns: 1fr; }
@media (min-width: 720px) { .compare-grid { grid-template-columns: repeat(3, 1fr); } }
.compare-slot { position: relative; display: flex; flex-direction: column; gap: 8px; }
.suggestions {
  position: absolute; top: 52px; left: 0; right: 0; z-index: 6;
  list-style: none; margin: 0; padding: 4px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
}
.suggestions button { width: 100%; text-align: left; padding: 8px 10px; background: none; border: 0; color: var(--text); border-radius: 6px; font-size: 15px; }
.suggestions button:hover, .suggestions button:focus { background: var(--surface-2); }

.numbers { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; }
.numbers dt { color: var(--muted); }
.numbers dd { margin: 0; }
.version { padding: 12px 0; border-bottom: 1px solid var(--border); }
.prose { max-width: 720px; }
.prose img { max-width: 100%; }
```

- [ ] **Step 3: 写 `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#d9a441"/><text x="16" y="23" font-size="18" text-anchor="middle" font-family="sans-serif" font-weight="700" fill="#1a1406">福</text></svg>
```

- [ ] **Step 4: 写 `src/layouts/Base.astro`**

```astro
---
import '../styles/global.css';
import { url } from '../lib/url';
import { REPO_URL, SITE_NAME } from '../lib/site';

interface Props {
  title?: string;
  description?: string;
}
const { title, description = '《福佑大乱斗》福佑图鉴、英雄搭配、版本变动与攻略' } = Astro.props;
const fullTitle = title ? `${title} · 福佑大乱斗` : SITE_NAME;
const home = url('/');
const nav = [
  { href: home, label: '图鉴' },
  { href: url('/compare/'), label: '对比' },
  { href: url('/heroes/'), label: '英雄' },
  { href: url('/versions/'), label: '版本' },
  { href: url('/guides/'), label: '攻略' },
];
const path = Astro.url.pathname;
const isCurrent = (href: string) => (href === home ? path === home : path.startsWith(href));
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <meta name="color-scheme" content="dark light" />
    <title>{fullTitle}</title>
    <link rel="icon" href={url('/favicon.svg')} type="image/svg+xml" />
    <script is:inline>
      try {
        const t = localStorage.getItem('theme');
        if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
      } catch {}
    </script>
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href={home}>福佑图鉴</a>
      <nav>
        {nav.map((n) => <a href={n.href} aria-current={isCurrent(n.href) ? 'page' : undefined}>{n.label}</a>)}
      </nav>
      <button id="theme-toggle" type="button" aria-label="切换深浅色">◐</button>
    </header>
    <main><slot /></main>
    <footer class="site-footer">
      <p>
        非官方玩家攻略站，数据整理自 Steam 创意工坊与社区，可能滞后于游戏版本。
        发现错误？<a href={REPO_URL}>在 GitHub 上提交修改</a>
      </p>
    </footer>
    <script>
      document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const root = document.documentElement;
        const isDark = root.dataset.theme
          ? root.dataset.theme === 'dark'
          : !matchMedia('(prefers-color-scheme: light)').matches;
        const next = isDark ? 'light' : 'dark';
        root.dataset.theme = next;
        try {
          localStorage.setItem('theme', next);
        } catch {}
      });
    </script>
  </body>
</html>
```

- [ ] **Step 5: 写组件**

`src/components/BlessingIcon.astro`：

```astro
---
import type { Blessing } from '../lib/schema';
import { CATEGORY_COLORS } from '../lib/categories';
import { url } from '../lib/url';

interface Props {
  blessing: Blessing;
}
const { blessing } = Astro.props;
---

<div class="blessing-icon" style={`--cat:${CATEGORY_COLORS[blessing.category]}`}>
  {
    blessing.icon ? (
      <img src={url(`/img/blessings/${blessing.icon}`)} alt="" width="48" height="48" loading="lazy" />
    ) : (
      <span aria-hidden="true">{blessing.name.slice(0, 1)}</span>
    )
  }
</div>
```

`src/components/BlessingCard.astro`：

```astro
---
import type { Blessing } from '../lib/schema';
import { CATEGORY_COLORS } from '../lib/categories';
import { url } from '../lib/url';
import BlessingIcon from './BlessingIcon.astro';

interface Props {
  blessing: Blessing;
  note?: string;
}
const { blessing, note } = Astro.props;
---

<article class="blessing-card" style={`--cat:${CATEGORY_COLORS[blessing.category]}`}>
  <BlessingIcon blessing={blessing} />
  <div>
    <h3><a href={url(`/blessings/${blessing.id}/`)}>{blessing.name}</a></h3>
    <p class="blessing-meta">
      <span class="cat">{blessing.category}</span>
      {blessing.tags.map((t) => <span class="tag">{t}</span>)}
    </p>
    <p class="blessing-effect">{blessing.effect}</p>
    {note && <p class="blessing-note">💡 {note}</p>}
  </div>
</article>
```

`src/components/HeroImage.astro`：

```astro
---
import type { Hero } from '../lib/schema';
import { publicFileExists } from '../lib/assets';
import { url } from '../lib/url';

interface Props {
  hero: Hero;
}
const { hero } = Astro.props;
const rel = `img/heroes/${hero.id}.webp`;
---

{
  publicFileExists(rel) ? (
    <img class="hero-img" src={url(rel)} alt="" width="256" height="144" loading="lazy" />
  ) : (
    <span class="hero-img" aria-hidden="true">{hero.name.slice(0, 1)}</span>
  )
}
```

`src/components/ItemImage.astro`：

```astro
---
import { publicFileExists } from '../lib/assets';
import { url } from '../lib/url';

interface Props {
  id: string;
}
const rel = `img/items/${Astro.props.id}.webp`;
---

{publicFileExists(rel) && <img class="item-img" src={url(rel)} alt="" width="88" height="64" loading="lazy" />}
```

- [ ] **Step 6: 类型检查**

Run: `npx astro sync && npm run check`
Expected: `0 errors`（此时页面还没写，只检查组件）

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add base layout, theme tokens and shared components"
```

---

### Task 7: 首页图鉴与三选一对比

**Files:**
- Create: `src/pages/index.astro`, `src/scripts/search-page.ts`, `src/pages/compare.astro`, `src/scripts/compare-page.ts`

- [ ] **Step 1: 写 `src/pages/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../layouts/Base.astro';
import BlessingCard from '../components/BlessingCard.astro';
import { CATEGORIES } from '../lib/schema';
import { toSearchRecord } from '../lib/search-record';
import { safeJson } from '../lib/json';

const blessings = (await getCollection('blessings'))
  .map((e) => e.data)
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
const records = blessings.map(toSearchRecord);
const categories = CATEGORIES.filter((c) => blessings.some((b) => b.category === c));
---

<Base>
  <div class="search-box">
    <input
      id="q"
      class="search-input"
      type="search"
      placeholder="搜福佑：名称 / 拼音首字母 / 效果关键词"
      autocomplete="off"
      enterkeyhint="search"
      autofocus
    />
    <div class="chips" role="group" aria-label="按分类筛选">
      <button class="chip" type="button" data-cat="" aria-pressed="true">全部</button>
      {categories.map((c) => <button class="chip" type="button" data-cat={c} aria-pressed="false">{c}</button>)}
    </div>
    <p id="count" class="muted" aria-live="polite">共 {blessings.length} 个福佑</p>
  </div>
  <ul id="results" class="card-list">
    {blessings.map((b) => <li data-id={b.id}><BlessingCard blessing={b} /></li>)}
  </ul>
  <p id="no-result" class="empty" hidden>没找到，换个关键词试试（支持拼音首字母，比如 dcsw）</p>
  <script type="application/json" id="search-data" set:html={safeJson(records)} />
  <script>
    import { initSearchPage } from '../scripts/search-page';
    initSearchPage();
  </script>
</Base>
```

- [ ] **Step 2: 写 `src/scripts/search-page.ts`**

```ts
import { applyCategory, createSearcher } from '../lib/searcher';
import type { SearchRecord } from '../lib/search-record';

export function initSearchPage(): void {
  const data = document.getElementById('search-data');
  const input = document.getElementById('q') as HTMLInputElement | null;
  const list = document.getElementById('results');
  const count = document.getElementById('count');
  const empty = document.getElementById('no-result');
  if (!data || !input || !list || !count || !empty) return;

  const records: SearchRecord[] = JSON.parse(data.textContent ?? '[]');
  const search = createSearcher(records);
  const items = new Map<string, HTMLElement>();
  list.querySelectorAll<HTMLElement>('li[data-id]').forEach((li) => items.set(li.dataset.id!, li));
  const chips = [...document.querySelectorAll<HTMLButtonElement>('.chip[data-cat]')];
  let category = '';

  const render = () => {
    const results = applyCategory(search(input.value), category);
    const shown = new Set(results.map((r) => r.id));
    for (const r of results) {
      const li = items.get(r.id);
      if (li) list.appendChild(li); // re-order by relevance
    }
    items.forEach((li, id) => (li.hidden = !shown.has(id)));
    const filtered = input.value.trim() !== '' || category !== '';
    count.textContent = filtered ? `找到 ${results.length} 个` : `共 ${records.length} 个福佑`;
    empty.hidden = results.length > 0;

    const params = new URLSearchParams(location.search);
    if (input.value.trim()) params.set('q', input.value.trim());
    else params.delete('q');
    const qs = params.toString();
    history.replaceState(null, '', qs ? `${location.pathname}?${qs}` : location.pathname);
  };

  input.value = new URLSearchParams(location.search).get('q') ?? '';
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      render();
    }
  });
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      category = chip.dataset.cat ?? '';
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      render();
    });
  }
  if (input.value) render();
}
```

- [ ] **Step 3: 写 `src/pages/compare.astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../layouts/Base.astro';
import BlessingCard from '../components/BlessingCard.astro';
import { toSearchRecord } from '../lib/search-record';
import { safeJson } from '../lib/json';

const blessings = (await getCollection('blessings'))
  .map((e) => e.data)
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
const records = blessings.map(toSearchRecord);
---

<Base title="三选一对比">
  <h1>三选一对比</h1>
  <p class="muted">对局里抽到三个福佑？分别搜出来并排看。回车选第一个结果并跳到下一格；链接可以直接分享。</p>
  <div class="compare-grid">
    {
      [0, 1, 2].map((i) => (
        <section class="compare-slot" data-slot={i}>
          <input class="search-input" type="search" placeholder={`福佑 ${i + 1}`} autocomplete="off" enterkeyhint="next" />
          <ul class="suggestions" hidden />
          <div class="slot-card" />
        </section>
      ))
    }
  </div>
  <div id="card-pool" hidden>
    {blessings.map((b) => <div data-id={b.id}><BlessingCard blessing={b} /></div>)}
  </div>
  <script type="application/json" id="search-data" set:html={safeJson(records)} />
  <script>
    import { initComparePage } from '../scripts/compare-page';
    initComparePage();
  </script>
</Base>
```

- [ ] **Step 4: 写 `src/scripts/compare-page.ts`**

```ts
import { parseCompareIds, serializeCompareIds } from '../lib/compare';
import { createSearcher } from '../lib/searcher';
import type { SearchRecord } from '../lib/search-record';

export function initComparePage(): void {
  const data = document.getElementById('search-data');
  if (!data) return;
  const records: SearchRecord[] = JSON.parse(data.textContent ?? '[]');
  const search = createSearcher(records);
  const byId = new Map(records.map((r) => [r.id, r]));
  const pool = new Map<string, Element>();
  document.querySelectorAll<HTMLElement>('#card-pool > [data-id]').forEach((el) => pool.set(el.dataset.id!, el));
  const slots = [...document.querySelectorAll<HTMLElement>('.compare-slot')];
  const selected: (string | null)[] = slots.map(() => null);

  const choose = (i: number, id: string | null) => {
    selected[i] = id;
    const slot = slots[i];
    const input = slot.querySelector('input')!;
    const card = slot.querySelector('.slot-card')!;
    card.replaceChildren();
    if (id) {
      const src = pool.get(id);
      if (src) card.appendChild(src.cloneNode(true));
      input.value = byId.get(id)?.name ?? '';
    }
    slot.querySelector<HTMLElement>('.suggestions')!.hidden = true;
    history.replaceState(null, '', location.pathname + serializeCompareIds(selected));
  };

  slots.forEach((slot, i) => {
    const input = slot.querySelector('input')!;
    const box = slot.querySelector<HTMLUListElement>('.suggestions')!;
    input.addEventListener('input', () => {
      if (!input.value.trim()) {
        choose(i, null);
        return;
      }
      const hits = search(input.value).slice(0, 6);
      box.replaceChildren(
        ...hits.map((r) => {
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = `${r.name} · ${r.category}`;
          btn.addEventListener('click', () => choose(i, r.id));
          li.appendChild(btn);
          return li;
        }),
      );
      box.hidden = hits.length === 0;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !input.value.trim()) return;
      const first = search(input.value)[0];
      if (!first) return;
      choose(i, first.id);
      slots[i + 1]?.querySelector('input')?.focus();
    });
  });

  parseCompareIds(location.search, new Set(byId.keys())).forEach((id, i) => choose(i, id));
  if (!selected.some(Boolean)) slots[0]?.querySelector('input')?.focus();
}
```

- [ ] **Step 5: 本地手动验证**

Run: `npm run dev`，在浏览器（built-in browser pane）里打开 `http://localhost:4321/`，逐项检查：
- 首页显示 3 张卡片，计数为「共 3 个福佑」
- 输入 `dc`：电锤思维排第一，计数变成「找到 N 个」，URL 带上 `?q=dc`
- 输入 `冷却`：狼王核心出现
- 点击「装备类」chip：只剩电锤思维
- 按 Esc 清空后，恢复全部卡片，原顺序不变
- 打开 `/compare/`，第一格输入 `lwhx` 后回车：显示狼王核心卡片，焦点跳到第二格，URL 变成 `?ids=wolf-core`
- 刷新 `/compare/?ids=rescue,wolf-core`：前两格已经填好
- 切换到手机视口（375×812）：对比三格改成纵向排列，页面没有横向滚动条
- 点击 ◐：深浅色切换，刷新后保持

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add blessing search home page and compare page"
```

---

### Task 8: 福佑详情、英雄、版本、攻略页面

**Files:**
- Create: `src/pages/blessings/[id].astro`, `src/pages/heroes/index.astro`, `src/pages/heroes/[id].astro`, `src/pages/versions.astro`, `src/pages/guides/index.astro`, `src/pages/guides/[id].astro`

- [ ] **Step 1: 写 `src/pages/blessings/[id].astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../../layouts/Base.astro';
import BlessingCard from '../../components/BlessingCard.astro';
import { heroesForBlessing } from '../../lib/hero-blessings';
import { url } from '../../lib/url';

export async function getStaticPaths() {
  const blessings = await getCollection('blessings');
  return blessings.map((e) => ({ params: { id: e.data.id }, props: { blessing: e.data } }));
}

const { blessing } = Astro.props;
const builds = (await getCollection('builds')).map((e) => e.data);
const heroes = new Map((await getCollection('heroes')).map((e) => [e.data.id, e.data]));
const recommendedBy = heroesForBlessing(blessing.id, builds)
  .map((id) => heroes.get(id))
  .filter((h) => h !== undefined);
const exclusive = blessing.exclusive_hero ? heroes.get(blessing.exclusive_hero) : undefined;
const numbers = Object.entries(blessing.numbers);
---

<Base title={blessing.name} description={blessing.effect}>
  <p><a href={url('/')}>← 返回图鉴</a></p>
  <BlessingCard blessing={blessing} />

  {exclusive && <p>专属英雄：<a href={url(`/heroes/${exclusive.id}/`)}>{exclusive.name}</a></p>}

  {
    numbers.length > 0 && (
      <section>
        <h2>数值</h2>
        <dl class="numbers">
          {numbers.map(([k, v]) => (
            <Fragment>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </Fragment>
          ))}
        </dl>
      </section>
    )
  }

  <section>
    <h2>推荐搭配的英雄</h2>
    {
      recommendedBy.length > 0 ? (
        <p>{recommendedBy.map((h, i) => <Fragment>{i > 0 && '、'}<a href={url(`/heroes/${h.id}/`)}>{h.name}</a></Fragment>)}</p>
      ) : (
        <p class="muted">暂无，欢迎补充</p>
      )
    }
  </section>

  <section>
    <h2>改动历史</h2>
    {
      blessing.history.length > 0 ? (
        <ol>
          {blessing.history.map((h) => (
            <li>
              <a href={url(`/versions/#v-${h.version}`)}>{h.version}</a>：{h.change}
            </li>
          ))}
        </ol>
      ) : (
        <p class="muted">{blessing.since_version ? `自 ${blessing.since_version} 起暂无改动记录` : '暂无记录'}</p>
      )
    }
  </section>

  {
    blessing.sources.length > 0 && (
      <section>
        <h2>参考来源</h2>
        <ul>
          {blessing.sources.map((s) => (
            <li><a href={s} target="_blank" rel="noopener">{s}</a></li>
          ))}
        </ul>
      </section>
    )
  }
</Base>
```

- [ ] **Step 2: 写 `src/pages/heroes/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../../layouts/Base.astro';
import HeroImage from '../../components/HeroImage.astro';
import { ATTRS, ATTR_LABELS } from '../../lib/schema';
import { url } from '../../lib/url';

const heroes = (await getCollection('heroes'))
  .map((e) => e.data)
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
const withBuild = new Set((await getCollection('builds')).map((e) => e.data.hero));
---

<Base title="英雄">
  <h1>英雄搭配</h1>
  <p class="muted">共 {heroes.length} 个英雄，其中 {withBuild.size} 个已有搭配攻略（半透明的待补充）。</p>
  {
    ATTRS.map((attr) => {
      const group = heroes.filter((h) => h.attr === attr);
      return group.length === 0 ? null : (
        <section>
          <h2>{ATTR_LABELS[attr]}</h2>
          <ul class="hero-grid">
            {group.map((h) => (
              <li>
                <a class:list={['hero-tile', { 'no-build': !withBuild.has(h.id) }]} href={url(`/heroes/${h.id}/`)}>
                  <HeroImage hero={h} />
                  {h.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      );
    })
  }
</Base>
```

- [ ] **Step 3: 写 `src/pages/heroes/[id].astro`**

```astro
---
import { getCollection, render } from 'astro:content';
import Base from '../../layouts/Base.astro';
import BlessingCard from '../../components/BlessingCard.astro';
import HeroImage from '../../components/HeroImage.astro';
import ItemImage from '../../components/ItemImage.astro';
import { ATTR_LABELS } from '../../lib/schema';
import { blessingsForHero } from '../../lib/hero-blessings';
import { REPO_URL } from '../../lib/site';
import { url } from '../../lib/url';

export async function getStaticPaths() {
  const heroes = await getCollection('heroes');
  return heroes.map((e) => ({ params: { id: e.data.id }, props: { hero: e.data } }));
}

const { hero } = Astro.props;
const buildEntry = (await getCollection('builds')).find((e) => e.data.hero === hero.id);
const build = buildEntry?.data;
const Content = buildEntry ? (await render(buildEntry)).Content : null;
const blessings = (await getCollection('blessings')).map((e) => e.data);
const related = blessingsForHero(hero.id, blessings, build);
const items = new Map((await getCollection('items')).map((e) => [e.data.id, e.data]));
---

<Base title={hero.name}>
  <p><a href={url('/heroes/')}>← 全部英雄</a></p>
  <header class="hero-head">
    <HeroImage hero={hero} />
    <div>
      <h1>{hero.name}</h1>
      <p class="muted">{hero.name_en} · {ATTR_LABELS[hero.attr]}</p>
    </div>
  </header>

  {
    build ? (
      <p>{build.summary} <span class="muted">（更新于 {build.updated}）</span></p>
    ) : (
      <p class="empty">
        这个英雄的搭配攻略待补充。
        <a href={`${REPO_URL}/new/main/src/content/builds?filename=${hero.id}.md`}>在 GitHub 上补充</a>
      </p>
    )
  }

  <section>
    <h2>推荐福佑</h2>
    {
      related.length > 0 ? (
        <ul class="card-list">
          {related.map((r) => (
            <li><BlessingCard blessing={r.blessing} note={r.note ?? (r.reason === 'exclusive' ? '专属福佑' : undefined)} /></li>
          ))}
        </ul>
      ) : (
        <p class="muted">暂无</p>
      )
    }
  </section>

  {
    build && build.items.length > 0 && (
      <section>
        <h2>推荐出装</h2>
        <ul class="item-list">
          {build.items.map((id) => (
            <li><ItemImage id={id} />{items.get(id)?.name ?? id}</li>
          ))}
        </ul>
      </section>
    )
  }

  {
    Content && (
      <section class="prose">
        <h2>思路</h2>
        <Content />
      </section>
    )
  }

  {
    build && build.sources.length > 0 && (
      <section>
        <h2>参考来源</h2>
        <ul>{build.sources.map((s) => <li><a href={s} target="_blank" rel="noopener">{s}</a></li>)}</ul>
      </section>
    )
  }
</Base>
```

- [ ] **Step 4: 写 `src/pages/versions.astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../layouts/Base.astro';
import { WORKSHOP_ID } from '../lib/site';
import { url } from '../lib/url';

const versions = (await getCollection('versions')).map((e) => e.data).sort((a, b) => b.id.localeCompare(a.id));
const names = new Map((await getCollection('blessings')).map((e) => [e.data.id, e.data.name]));
const changelog = `https://steamcommunity.com/sharedfiles/filedetails/changelog/${WORKSHOP_ID}`;
---

<Base title="版本变动">
  <h1>版本变动</h1>
  <p class="muted">整理自 <a href={changelog} target="_blank" rel="noopener">创意工坊更新日志</a>，按时间倒序。</p>
  {versions.length === 0 && <p class="empty">还没有整理版本记录。</p>}
  {
    versions.map((v) => (
      <article class="version" id={`v-${v.id}`}>
        <h2>{v.id} · {v.title}</h2>
        <ul>
          {v.changes.map((c) => (
            <li>
              {c.blessing && <Fragment><a href={url(`/blessings/${c.blessing}/`)}>{names.get(c.blessing)}</a>：</Fragment>}
              {c.text}
            </li>
          ))}
        </ul>
        {v.source_url && <p><a href={v.source_url} target="_blank" rel="noopener">原文</a></p>}
      </article>
    ))
  }
</Base>
```

- [ ] **Step 5: 写攻略页面**

`src/pages/guides/index.astro`：

```astro
---
import { getCollection } from 'astro:content';
import Base from '../../layouts/Base.astro';
import { url } from '../../lib/url';

const guides = (await getCollection('guides')).sort((a, b) => a.data.order - b.data.order);
---

<Base title="攻略">
  <h1>攻略文章</h1>
  <ul class="card-list">
    {
      guides.map((g) => (
        <li>
          <article class="blessing-card" style="--cat: var(--accent)">
            <div>
              <h3><a href={url(`/guides/${g.id}/`)}>{g.data.title}</a></h3>
              <p class="blessing-effect">{g.data.description}</p>
              <p class="blessing-note">更新于 {g.data.updated}</p>
            </div>
          </article>
        </li>
      ))
    }
  </ul>
</Base>
```

`src/pages/guides/[id].astro`：

```astro
---
import { getCollection, render } from 'astro:content';
import Base from '../../layouts/Base.astro';
import { url } from '../../lib/url';

export async function getStaticPaths() {
  const guides = await getCollection('guides');
  return guides.map((g) => ({ params: { id: g.id }, props: { guide: g } }));
}

const { guide } = Astro.props;
const { Content } = await render(guide);
---

<Base title={guide.data.title} description={guide.data.description}>
  <p><a href={url('/guides/')}>← 全部攻略</a></p>
  <article class="prose">
    <h1>{guide.data.title}</h1>
    <p class="muted">更新于 {guide.data.updated}</p>
    <Content />
    {
      guide.data.sources.length > 0 && (
        <Fragment>
          <h2>参考来源</h2>
          <ul>{guide.data.sources.map((s) => <li><a href={s} target="_blank" rel="noopener">{s}</a></li>)}</ul>
        </Fragment>
      )
    }
  </article>
</Base>
```

- [ ] **Step 6: 完整构建与检查**

Run: `npm test && npm run validate && npm run check && npm run build`
Expected: 全部通过；`dist/` 里生成 `index.html`、`compare/index.html`、`blessings/*/index.html`（3 个）、`heroes/*/index.html`（3 个 + index）、`versions/index.html`、`guides/getting-started/index.html`。

再用子路径构建一次，确认 base 生效：

Run: `SITE_URL=https://comet32.github.io SITE_BASE=/fuyou-brawl/ npm run build && grep -o 'href="/fuyou-brawl/heroes/"' dist/index.html | head -1`
Expected: 输出 `href="/fuyou-brawl/heroes/"`

- [ ] **Step 7: 本地手动验证**

`npm run dev`，逐个页面点一遍：福佑详情页（数值、历史、来源都能显示）、英雄列表（3 个都是半透明的「待补充」状态）、英雄详情（救援应该以「专属福佑」显示在斧王页面上）、版本页（空状态）、攻略列表和详情。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add blessing detail, heroes, versions and guides pages"
```

---

## 阶段 3：部署

### Task 9: GitHub 仓库与 GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: 写 `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run validate
      - run: npm run build
        env:
          SITE_URL: https://comet32.github.io
          SITE_BASE: /fuyou-brawl/
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "ci: deploy to GitHub Pages"
```

- [ ] **Step 3: 确认 gh 账号**

Run: `gh auth status`
Expected: 当前活跃账号是 `Comet32`。

- [ ] **Step 4: 创建公开仓库并推送**（**先征得用户同意**，这是对外发布）

```bash
gh repo create Comet32/fuyou-brawl --public --source . --remote origin --description "Dota2 游廊《福佑大乱斗》福佑图鉴与攻略" --push
```

- [ ] **Step 5: 启用 Pages（来源选 GitHub Actions）**

```bash
gh api -X POST repos/Comet32/fuyou-brawl/pages -f build_type=workflow
gh workflow run deploy.yml
gh run watch --exit-status
```

Expected: workflow 成功完成。然后打开 `https://comet32.github.io/fuyou-brawl/`，页面能正常显示，样式和图标都能加载，站内链接都带着 `/fuyou-brawl/` 前缀。

---

### Task 10: Cloudflare Pages 备用镜像

**Files:** 无代码改动（这个任务由用户在 Cloudflare 控制台操作，我在旁边指导）

- [ ] **Step 1: 用户注册或登录 Cloudflare，然后在控制台操作**

Workers & Pages → Create → Pages → Connect to Git → 授权 GitHub 并选择 `fuyou-brawl` 仓库 → 按下面填写：
- Project name：`fuyou-brawl`
- Production branch：`main`
- Framework preset：Astro
- Build command：`npm run build`
- Build output directory：`dist`
- Environment variables：`NODE_VERSION` = `22`（**不要**设置 `SITE_BASE`，这样备用站就部署在根路径）

- [ ] **Step 2: 验证**

打开 `https://fuyou-brawl.pages.dev/`（如果名字被占用了，Cloudflare 会自动加后缀，以实际分配的域名为准），页面正常，链接不带 `/fuyou-brawl/` 前缀。如果实际域名和默认不一样，更新 `astro.config.mjs` 里 `SITE_URL` 的默认值并提交。

- [ ] **Step 3: 在 README 里写上两个地址**（Task 19 统一写）

---

## 阶段 4：自动化

### Task 11: 创意工坊更新检查

**Files:**
- Create: `src/lib/workshop.ts`, `tests/workshop.test.ts`, `tests/fixtures/changelog.html`, `scripts/check-workshop-update.ts`, `.github/workflows/watch-workshop.yml`

- [ ] **Step 1: 写夹具 `tests/fixtures/changelog.html`**（按 Steam 更新日志页的结构手写。Step 7 会用真实页面核对）

```html
<div class="workshopAnnouncement">
  <div class="changelog headline">更新于：2026 年 9 月 28 日 下午 8:00</div>
  <p id="1790596800">【福佑调整】<br>电锤思维：金币 3000→3500<br>新增福佑「救援」 &amp; 修复若干问题</p>
</div>
<div class="workshopAnnouncement">
  <div class="changelog headline">更新于：2026 年 9 月 1 日 下午 8:00</div>
  <p id="1788264000">秋季更新</p>
</div>
```

- [ ] **Step 2: 写失败测试 `tests/workshop.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIssue, formatBeijingDate, htmlToText, parseChangelog } from '../src/lib/workshop';

const html = readFileSync(new URL('./fixtures/changelog.html', import.meta.url), 'utf8');
const URL_ = 'https://steamcommunity.com/sharedfiles/filedetails/changelog/2841152696';

describe('htmlToText', () => {
  it('converts <br> to newlines and decodes entities', () => {
    expect(htmlToText('a<br>b &amp; <b>c</b>')).toBe('a\nb & c');
  });
});

describe('parseChangelog', () => {
  it('extracts entries newest first', () => {
    const entries = parseChangelog(html);
    expect(entries.map((e) => e.timestamp)).toEqual([1790596800, 1788264000]);
    expect(entries[0].text).toBe('【福佑调整】\n电锤思维：金币 3000→3500\n新增福佑「救援」 & 修复若干问题');
  });
  it('returns [] for unrelated html', () => {
    expect(parseChangelog('<html></html>')).toEqual([]);
  });
});

describe('formatBeijingDate', () => {
  it('formats in UTC+8', () => {
    expect(formatBeijingDate(1790596800)).toBe('2026-09-28');
  });
});

describe('buildIssue', () => {
  it('quotes the entry matching time_updated', () => {
    const issue = buildIssue(1790596800, parseChangelog(html), URL_);
    expect(issue.key).toBe('v1790596800');
    expect(issue.title).toBe('[游戏更新] 2026-09-28 v1790596800');
    expect(issue.body).toContain('> 电锤思维：金币 3000→3500');
    expect(issue.body).toContain(URL_);
    expect(issue.body).toContain('- [ ] 更新 `src/data/versions.yaml`');
  });
  it('falls back when changelog could not be parsed', () => {
    const issue = buildIssue(1790596800, [], URL_);
    expect(issue.body).toContain('未能解析更新日志');
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npm test -- tests/workshop.test.ts`
Expected: FAIL，报错 `Failed to resolve import "../src/lib/workshop"`

- [ ] **Step 4: 实现 `src/lib/workshop.ts`**

```ts
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
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npm test`
Expected: PASS（全部）

- [ ] **Step 6: 写 `scripts/check-workshop-update.ts` 和 workflow**

`scripts/check-workshop-update.ts`：

```ts
import { writeFileSync } from 'node:fs';
import { WORKSHOP_ID } from '../src/lib/site';
import { buildIssue, parseChangelog } from '../src/lib/workshop';

const DETAILS_API = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/';
const CHANGELOG_URL = `https://steamcommunity.com/sharedfiles/filedetails/changelog/${WORKSHOP_ID}?l=schinese`;

async function fetchTimeUpdated(): Promise<number> {
  const body = new URLSearchParams({ itemcount: '1', 'publishedfileids[0]': WORKSHOP_ID });
  const res = await fetch(DETAILS_API, { method: 'POST', body });
  if (!res.ok) throw new Error(`GetPublishedFileDetails HTTP ${res.status}`);
  const json = (await res.json()) as { response?: { publishedfiledetails?: { time_updated?: number }[] } };
  const t = json.response?.publishedfiledetails?.[0]?.time_updated;
  if (!t) throw new Error('GetPublishedFileDetails: missing time_updated');
  return t;
}

async function fetchChangelogHtml(): Promise<string> {
  try {
    const res = await fetch(CHANGELOG_URL, { headers: { 'Accept-Language': 'zh-CN' } });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
}

const timeUpdated = await fetchTimeUpdated();
const issue = buildIssue(timeUpdated, parseChangelog(await fetchChangelogHtml()), CHANGELOG_URL);
writeFileSync('issue-key.txt', issue.key);
writeFileSync('issue-title.txt', issue.title);
writeFileSync('issue-body.md', issue.body);
console.log(issue.title);
```

`.github/workflows/watch-workshop.yml`：

```yaml
name: Watch workshop updates

on:
  schedule:
    - cron: '0 1 * * *' # 09:00 Beijing
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx tsx scripts/check-workshop-update.ts
      - name: Open issue if this version is new
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          KEY="$(cat issue-key.txt)"
          FOUND="$(gh issue list --state all --search "$KEY in:title" --json number --jq 'length')"
          if [ "$FOUND" = "0" ]; then
            gh label create game-update --color D9A441 --description "创意工坊有新版本" --force
            gh issue create --title "$(cat issue-title.txt)" --body-file issue-body.md --label game-update
          else
            echo "Issue for $KEY already exists"
          fi
```

- [ ] **Step 7: 推送并手动触发一次**

```bash
git add -A
git commit -m "feat: open an issue when the workshop item updates"
git push
gh workflow run watch-workshop.yml
gh run watch --exit-status
gh issue list --label game-update
```

Expected: 生成一个 `[游戏更新] YYYY-MM-DD vNNNN` 的 Issue（首次运行时这就是当前版本的基线）。打开这个 Issue：
- 如果正文里是「更新日志原文」并且内容正确 → 完成
- 如果是「未能解析」→ 说明真实页面的结构和夹具不一样。在 Actions 里加一步 `curl -sL "$CHANGELOG_URL" | head -c 20000` 看看实际 HTML，据此修改 `tests/fixtures/changelog.html` 和 `parseChangelog` 的正则，保证测试先失败再通过，然后提交

再手动触发一次，确认**不会**重复开 Issue（日志里输出 `already exists`）。

---

### Task 12: Dota 英雄 / 装备数据与图片

**Files:**
- Create: `src/lib/dota-feed.ts`, `tests/dota-feed.test.ts`, `scripts/fetch-dota-assets.ts`, `.github/workflows/fetch-dota-assets.yml`
- Overwrite: `src/data/heroes.yaml`, `src/data/items.yaml`; Create: `public/img/heroes/*.webp`, `public/img/items/*.webp`

- [ ] **Step 1: 写失败测试 `tests/dota-feed.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { heroImageUrl, itemImageUrl, mapHeroFeed, mapItemFeed } from '../src/lib/dota-feed';

const heroFeed = {
  result: {
    data: {
      heroes: [
        { id: 2, name: 'npc_dota_hero_axe', name_loc: '斧王', name_english_loc: 'Axe', primary_attr: 0 },
        { id: 1, name: 'npc_dota_hero_antimage', name_loc: '敌法师', name_english_loc: 'Anti-Mage', primary_attr: 1 },
        { id: 5, name: 'npc_dota_hero_crystal_maiden', name_loc: '水晶室女', name_english_loc: 'Crystal Maiden', primary_attr: 2 },
        { id: 3, name: 'npc_dota_hero_bane', name_loc: '祸乱之源', name_english_loc: 'Bane', primary_attr: 3 },
      ],
    },
  },
};

const itemFeed = {
  result: {
    data: {
      itemabilities: [
        { id: 1, name: 'item_blink', name_loc: '闪烁匕首', name_english_loc: 'Blink Dagger' },
        { id: 2, name: 'item_recipe_blink', name_loc: '卷轴', name_english_loc: 'Recipe' },
        { id: 3, name: 'item_unused', name_loc: '', name_english_loc: '' },
      ],
    },
  },
};

describe('mapHeroFeed', () => {
  it('strips prefix, maps attributes, sorts by id', () => {
    expect(mapHeroFeed(heroFeed)).toEqual([
      { id: 'antimage', name: '敌法师', name_en: 'Anti-Mage', attr: 'agi' },
      { id: 'axe', name: '斧王', name_en: 'Axe', attr: 'str' },
      { id: 'bane', name: '祸乱之源', name_en: 'Bane', attr: 'all' },
      { id: 'crystal_maiden', name: '水晶室女', name_en: 'Crystal Maiden', attr: 'int' },
    ]);
  });
  it('throws on unknown attribute', () => {
    const bad = structuredClone(heroFeed);
    bad.result.data.heroes[0].primary_attr = 9;
    expect(() => mapHeroFeed(bad)).toThrow(/primary_attr 9/);
  });
});

describe('mapItemFeed', () => {
  it('drops recipes and unnamed items', () => {
    expect(mapItemFeed(itemFeed)).toEqual([{ id: 'blink', name: '闪烁匕首', name_en: 'Blink Dagger' }]);
  });
});

describe('image urls', () => {
  it('points at the dota_react CDN paths', () => {
    expect(heroImageUrl('axe')).toBe('https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/axe.png');
    expect(itemImageUrl('blink')).toBe('https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blink.png');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/dota-feed.test.ts`
Expected: FAIL，报错 `Failed to resolve import "../src/lib/dota-feed"`

- [ ] **Step 3: 实现 `src/lib/dota-feed.ts`**

```ts
import { ATTRS, type Hero, type Item } from './schema';

interface HeroFeed {
  result: { data: { heroes: { name: string; name_loc: string; name_english_loc: string; primary_attr: number }[] } };
}
interface ItemFeed {
  result: { data: { itemabilities: { name: string; name_loc: string; name_english_loc: string }[] } };
}

const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react';
const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);

export function mapHeroFeed(feed: HeroFeed): Hero[] {
  return feed.result.data.heroes
    .map((h) => {
      const attr = ATTRS[h.primary_attr];
      if (!attr) throw new Error(`unknown primary_attr ${h.primary_attr} for ${h.name}`);
      return { id: h.name.replace(/^npc_dota_hero_/, ''), name: h.name_loc, name_en: h.name_english_loc, attr };
    })
    .sort(byId);
}

export function mapItemFeed(feed: ItemFeed): Item[] {
  return feed.result.data.itemabilities
    .filter((i) => i.name.startsWith('item_') && !i.name.startsWith('item_recipe_') && i.name_loc.trim() !== '')
    .map((i) => ({ id: i.name.replace(/^item_/, ''), name: i.name_loc, name_en: i.name_english_loc || i.name_loc }))
    .sort(byId);
}

export const heroImageUrl = (id: string) => `${CDN}/heroes/${id}.png`;
export const itemImageUrl = (id: string) => `${CDN}/items/${id}.png`;
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 写 `scripts/fetch-dota-assets.ts`**

```ts
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { heroImageUrl, itemImageUrl, mapHeroFeed, mapItemFeed } from '../src/lib/dota-feed';

const FEED = 'https://www.dota2.com/datafeed';
const HEADER = '# Generated by scripts/fetch-dota-assets.ts — do not edit by hand\n';

async function getJson(path: string) {
  const res = await fetch(`${FEED}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function downloadWebp(src: string, dest: string, width: number): Promise<boolean> {
  if (existsSync(dest)) return false;
  const res = await fetch(src);
  if (!res.ok) {
    console.warn(`skip ${src}: HTTP ${res.status}`);
    return false;
  }
  const tmp = `${dest}.png`;
  writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  execFileSync('cwebp', ['-quiet', '-q', '80', '-resize', String(width), '0', tmp, '-o', dest]);
  rmSync(tmp);
  return true;
}

const heroes = mapHeroFeed(await getJson('herolist?language=schinese'));
const items = mapItemFeed(await getJson('itemlist?language=schinese'));
writeFileSync('src/data/heroes.yaml', HEADER + stringify(heroes));
writeFileSync('src/data/items.yaml', HEADER + stringify(items));

mkdirSync('public/img/heroes', { recursive: true });
mkdirSync('public/img/items', { recursive: true });
let fetched = 0;
for (const h of heroes) if (await downloadWebp(heroImageUrl(h.id), `public/img/heroes/${h.id}.webp`, 256)) fetched++;
for (const i of items) if (await downloadWebp(itemImageUrl(i.id), `public/img/items/${i.id}.webp`, 88)) fetched++;
console.log(`${heroes.length} heroes, ${items.length} items, ${fetched} new images`);
```

- [ ] **Step 6: 写 `.github/workflows/fetch-dota-assets.yml`**（本机代理不可用时就用它）

```yaml
name: Fetch Dota assets

on:
  workflow_dispatch:

permissions:
  contents: write
  actions: write

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: sudo apt-get update && sudo apt-get install -y webp
      - run: npm ci
      - run: npx tsx scripts/fetch-dota-assets.ts
      - run: npm run validate
      - name: Commit and redeploy
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add src/data public/img
          if git diff --cached --quiet; then echo "No changes"; exit 0; fi
          git commit -m "data: refresh Dota heroes and items"
          git push
          # Pushes made with GITHUB_TOKEN don't trigger other workflows; dispatch explicitly.
          gh workflow run deploy.yml
```

- [ ] **Step 7: 先确认数据源的结构**（本地或 Actions 都行）

Run: `curl -s "https://www.dota2.com/datafeed/herolist?language=schinese" | head -c 600`
Expected: JSON 里有 `result.data.heroes[]`，每一项带 `name`（形如 `npc_dota_hero_xxx`）、`name_loc`、`name_english_loc`、`primary_attr`。如果结构不一样，先改 `tests/dota-feed.test.ts` 里的夹具，让测试失败，再改 `dota-feed.ts` 让它通过。本地访问不了的话，这一步跳过，直接进入 Step 8，然后看 Actions 的日志。

- [ ] **Step 8: 运行**

有两种方式，任选一种：
- 本地（代理可用时）：`npx tsx scripts/fetch-dota-assets.ts && npm run validate`，然后提交 `src/data public/img`
- Actions：先提交并推送脚本，再执行 `gh workflow run fetch-dota-assets.yml && gh run watch --exit-status`，最后 `git pull`

Expected: `heroes.yaml` 里有 120 多个英雄，`public/img/heroes/` 下有同样数量的 webp（每张大约 10KB），validate 能通过。

- [ ] **Step 9: Commit（本地方式时）**

```bash
git add -A
git commit -m "feat: fetch Dota heroes, items and images from official datafeed"
git push
```

---

## 阶段 5：内容

> 内容任务不是写代码，但每一个都以 `npm run validate` 通过、`npm run dev` 能正常查看作为验收标准。录入规则：
> - `id` 用小写英文或拼音加短横线，定下来之后**不要再改**（URL 和引用都依赖它）
> - `name` 和游戏内的名字一字不差
> - `numbers` 的键用中文，比如 `金币: 3500`
> - `sources` 填具体来源的 URL
> - 没把握的条目在 `tags` 里加上 `待核实`
> - 攻略观点用自己的话写，**不整段复制**原文

### Task 13: 福佑数据（创意工坊原文）

**Files:** Modify: `src/data/blessings.yaml`

- [ ] **Step 1: 获取创意工坊描述原文**

按顺序尝试：本地 `curl -sL "https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696&l=schinese" -o tmp/workshop.html`（代理可用时）→ WebFetch → built-in browser pane 的 `get_page_text`。把描述部分保存成 `tmp/workshop.txt`（`tmp/` 已经在 gitignore 里）。

- [ ] **Step 2: 按原文重写 `blessings.yaml`**

删掉文件开头的「样例数据」注释。三条样例逐一对照原文：名称或效果不对的就改，原文里找不到的就删。原文里提到的其他福佑全部录入。分类按效果判断，归到 `CATEGORIES` 里的某一类。

- [ ] **Step 3: 校验与目测**

Run: `npm run validate && npm run dev`
在首页随便挑 5 个福佑，分别用中文、首字母、效果关键词各搜一次，确认都能搜到。

- [ ] **Step 4: Commit**

```bash
git add src/data/blessings.yaml
git commit -m "data: add blessings from workshop description"
git push
```

### Task 14: 版本记录

**Files:** Modify: `src/data/versions.yaml`, `src/data/blessings.yaml`

- [ ] **Step 1: 获取更新日志页** `https://steamcommunity.com/sharedfiles/filedetails/changelog/2841152696?l=schinese`（获取方式同 Task 13 Step 1）。把最近 20 条（或者全部）整理进 `versions.yaml`，按时间倒序：

`id` **必须加引号**，因为 `file()` loader 要求 id 是字符串，不加引号会被解析成日期：

```yaml
- id: '2026-09-28'
  title: 福佑调整
  source_url: https://steamcommunity.com/sharedfiles/filedetails/changelog/2841152696
  changes:
    - { blessing: electric-hammer, text: 金币 3000→3500 }
    - { text: 修复若干问题 }
```

- [ ] **Step 2: 回填福佑的 `history` 和 `since_version`**：更新日志里提到新增或改动的福佑，在它的 `history` 里加一条 `{ version, change }`，新增的福佑补上 `since_version`。

- [ ] **Step 3: 校验**：执行 `npm run validate`，然后在 `/versions/` 页面点击福佑链接，确认能跳到详情页，并且详情页上能看到这条历史。

- [ ] **Step 4: Commit**：`git commit -am "data: add version history" && git push`

### Task 15: 社区来源补充

**Files:** Create: `docs/sources.md`; Modify: `src/data/blessings.yaml`

- [ ] **Step 1: 调研候选来源**：用 WebSearch 或 built-in browser 搜索「福佑大乱斗 吧」「福佑大乱斗 攻略 专栏」「福佑大乱斗 NGA」。挑出 1～3 个**文字**来源，标准是内容多、比较新、有具体数值。记录到 `docs/sources.md`：

```markdown
# 内容来源

| 来源 | 链接 | 用途 | 最后查看 |
|---|---|---|---|
| Steam 创意工坊描述 | https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696 | 福佑列表骨架 | 2026-09-29 |
```

- [ ] **Step 2: 把选定的来源列表发给用户看一眼**（用户已经同意由我来选，这一步只是告知，不需要等回复）

- [ ] **Step 3: 补录**：创意工坊没写的福佑，从社区来源补进来，`sources` 填对应帖子的 URL，`tags` 加上 `社区整理`。已有福佑的效果如果有冲突，以更新日期较新的为准，并且加上 `待核实`。

- [ ] **Step 4: 校验并提交**：执行 `npm run validate`，然后 `git add -A && git commit -m "data: supplement blessings from community sources" && git push`

### Task 16: 英雄搭配与攻略文章

**Files:** Create: `src/content/builds/<hero-id>.md`（数量视资料而定）；Modify/Create: `src/content/guides/*.md`

- [ ] **Step 1: 英雄搭配**：从 `docs/sources.md` 里的来源中，每找到一个有明确搭配思路的英雄，就按下面的模板建一个文件（文件名必须和 `hero` 一致，`id` 以 `heroes.yaml` 为准）：

```markdown
---
hero: axe
summary: 一句话定位，比如「跳吼开团，前期拿经济类福佑」
blessings:
  - { id: electric-hammer, note: 为什么选它 }
items: [blink, black_king_bar]
updated: 2026-09-29
sources:
  - https://example.com/某篇帖子
---

用自己的话写 2～5 段思路：对线、福佑优先级、出装节奏、团战定位。
```

- [ ] **Step 2: 攻略文章**：至少写这 3 篇（frontmatter 格式和 `getting-started.md` 一样）：
  - `getting-started.md`：扩写成完整的新手入门（去掉末尾的「Task 16」提示）
  - `picking-blessings.md`（order: 2）：福佑三选一的思路，按阶段和定位来讲
  - `mechanics.md`（order: 3）：和原版 Dota 的机制差异（中路、经济、复活、随机事件）

- [ ] **Step 3: 校验**：执行 `npm run validate && npm run build`，在英雄列表页确认有搭配的英雄变成了不透明，详情页的「思路」部分能正常渲染。

- [ ] **Step 4: Commit**：`git add -A && git commit -m "content: add hero builds and guides" && git push`

---

## 阶段 6：福佑图标

### Task 17: 从 VPK 解包图标

**前置条件：** 用户已经把 Windows 上的 `steamapps\workshop\content\570\2841152696\` 打包，放到本机 `~/Downloads/` 或其他指定位置。

**Files:** Create: `public/img/blessings/*.webp`; Modify: `src/data/blessings.yaml`（给有图标的条目加上 `icon` 字段）

- [ ] **Step 1: 解压到 `tmp/workshop-vpk/`，看看目录结构**

```bash
mkdir -p tmp/workshop-vpk && unzip -q ~/Downloads/<用户给的文件名>.zip -d tmp/workshop-vpk && find tmp/workshop-vpk -maxdepth 3 | head -50
```

- [ ] **Step 2: 获取 ValveResourceFormat CLI**（**先征得用户同意**：告诉用户文件是 `Source2Viewer-CLI` 的 macOS arm64 版本，来源是 GitHub `ValveResourceFormat/ValveResourceFormat` 的 Releases 页面，以及文件大小）。下载后解压到 `tmp/vrf/`，然后运行 `tmp/vrf/Source2Viewer-CLI --help`，确认下面要用到的参数名。

- [ ] **Step 3: 列出图片资源，导出本地化文件**

```bash
tmp/vrf/Source2Viewer-CLI -i tmp/workshop-vpk/<...>/pak01_dir.vpk --vpk_list | grep -iE '\.(vtex_c|png)$' | grep -iE 'panorama/images|icons' > tmp/vpk-images.txt
wc -l tmp/vpk-images.txt
tmp/vrf/Source2Viewer-CLI -i tmp/workshop-vpk/<...>/pak01_dir.vpk --vpk_filepath resource/localization -o tmp/vpk-out
```

（参数以 Step 2 里 `--help` 的输出为准。）本地化文件 `addon_schinese.txt` **只用来把图标文件名对应到中文福佑名**，不作为福佑数据来源（数据来源仍然按照约定走社区路线）。

- [ ] **Step 4: 导出图标并转换格式**

```bash
tmp/vrf/Source2Viewer-CLI -i tmp/workshop-vpk/<...>/pak01_dir.vpk --vpk_filepath <Step 3 找到的图标目录> -o tmp/vpk-out -d
mkdir -p public/img/blessings
for f in tmp/vpk-out/<图标目录>/*.png; do cwebp -quiet -q 85 -resize 96 0 "$f" -o "public/img/blessings/$(basename "${f%.png}").webp"; done
```

- [ ] **Step 5: 建立映射**：在 `addon_schinese.txt` 里用 grep 搜每个福佑的中文名，找到它的内部 key，再根据 key 找到对应的图标文件，然后在 `blessings.yaml` 里给这个福佑填上 `icon: <文件名>.webp`。对应不上的先留空。没有被任何福佑引用的 webp 要删掉。

- [ ] **Step 6: 校验**：执行 `npm run dev`，在首页确认图标都能显示，而且没有 404（可以在 browser pane 里用 `read_network_requests` 查看）。

- [ ] **Step 7: Commit**：`git add -A && git commit -m "assets: add blessing icons extracted from workshop VPK" && git push`

### Task 18: 视频截图补缺

**Files:** Create: `public/img/blessings/*.webp`; Modify: `src/data/blessings.yaml`

- [ ] **Step 1: 列出缺图标的福佑**

```bash
npx tsx -e "import {loadDataSet} from './src/lib/load'; console.log(loadDataSet('.').blessings.filter(b=>!b.icon).map(b=>b.name).join('\n'))"
```

- [ ] **Step 2: 找合适的视频**：比如 [全技能图鉴](https://www.bilibili.com/video/BV1feAHzJEGH/)，要找能清楚看到福佑图标的画面。**每下载一个视频之前，都要先告诉用户视频标题、链接和预计大小，征得同意后再下载**：

```bash
yt-dlp -f 'bv*[height<=1080]' -o 'tmp/video/%(id)s.%(ext)s' '<视频链接>'
```

- [ ] **Step 3: 截帧**：找到图标清楚的时间点，然后执行：

```bash
ffmpeg -ss <mm:ss> -i tmp/video/<id>.mp4 -frames:v 1 tmp/frame.png
magick tmp/frame.png -crop <w>x<h>+<x>+<y> +repage tmp/icon.png
cwebp -quiet -q 85 -resize 96 0 tmp/icon.png -o public/img/blessings/<blessing-id>.webp
```

用 Read 工具查看 `tmp/frame.png`，确定裁剪坐标。每处理完一个，就在 `blessings.yaml` 里给对应条目加上 `icon: <blessing-id>.webp`。

- [ ] **Step 4: 校验与提交**：确认首页显示正常后，执行 `git add -A && git commit -m "assets: add blessing icons captured from videos" && git push`。仍然缺图标的福佑保持色块占位，不需要额外处理。

---

## 阶段 7：收尾

### Task 19: README 与最终验收

**Files:** Create: `README.md`

- [ ] **Step 1: 写 `README.md`**

````markdown
# 福佑大乱斗 · 图鉴与攻略

Dota2 游廊《福佑大乱斗》的非官方福佑图鉴与攻略站。

- 主站：https://comet32.github.io/fuyou-brawl/
- 备用：https://fuyou-brawl.pages.dev/

## 改内容

| 想改什么 | 改哪个文件 |
|---|---|
| 福佑 | `src/data/blessings.yaml` |
| 版本记录 | `src/data/versions.yaml`（最新的放最前） |
| 英雄搭配 | `src/content/builds/<英雄id>.md`（英雄 id 见 `src/data/heroes.yaml`） |
| 攻略文章 | `src/content/guides/<slug>.md` |
| 福佑图标 | 放进 `public/img/blessings/`，并在福佑的 `icon` 字段填文件名 |

改完先跑：

```bash
npm run validate
```

通过后 `git push`，GitHub Pages 和 Cloudflare Pages 会自动重新部署。

`src/data/heroes.yaml` 和 `items.yaml` 是脚本生成的，不要手改；Dota 本体更新英雄后，在 Actions 里手动运行 **Fetch Dota assets**。

## 游戏更新提醒

**Watch workshop updates** 每天 09:00 检查创意工坊，有新版本会开一个带 `game-update` 标签的 Issue，按 Issue 里的清单处理即可。
注意：仓库 60 天没有提交时，GitHub 会暂停定时任务，需要到 Actions 页面重新启用。

## 本地开发

```bash
npm install
npm run dev      # http://localhost:4321
npm test
npm run build
```
````

- [ ] **Step 2: 最终验收**（对照 spec 逐项检查）

Run: `npm test && npm run validate && npm run check && npm run build`
Expected: 全部通过

然后在手机视口下打开线上主站，检查：
- 首页搜索框自动聚焦；用中文、首字母、效果关键词都能搜到
- 三选一对比能用，分享链接打开后能还原
- 所有英雄都能打开，有搭配的显示内容，没有的显示「待补充」
- 版本页和攻略页正常
- 深浅色切换正常
- 备用站能打开

- [ ] **Step 3: Commit 并推送**

```bash
git add README.md
git commit -m "docs: add README with content maintenance guide"
git push
```
