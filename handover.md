# 会话交接文档

> 写给**完全没有上下文**的新会话。仓库路径：`D:/迅雷下载/2`（上影节排片 / 影院地图 Web 应用）。

---

## 1. 我们在做什么

这是一个**电影节排片工具**（React/Next.js + Tailwind），核心 Tab：

| Tab | 组件 | 用途 |
|-----|------|------|
| 选电影 | `CatalogView` | 浏览片单 |
| 挑场次 | `SessionsView` | 选场次 |
| 排片 | `ScheduleView` + `ScheduleCalendarView` | 个人排片日历 |
| 地图 | `MapView` + `VenueDrawer` | 影院地图与详情抽屉 |

本 Session 主要围绕：

1. **排片日历 UX**（冲突展示、导出海报、工具栏文案）
2. **全站中英双语标题区**（片单 / 挑场次 / 排片）
3. **地图页影院详情抽屉 `VenueDrawer`**（下拉收起看全图、顶部牵引条、底部磨砂浮标）
4. **小纸条 UGC 体系 `TipBoard`**（亮点 / 避坑 / 周边玩乐，替代静态 JSON 占位）
5. **地图页配色按钮点不动**（`ThemeSwitcher` 层级问题）

---

## 2. 已完成内容

### 排片 / 日历

- **场次重叠**：卡片上不再写「冲突」；`gapMin <= 0` 时只显示精简 `OverlapConflictBadge`（「重叠 N′ · 冲突」），放在两卡接缝处 `z-[5]`，避免被下层卡片盖住。
- **重叠卡片交互**：点击重叠卡可 `raise` 到前面（`focusedOverlapId`，`z-[3]` vs `z-[1]`）。
- **正间隔**：仍用完整 `TransitBadge`（交通方式 + 时间）。
- **工具栏**：「长图」→ **「排片表」**。
- **`PosterModal`**：
  - 日历导出改为与 `ScheduleCalendarView` 一致的**时间网格**（非按日期列表）。
  - 5 套导出主题：`posterThemes.ts`（经典纸色 / 灰蓝 / 极简白 / 暗色 / 樱花粉）。
  - 预览区支持**鼠标拖动**滚动；两种布局预览尺寸统一并收窄。
  - 修复 `Cannot access 'style' before initialization`：`useState(style/layout)` 必须在依赖它们的 `useEffect` 之前。
- **`ScheduleCalendarView`**：主日历支持全方向鼠标拖滚，滚动条隐藏。

### 双语标题（与 Tab 文案对齐）

- **`CatalogView`**：`选电影 · Side A` / **浏览**片单 / `Browse · Program`
- **`SessionsView`**：`挑场次 · Side B` / **挑选**场次 / `Pick · Session`
- **`ScheduleView`**：`排片 · Side B` / **我的**排片 / `My · Schedule`

### 地图页 `VenueDrawer`

- **内容区**：`useDragScroll` + `scrollbar-none`；**只有顶部牵引区**可拖动整块下滑；内容区 `touch-pan-y` 只滚内部。
- **顶部牵引区**：仅保留**一条横条**（无「下拉 · 查看全图」等文字；点击/拖动也不展开标题行）。
- **三档吸附**：`open` → `peek`（底部窄条）→ `hidden`（完全滑出屏幕，露出全图）。
- **过渡动画**：内容随下拉渐隐；大面板与底部**磨砂浮标** `cm-venue-dock` 交叉淡入（`globals.css` + `VenueDrawer.tsx`）。
- **hidden 后**：底部小胶囊（半磨砂、可上拖/点击展开）；`pointer-events` 在 hidden 且动画结束后才关抽屉。

### 小纸条 `TipBoard`

- **移除** `VenueDrawer` 内静态 `cinema.tips` / `cinema.supplies`（JSON 里仍有数据，**界面不再展示**）。
- 三类 UGC（`tipBoard.ts` 的 `TipKind`）：
  1. **亮点** `advantage`
  2. **避坑** `pitfall`
  3. **周边玩乐** `supply`（chip 显示「周边」）
- 顺序：**亮点 → 避坑 → 周边玩乐**；无内容显示 **「暂无」**（不隐藏区块）。
- 发小纸条时可切换标签；列表 **>3 条** 时限高可滚，`cm-scroll-auto`（鼠标靠近才显示滚动条）。
- 限高用 **ResizeObserver 量前 3 条真实高度**（勿再用过大的固定 `max-h-[7rem]`）。

### 其它修复

- **`ThemeSwitcher`**：compact 下拉改用 **`createPortal` → `document.body`** + `z-[800]`；`AppShell` 顶栏 `z-[700]`。解决地图页配色面板「点不动」。
- **`FilterSelect`**：去掉 CJK 裁剪（`leading-none`、`font-mono` 等）。
- **`TipBoard` 标题**：「避坑小纸条（本地 UGC mock）」→ **「小纸条」**。

---

## 3. 当前卡在哪

**无明确阻塞 Bug。** 最近一轮用户反馈「>3 条仍全部显示」已通过 ResizeObserver 精确限高修复，**需在新会话中目视确认**是否满足预期。

**未最终拍板的设计项（可选后续）**：

