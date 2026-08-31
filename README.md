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

## 环境变量

当前版本**不需要**环境变量。避坑小纸条为本地 mock（`localStorage`）；若日后接 Supabase，可增加：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## 地图瓦片说明

默认使用 Carto Light 公开栅格瓦片（无需 API Key）。若内网无法访问 `basemaps.cartocdn.com`，需自备瓦片源并修改 `src/components/map/LeafletMap.tsx`。

## 任务清单

见 [TODO.md](./TODO.md)。
