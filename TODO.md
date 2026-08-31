# CineMap 开发任务清单

> 勾选规则：仅在阶段验收通过（回复「确认」「ok」「继续」）后勾选。

## P0 工程骨架

- [x] 初始化 Next.js 14+ App Router + TS + Tailwind，安装 Lucide / Zustand / Leaflet 相关依赖
- [x] 配置路径别名与基础 Shadcn/ui 组件
- [x] 创建规范目录：`public/data|sketches|textures`，`src/{app,components,hooks,types,utils}`
- [x] 实现全局纸质主题与移动端布局壳
- [x] 实现主页三 Tab 导航壳（选电影 / 排片 / 影院地图）占位页

## P1 数据与领域层

- [x] 编写 `film` / `cinema` / `plan` / `checkIn` TypeScript 类型
- [x] 写入可演示的 `siff_2026_films.json`、`cinemas.json`、`cinema_transit_matrix.json`
- [x] 实现 `transitEngine`（冲突、通勤分钟、余量等级）
- [x] 实现 `useScheduleStore`（多方案、增删场次、persist）
- [x] 实现 `useCheckInStore`（打卡点亮、persist）
- [x] 封装静态 JSON 加载工具并在客户端验证可读取

## P2 选电影

- [x] 实现 `SectionChips` 策展单元筛选
- [x] 实现搜索（片名 / 导演 / 影院）
- [x] 实现 `FilmCard` 展开折叠与场次子列表
- [x] 接通「加入日程 / 已加入」与 store，含基础冲突提示
- [x] 对照 mockup 1 调整选片页视觉与间距

## P3 排片工作台

- [x] 实现 `PlanTabs`（切换 / 新建；克隆与重命名按最小可用）
- [x] 实现方案统计条（部数、总价、跨区、松紧）
- [x] 实现 `TimelineView` 时间序列场次卡
- [x] 实现 `TransitBadge` 通勤与余量指示
- [x] 实现从排片移除场次
- [x] 快捷操作入口（导入 / 碰场 / 长图 / 地图）接线或明确空态
- [x] 对照 mockup 2 调整排片页视觉

## P4 影院地图

- [x] 实现 `LeafletMap`（`ssr: false`、marker、FlyTo）
- [x] 实现影院列表与地图联动选中
- [x] 实现 `VenueDrawer`（统计、避坑、补给、复制地址）
- [x] 实现 `CheckInModal` 与打卡状态展示
- [x] 对照 mockup 3 调整地图深色主题

## P5 分享与增强

- [x] 实现 `matchCompressor` 口令编解码
- [x] 实现 `/match` 页与 `DiffReport` 差分视图
- [x] 实现 `PosterModal` 收据长图导出（html-to-image 2.5x）
- [x] 实现 `CommemorativeTicket` 纪念票渲染
- [x] 实现 `icsGenerator` 并提供下载入口
- [x] 接入或 mock Supabase 避坑小纸条读写

## P6 打磨与发布

- [x] 全链路联调与空态/错误态补齐
- [x] 移动端布局与安全区修复
- [x] 静态构建验证与 README
- [x] 按你指定目标完成部署配置
- [x] 终验对照三张 mockup 并收口缺陷
