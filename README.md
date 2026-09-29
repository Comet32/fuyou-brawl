# 福佑大乱斗 · 图鉴与攻略

Dota2 游廊自定义游戏《福佑大乱斗》（创意工坊 [2841152696](https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696)）的非官方福佑图鉴与攻略站。

- 主站（国内可访问）：https://comet32.github.io/fuyou-brawl/
- 海外镜像：https://fuyou-brawl.zhaoenxiao32.workers.dev/ （`workers.dev` 在国内被墙，只适合海外访问）

## 功能

| 页面 | 说明 |
|---|---|
| 福佑图鉴（首页） | 支持中文、全拼、首字母、英文名和效果关键词搜索，可按品质和标签筛选；默认不显示英雄福佑，可以用开关打开 |
| 三选一对比 | 三格并排比较，锁定状态会写进链接，可以直接分享 |
| 福佑详情 | 完整效果、数值表、玩家心得、图鉴备注、改动历史、相关英雄 |
| 英雄 | 127 个英雄，支持搜索；每个英雄页有专属福佑、相关通用福佑和社区推荐福佑 |
| 版本 / 攻略 | 版本变动记录，以及攻略文章 |
| `/label/` | 品质标注工具，供站长使用 |

## 数据从哪来

三层数据合并，优先级从高到低：

1. **`src/data/blessings.overrides.yaml`**：手动修改，可以直接编辑，也欢迎提 PR。
2. **`src/data/blessings.community.yaml`**：社区数据（品质、数值区间、心得、推荐英雄）。由 `npm run community -- <blessing-notes.json>` 生成，不要手改。来源清单见 [`docs/research/community-sources.md`](docs/research/community-sources.md)。
3. **`src/data/blessings.generated.yaml`**：游戏文件（名称、描述模板、图标）。由 `npm run import -- <vpk>` 生成，不要手改。

英雄、装备和英雄技能数据来自 Dota 官方 datafeed，在 GitHub Actions 里手动运行 **Fetch Dota assets** 即可刷新。

福佑的数值和品质写在游戏里加密的代码中，本项目**不解密**，只使用社区公开资料和手动补充。

## 常见维护操作

### 游戏更新了

**Watch workshop updates** 每天 09:00（北京时间）检查创意工坊。发现更新时会自动开一个带 `game-update` 标签的 Issue。处理步骤：

1. 在 Windows 上把 `steamapps\workshop\content\570\2841152696\` 打包成 zip，然后解压到 `tmp/vpk/`。
2. 导入新数据并生成版本条目：

   ```bash
   npm run import -- tmp/vpk/2841152696/2841152696.vpk --version 2026-10-01 --title "十月更新"
   ```

   脚本会打印新增、移除和变更的福佑，并在 `versions.yaml` 开头插入一个版本条目。
3. 运行 `npm run validate`，通过后 `git push`，站点会自动部署。

### 补数值、品质或心得

编辑 `src/data/blessings.overrides.yaml`，键是福佑 id：

```yaml
'10010':
  quality: ssr            # r 蓝 / sr 紫 / ssr 橙
  numbers: { gold: 3500 } # key 与描述里的 {占位符} 同名
  sources: [https://...]
```

批量标注品质：打开站点的 `/label/` 页面逐个标注，导出 JSON 后运行 `npm run labels -- labels.json`。

### 写英雄搭配或攻略

- 英雄搭配：`src/content/builds/<英雄id>.md`，英雄 id 见 `src/data/heroes.yaml`。
  带 `origin: community-guide` 的搭配由 `npm run builds`（素材在 `docs/research/data/`） 从社区一图流生成；手写的搭配不要加这个字段，生成脚本不会覆盖它们。
- 攻略文章：`src/content/guides/<slug>.md`。

## 开发

```bash
npm install
npm run dev        # http://localhost:4321
npm test           # vitest
npm run check      # astro check
npm run validate   # 数据交叉校验
npm run build
npm run check:cn   # 从国内运营商节点测试线上站点的访问
```

需要访问 Steam 或 B 站、但本机连不上时，可以在 Actions 里运行 **Snapshot source pages** 抓取页面，再用 `gh run download <id> -n pages` 下载。

> 注意：公开仓库 60 天没有提交时，GitHub 会暂停定时 workflow。暂停后需要到 Actions 页面手动重新启用 **Watch workshop updates**。

## 设计

- 产品定位见 [`PRODUCT.md`](PRODUCT.md)，视觉系统见 [`DESIGN.md`](DESIGN.md)。
- 中文展示字体的授权说明见 [`public/fonts/README.md`](public/fonts/README.md)。

非官方玩家站。福佑名称、描述和图标版权归原作者；社区数据引用时都注明了来源。