| 项 | 说明 |
|----|------|
| 优势类命名 | 现用 **「亮点」**；曾候选：场地优势 / 观影亮点 / 值得一来 等 |
| 第三类命名 | 现用 **「周边玩乐」**；曾候选：散场去处 / 周边探店 |
| `cinemas.json` 的 `tips`/`supplies` | 数据仍在文件中，已与 UI 脱钩；是否删字段或迁移到种子小纸条待定 |
| 打卡弹窗 `CheckInModal` 的「小纸条」 | 与 `TipBoard` localStorage **未打通**，仍是独立 optional note |

---

## 4. 下一步建议

1. **验收 `VenueDrawer`**：展开 → 只拖顶部横条 → peek → hidden → 浮标回弹；内容区长列表滚动手势不与整块拖动冲突。
2. **验收 `TipBoard`**：每类发 4+ 条，确认只显示约 3 条 + 内部滚动；hover 出滚动条。
3. **验收 `ThemeSwitcher`**：在地图 Tab 打开配色，5 个主题均可切换。
4. **验收排片海报导出**：日历/列表 × 5 主题；重叠场次 badge 在导出图上的位置。
5. 若产品确认：将 `CheckInModal` 可选 note 写入 `postTip()`；或清理 `cinemas.json` 无用 `tips`/`supplies`。

---

## 5. 关键文件索引

```
src/components/map/VenueDrawer.tsx    # 地图抽屉 + 浮标
src/components/map/TipBoard.tsx       # 小纸条 + 三类展示
src/utils/tipBoard.ts                 # localStorage UGC
src/components/shell/ThemeSwitcher.tsx
src/components/shell/AppShell.tsx
src/components/schedule/ScheduleCalendarView.tsx
src/components/schedule/PosterModal.tsx
src/components/schedule/posterThemes.ts
src/components/schedule/TransitBadge.tsx
src/components/sessions/SessionsView.tsx
src/components/schedule/ScheduleView.tsx
src/components/catalog/CatalogView.tsx
src/hooks/useDragScroll.ts
src/app/globals.css                   # cm-venue-dock, cm-scroll-auto, cm-frost
public/data/cinemas.json            # 静态影院（tips/supplies 已不在 UI 使用）
```

---

## 6. 踩坑清单 — 绝对不要再碰

### 层级 / 点击

- **地图内元素 `z-[400~500]`**，顶栏下拉若用 `absolute + z-50` 会被挡住 → 配色等浮层必须 **Portal 到 body** 或 z-index 高于地图层。
- **`VenueDrawer` hidden 时立即 `pointer-events: none`** 要在动画结束后再关，否则拖动/点击体验断裂；用 `dockReady` + `transitionend`。

### VenueDrawer 拖动

- **不要在内容区 `scrollTop===0` 时接管下拉**（用户已明确要求：只有顶部横条拖整块）。
- **`translateY` 收起高度** 不能用「展开态短 header」去算 peek — 会导致收不彻底、内容漏出；hidden 用 `sheetHeight + HIDDEN_BELOW_PX`。
- **`setPointerCapture` 未释放** 可能导致页面其它区域点不动；`endSheetDrag` 里要 `releasePointerCapture`。
- 内容区勿用 `touch-none`，否则手机无法滚内容 → 用 **`touch-pan-y`**。

### 小纸条列表限高

- 固定 **`max-h-[7rem]` 太大**，四条短文本会「看起来没滚动」→ 用 **量前 3 条高度** 或更小的 calc。
- `scrollable` 条件为 **`length > 3`**（超过三条，不是 `>=`）。

### React / 状态

- **`PosterModal`**：`style`/`layout` 的 `useState` 必须在引用它们的 `useEffect` **之前**声明。
- **`useDragScroll` 与 sheet 拖动**：content 上 `stopPropagation: false` 且 sheet 有 capture 时会打架 — 现已改为仅 handle 拖 sheet。

### UI 文案 / 中文

- **`FilterSelect` / 按钮**：避免 `leading-none` + 固定矮高 + `truncate` + `font-mono` 裁 CJK 字形。
- 牵引区用户要求 **不要** 在点击/拖动时出现「下拉查看地图」等展开文案。

### Git

- 用户规则：**不要主动 commit**；只有用户明确要求才提交。

---

## 7. 技术约定速查

- **滚动条隐藏 + hover 显示**：`cm-scroll-auto`，滚动中加 `is-scrolling`。
- **完全隐藏滚动条 + 鼠标拖滚**：`scrollbar-none` + `useDragScroll('y', { target: 'self' })`。
- **主题**：`useThemeStore` + `data-theme` on `<html>`；5 主题 id：`cream | slate | white | black | pink`。
- **小纸条存储**：`localStorage` key `cinemap-tipboard-v1`；旧数据无 `kind` 时默认 `pitfall`。

---

## 8. 相关会话

- 本 Session 完整 transcript（含 tool 调用细节）：  
  `C:\Users\jjj\.cursor\projects\d-2/agent-transcripts/683476fc-dffc-49b6-87d5-8d1cea56aa8c/683476fc-dffc-49b6-87d5-8d1cea56aa8c.jsonl`

---

*文档生成：会话结束交接，2026-08-31*
