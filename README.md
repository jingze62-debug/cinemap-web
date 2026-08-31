# CineMap（影展排片与影院地图）

Local-first、免登录的影展排片与影院地图 Web 应用。全静态构建，零运行时外部地图 API Key。

## 技术栈

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Zustand（`persist` → localStorage）
- Leaflet / React-Leaflet（客户端按需加载）
- Lucide React、html-to-image

## 本地开发

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 静态构建与预览

```bash
npm run build
npx serve out
```

产物在 `out/`，可部署到任意静态托管（GitHub Pages、Cloudflare Pages、对象存储等）。

## 替换数据

将样例 JSON 换成真实影展数据（保持字段结构即可）：

| 文件 | 内容 |
|------|------|
| `public/data/siff_2026_films.json` | 影片、策展单元、场次 |
| `public/data/cinemas.json` | 影院元数据与经纬度 |
| `public/data/cinema_transit_matrix.json` | 影院两两通勤分钟 |

类型定义见 `src/types/`。

## 功能入口

1. **选电影** — 策展筛选、搜索、加入日程  
2. **排片** — 多方案、通勤余量、导入口令、收据长图、导出 `.ics`  
3. **影院地图** — 可缩放地图、场馆抽屉、打卡、本地避坑小纸条  
4. **/match** — 双人碰场口令差分  
5. **/analytics** — 埋点与行为漏斗（本机 + 全站远端）

## 埋点与远程统计

- 客户端事件：`选影展 → 选片 → 加场次/排片 → 地图点亮`
- 本机：`localStorage`；远端：Cloudflare Pages Function + D1（`/api/track`、`/api/stats`）
- 全站漏斗查看需 Pages 密钥 `ANALYTICS_READ_TOKEN`（在 `/analytics`「全站远端」输入）

部署（含 Functions）：

```bash
npm run build
npx wrangler pages deploy out --project-name=cinemap-web
```

## 环境变量

前端可选（一般同域即可，不必配置）：

```bash
NEXT_PUBLIC_ANALYTICS_ENDPOINT=/api/track
NEXT_PUBLIC_ANALYTICS_STATS_ENDPOINT=/api/stats
```

Pages 密钥（服务端）：

```bash
# 读取全站漏斗口令
npx wrangler pages secret put ANALYTICS_READ_TOKEN --project-name=cinemap-web
```

D1 绑定见 `wrangler.toml`（`DB` → `cinemap-analytics`）。

## 地图瓦片说明

默认使用 Carto Light 公开栅格瓦片（无需 API Key）。若内网无法访问 `basemaps.cartocdn.com`，需自备瓦片源并修改 `src/components/map/LeafletMap.tsx`。

## 任务清单

见 [TODO.md](./TODO.md)。
