# 附录：福佑数据改为 VPK 导入

> 替换原计划的 Task 13（录入福佑）、Task 14（版本记录）、Task 17 / 18（图标）。Task 15、16（社区攻略、英雄搭配）不变。
> 决策来源：2026-09-29 与用户确认（见 spec「变更记录」）。

## 已知事实（来自 `2841152696.vpk`，2026-09-21 版）

- `resource/bless_name.csv` / `bless_desc.csv` / `bless_desc_short.csv`：UTF-8 带 BOM，列为 `Tokens,Schinese,English,Russian`，字段可能带引号。
  - 共 682 个福佑，id 形如 `10010`、`100043`、`10004a`（SP 变体）。
  - 有 7 个中文名为空，属于占位条目，需要跳过；另有少量重名，属于正常情况。
- 描述是模板：
  - 数值用 `{key}` 占位；
  - 高亮用 `<font color='#83d18a'>`，灰色注释用 `#8e8e8e`，另有少量 `#ffea47` / `#FF6B6B` / `#ff910a`；
  - 换行用 `<br>`。
- 图标：`resource/flash3/images/spellicons/buff/bless/<id>.png`，尺寸 128×128。变体没有自己的图标时，用去掉字母后缀的基础 id 的图标。
- 福佑的**数值**和**品质**都写在加密的 Lua 里，**不解密**：
  - 数值：通过 overrides 人工补充；
  - 品质：蓝 `r` / 紫 `sr` / 橙 `ssr`，每个福佑固定，由用户在标注页完成标注。
- VPK 是单文件格式（v2，所有条目的 archive index 都是 `0x7fff`），文件数据紧跟在目录树之后。

## 数据结构

```
src/data/blessings.generated.yaml   # import script output, never hand-edited
src/data/blessings.overrides.yaml   # manual: map id -> { quality, numbers, tags, sources, history, since_version, exclusive_hero }
```

合并后的 `Blessing`：
- `id` `name` `name_en`
- `quality`：`'r' | 'sr' | 'ssr' | null`
- `summary`：短描述模板
- `effect`：完整描述模板
- `tags`：自动标签和手工标签的并集
- `numbers`：占位符名 → 值
- `icon` `exclusive_hero` `since_version` `sources` `history`

`category` 字段删除。

## 任务

### R1：纯函数库
- `src/lib/csv.ts`：`parseCsv(text)`，返回 `string[][]`。需要处理 BOM、引号、`""` 转义、CRLF，以及引号内的换行。
- `src/lib/template.ts`：
  - `parseTemplate(tpl, numbers)` 返回 `Segment[]`，其中 `text` 段的 tone 取 `normal | highlight | muted | accent`，`value` 段带 `key`，有值时带 `value`；
  - `toPlainText(tpl, numbers)` 把未知值替换成 `?`，并去掉所有标签。
  - 除了 `font` 和 `br`，其他标签一律丢弃，**绝不输出原始 HTML**。
- `src/lib/tags.ts`：
  - `TAGS`：攻击、法术、生存、经济、移动、召唤、装备；
  - `TAG_RULES` 是关键词表；
  - `autoTags(plainText)`；
  - `TAG_COLORS`。
- `src/lib/quality.ts`：`QUALITIES`，每项包含 id、label、color（橙 `#ff910a`、紫 `#b518ff`、蓝 `#3d8bff`），按橙、紫、蓝的顺序排列。

### R2：Schema 与数据切换
- 修改 `schema.ts`：
  - `generatedBlessingSchema`、`blessingOverrideSchema`、`blessingSchema`（合并后）；
  - 删除 `category` 和 `CATEGORIES`。
- `src/lib/blessings.ts`：`mergeBlessings(generated, overrides)`。overrides 中出现未知 id 时抛错，错误信息要带上 id；合并时对 tags 去重。
- 修改 `content.config.ts`：`blessings` 改用 inline loader，读两个 YAML 后合并；`load.ts` 共用同一套逻辑。
- 修改 `integrity.ts`：删除「福佑名称重复」这条检查。
- 修改 fixtures 和各测试以适配新结构。
- 修改 UI，先保证能编译：
  - 卡片渲染 `summary` 模板，左边框用品质色；
  - 首页的 chips 改成品质加标签；
  - 搜索加入 `name_en`、`quality`、`tags`、纯文本 `summary`；
  - `applyCategory` 改为 `applyFilters(records, { quality, tag })`。
- 种子数据：用 3 个真实 id（`10010`、`10145`、`10091`）的 generated 数据，再加上 overrides。已知的有：
  - 10010：品质 `ssr`，`gold: 3500`；
  - 10145：`count: 3`、`pct: 8`、`self_pct: 3`；
  - 10091：`time: 3`；
  - 以上都带创意工坊 URL 作为来源。

### R3：VPK 导入
- `src/lib/vpk.ts`：`readVpkEntries(buf)` 返回 `Map<path, {offset,length,preload}>`，另有 `readVpkFile(buf, entry)`。测试里自己构造一个最小的 v2 VPK buffer。
- `src/lib/bless-import.ts`：
  - `buildGenerated({ names, desc, short, iconIds })`：跳过空名条目；图标有回退规则；自动生成标签；
  - `diffGenerated(old, next)` 返回 `{ added, removed, changed: {id, fields[]}[] }`。
- `scripts/import-vpk.ts <file.vpk> [--version YYYY-MM-DD --title 标题]`：
  1. 写入 `blessings.generated.yaml`；
  2. 把图标转成 96px 的 webp 写到 `public/img/blessings/<id>.webp`，并删除已经没有对应福佑的旧图；
  3. 打印 diff；
  4. 带 `--version` 且 diff 非空时，在 `versions.yaml` 头部插入一个版本条目：新增和变更的条目带 `blessing: <id>`，移除的条目用 `blessing: null`，text 写「移除：<名称>」。
- 在真实 VPK 上运行一次，生成基线数据，这一次不加 `--version`。

### R4：页面
- 福佑详情页：
  - 显示品质标签、完整 `effect` 模板、标签；
  - 「数值」表列出每个占位符，已知的显示值，未知的显示「待补充」；
  - 底部加一句说明「数值写在 `blessings.overrides.yaml`」，并附上 GitHub 编辑链接。
- 首页：
  - 一行品质筛选：全部 / 橙 / 紫 / 蓝 / 未标注；
  - 一行标签 chips；
  - 两者可以组合筛选，状态写进 URL：`?q=&quality=&tag=`。
- 对比页：适配新的卡片。
- 标注页 `src/pages/label.astro`：
  - 设置 `noindex`，不放进导航；
  - 一次显示一个福佑：图标、名称、简短描述；
  - 大按钮：橙、紫、蓝、不确定，另有「上一个」；
  - 默认只显示未标注的，显示进度；
  - 结果存进 localStorage，键为 `fuyou-label-v1`，所有读写都包 try/catch；
  - 「导出」按钮生成 JSON `{ "10010": "ssr", ... }`，同时放进 textarea 并复制到剪贴板；
  - 纯逻辑放在 `src/lib/labeling.ts`，写测试。
- `scripts/apply-labels.ts <labels.json>`：把导出结果合并进 `blessings.overrides.yaml`，只写 `quality`，不覆盖其他字段，最后打印统计。

### R5：文档
- 更新 README（如果还没有就新建）：说明游戏更新时的流程——用户发 zip → 解压 → `npx tsx scripts/import-vpk.ts <vpk> --version <date> --title <title>` → 检查 diff → 提交。
- 更新 spec 里的福佑字段列表。
