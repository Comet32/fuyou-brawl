# Fonts

| File | Font | License | Source |
| --- | --- | --- | --- |
| `fuyou-display-900.woff2` | Noto Sans SC, Black (wght axis pinned to 900), subset to the glyphs in `fuyou-display-900.glyphs.txt` | SIL Open Font License 1.1 (`OFL.txt`) | [google/fonts `ofl/notosanssc`](https://github.com/google/fonts/tree/main/ofl/notosanssc) (`NotoSansSC[wght].ttf`) |

The subset covers only fixed interface text (site mark, page titles, section straps, navigation, quality labels), listed in `src/lib/display-glyphs.ts`. Blessing and hero names use the system CJK font.

Regenerate after editing that list:

```sh
npm run fonts   # tools/subset-display-font.ts, uses the subset-font devDependency
```

Barlow Condensed (numerals and Latin) is bundled from the `@fontsource/barlow-condensed` package (SIL OFL 1.1).
