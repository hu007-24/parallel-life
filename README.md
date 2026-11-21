# Parallel Life · 平行人生实验室

> 高校创造赛 · LifeHack 生活娱乐方向
>
> 程序化叙事 × 人生状态模拟 × 多分支时间线 × 平行宇宙对照。
> **100% 本地引擎**：不接入任何大模型 API、AI 服务或后端生成内容。所有剧情、模拟计算、图鉴与数据管理均由本地程序与人工设计数据完成。

---

## 快速开始

**只想玩，不碰代码**：双击项目根目录的 `启动平行人生.bat` —— 自动构建（首次）、起本地服务并
打开浏览器 `http://localhost:4173`；关闭黑色窗口即停止。也可手动 `node scripts/serve.mjs`。

> 为什么不能双击 index.html？根目录 index.html 引用 TypeScript 源码，需 Vite 编译；
> dist/index.html 虽是产物，但 `file://` 协议下 ES 模块被浏览器 CORS 拦截、绝对路径
> `/assets/…` 指向磁盘根目录。SPA 必须经 HTTP 服务运行（启动器已处理）。

环境要求：Node.js ≥ 18（推荐 20+），npm ≥ 9。

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器 http://localhost:5173
npm run build        # 类型检查 + 生产构建 + SPA 回退产物（dist/）
npm run preview      # 生产预览 http://localhost:4173
npm test             # Vitest 单元测试（86 项）
npm run test:e2e     # Playwright 端到端（7 项，含 14 步主流程与三端响应式）
npm run validate:content   # 剧情内容库校验 + 完整目录 + 运行时路径验证
npm run lint         # ESLint（0 警告门槛）
npm run typecheck    # TypeScript 严格模式
```

E2E 默认指向开发服务器；验证生产产物时：

```bash
npm run preview &    # 或后台运行
E2E_BASE_URL=http://localhost:4173 npm run test:e2e
```

> 本机若无法下载 Playwright bundled chromium（CDN 受限），配置已使用系统已安装的
> Edge（Chromium 内核）官方 channel `msedge`，无需额外下载。

---

## 功能说明

| 页面 | 路由 | 能力 |
| --- | --- | --- |
| 观测站首页 | `/` | 品牌主视觉（引擎实时计算的分支线图 + 年龄刻度）、核心 Slogan、开启人生实验、已探索宇宙计数、滚动视差与分区 reveal |
| 创建宇宙 | `/create` | 四种初始身份、五章起始阶段（此前年份由引擎按种子自动模拟）、手动/自动模拟模式、创建确认弹窗、点火转场后跳转 |
| 人生模拟 | `/simulation/:id` | 桌面三栏：五维属性（数值缓动 + 增量徽章 + 刻度条 + 年龄刻度尺）／当前剧情与背景、选项单选与确认、入场转场／事件记录、当前阶段、宇宙编号；自动推演模式在主线剧情年暂停交由用户抉择 |
| 人生时间线 | `/timeline/:id` | React Flow 全分支图：当前节点高亮脉冲、历史节点点击详情、父子边、分支灰阶区分 + 图例、MiniMap（桌面）、在此年创建分支路线、回溯派生新宇宙、自动 fitView |
| 平行宇宙 | `/multiverse` | 查看 / 继续模拟 / 查看结局 / 收藏（持久化）/ 删除（确认弹窗）；全部·运行中·已结束·收藏筛选；收藏优先排序 |
| 对照实验 | `/comparison` | 任意两条路线（同宇宙分支或跨宇宙）对照：结局与编号、ECharts 雷达叠加、仪器式双向 Δ 条、五维表、关键选择对照（分岔高亮）、事件三分区、按年龄对齐的时间线对照、左右交换 |
| 人生结局 | `/ending/:id` | 结局编号/名称/描述/达成条件、主线抉择与特殊事件关键经历、最终属性 + 雷达、隐藏成就、**Canvas 纪念卡预览与 3000×4200 高清 PNG 导出**、重新探索 |
| 宇宙图鉴 | `/collection` | 已探索宇宙、已解锁结局（编号）、隐藏成就、特殊事件遭遇计数、收藏记录、身份运行记录 |
| 系统设置 | `/settings` | 减弱动效、音效开关、完整 JSON 导出、导入（七项校验 + 同 ID 跳过不覆盖）、清空本地数据（确认）、恢复默认（确认） |

引擎与内容：

- **五维人生状态**：创造 / 探索 / 联结 / 影响 / 幸福（0–100），统一年度衰减防止全维饱和。
- **五章 25 个主线剧情节点**（s07/s17 分岔、s10/s20 汇合），选项写入 flags 影响后续节点条件、特殊事件与隐藏成就。
- **25 个随机事件**（15 普通 + 10 特殊）、14 条条件剧情（含 4 身份初始剧情）、**12 个隐藏成就**、**8 种结局**（多维加权 + 经历门槛 + 特殊事件组合）。
- **确定性**：同 seed + 同决策路径 ⇒ 完全相同的宇宙（`replay` 可验证）；分支共享不可变祖先，历史永不修改。
- **音效**：WebAudio 本地合成（选择/确认/成就/结局/分支），顶栏一键静音，设置可关。

---

## 技术架构

```
src/
├── app/            # 入口、路由（全路由懒加载，Home 除外）、统一布局、错误边界
├── components/
│   ├── ui/         # Button / Card / Modal / Badge / Progress(memo) / PageHeader / EmptyState
│   └── charts/     # RadarChart（echarts/core 按需）/ DeltaBarChart（纯 CSS 仪器式双向条）
├── pages/          # 9 页面 + 404；页面不含业务逻辑，只经 store 访问数据
├── engine/ple/     # 纯函数引擎（无 React、无 IO）
│   ├── types.ts / state-engine / random-engine / narrative-engine / event-engine
│   ├── story-engine / achievement-engine / timeline-engine / ending-engine
│   ├── comparison-engine / simulation-engine / content-validator
│   └── __tests__/  # 引擎单测
├── data/           # chapters / stories(25) / events(25) / narratives(14) / achievements(12)
│                   # endings(8) / archetypes(4) / choices 选择池
├── database/
│   ├── db.ts       # Dexie v4：universes / nodes / collections / settings + 历史升级迁移
│   ├── mapping.ts  # split/assemble 纯函数、collections 推导、默认设置
│   └── repositories.ts  # Repository 模式：单事务保存、节点增量插入、图鉴 recordMissing
├── stores/         # universeStore / settingsStore / collectionStore（Zustand）
├── hooks/          # useUniverse / useTweenedNumber
├── utils/          # transfer（导出/七项导入校验）/ memorial-card（版式+Canvas+PNG）/ sound / format / cn
└── styles/         # 设计 Token + 仪器语言（刻度/金属发丝线/注册角标/主题滚动条）
scripts/            # validate-content.ts（内容校验 CLI）/ post-build.mjs（404.html SPA 回退）
tests/e2e/          # smoke / life-flow(14 步) / responsive(三端)
```

数据流：`页面 → Zustand store → Repository → Dexie(IndexedDB)`。页面零直连数据库。
宇宙聚合 = `universes` 元数据行（含 routes）+ `nodes` 规范化行（主键 `universeId|nodeId`，
同种子派生宇宙不冲突）；节点不可变 ⇒ 保存只插入新行。`collections` 记录结局/成就/特殊事件/
收藏的解锁事实（保留最早解锁时间）。v3→v4 升级自动拆表并重建图鉴，旧数据不丢失。

视觉语言：黑 `#17191C` / 白 `#F5F5F3` / 墨 `#111111` / 银 `#BFC3C7` / 灰 `#777777` /
发丝线 `#DDDDDA`；等宽微标签 + 刻度尺 + 注册角标的精密仪器感；动画克制
（fade / smooth transition / number counter / node highlight / subtle hover / page transition），
全部尊重「减弱动效」设置。

---

## 操作指南

1. **创建**：首页「开启人生实验」→ 选身份 → 选起始阶段（非 0 岁时此前年份自动模拟，可回溯）→
   选模式 → 填名称/种子（留空随机）→「生成创建确认」→「确认并启动」。
2. **模拟**：点选行动（单选）→「确认选择」推进一年；观察左栏数值缓动与增量徽章、右栏事件记录。
   自动模式点「开始推演」，主线剧情年自动暂停等你抉择；「暂停」随时停止。
3. **回溯**：时间线点击任意历史节点 → 「在此年创建分支路线」（同宇宙新路线）或
   「回溯派生新宇宙」（同种子复现前缀后独立推进）；图例可切换路线。
4. **对照**：对照实验页选择两侧宇宙与路线 → 雷达/Δ 条/表格/时间线对照 → 交换按钮互换左右。
5. **结局与纪念卡**：模拟到 80 岁自动结算结局；结局页「导出高清 PNG」下载 3000×4200 纪念卡。
6. **管理**：平行宇宙页收藏/筛选/删除（确认）；图鉴页查看解锁进度；设置页导出/导入/清空/恢复默认。
   导入校验失败整包拒绝；同 ID 宇宙跳过而非覆盖。
7. **音效**：顶栏喇叭按钮一键静音/恢复；设置页亦可开关。

---

## 测试结果

- **Vitest 86/86**（7 文件）：引擎钳制/非法拒绝/分支不可变/种子复现/事件去重/结局稳定/终局保存（31）；
  内容校验与 4 身份 ×3 策略完整人生/剧情分岔/成就 once（20）；编排快进与派生隔离（6）；
  对照隔离/正确性/交换对称（7）；映射 roundtrip/对象独立/collections 推导（5）；
  导入七项校验与 roundtrip（13）；纪念卡版式不变量（6）。
- **Playwright 7/7**（Edge Chromium channel）：smoke ×3；**14 步主流程**（创建→身份→两次选择→
  属性变化→时间线→历史节点分支→双宇宙切换→对照+交换→完成 80 岁人生→导出 PNG 校验
  （签名 + IHDR 3000×4200）→刷新→设置/收藏/宇宙/图鉴/分支全保留，全程零控制台错误）；
  **三端响应式**（390×844 / 820×1180 / 1440×900：全页面无横向溢出、核心交互可用、移动端六项导航可达）。
- **生产预览实测**：`E2E_BASE_URL=http://localhost:4173` 下 7/7 通过；深链 `/simulation/x` 返回 200 应用外壳。
- **构建**：typecheck / ESLint 0 警告 / `vite build` 全绿；初始 index 173kB（gzip 61kB），
  路由级懒加载 chunk 3–14kB，echarts 431kB（gzip 145kB，仅对照/结局页加载），
  reactflow 186kB（gzip 61kB，仅时间线加载），vendor 334kB（gzip 109kB）。
- **内容校验**：`validate:content` 结构 + 4 身份 ×5 策略运行时验证 PASS。

---

## 部署说明

### Qoder Sites（已准备私有草稿，未发布）

- 产物：`dist/`（`webDirectory: "dist"`，纯静态，无 Function / 数据库 / Secret 依赖）。
- SPA 回退：prepare 时 `spa: true`（平台原生 index.html 回退）；产物另含 `404.html` 兜底。
- 草稿状态：`artifactReady / dependenciesReady / canPublish: true`，`published: false`，
  访问范围 **private**；地址 `parallel-life-lab-n98ni45ruv3.qoder.zone`（发布后生效）。
- 发布：在 Sites 工作台预览确认后点击 Publish（或经 sites-hosting 流程 `publish_site`）。
  本项目数据存于**访问者浏览器** IndexedDB，无需任何云端后端。
- descriptor：`.Parallel Life.qoder.site`（工具生成，勿手改）。

### 通用静态宿主

`dist/` 可直接部署到任意静态宿主：

- 基础路径 `base: '/'`（子域名根路径）；如需子目录部署，改 `vite.config.ts` 的 `base` 后重建。
- SPA 深链二选一：宿主 rewrite（nginx `try_files $uri /index.html;`、Netlify `_redirects`
  `/* /index.html 200`、Vercel rewrites），或利用产物 `404.html`（GitHub Pages 风格回退）。
- 无环境变量、无服务端运行时；`npm run preview` 可本地验收。

### 部署注意事项

- 数据完全本地：换浏览器/设备不共享宇宙；设置页导出 JSON 是唯一备份/迁移手段。
- 导入只新增不覆盖；校验失败整包拒绝，不会破坏现有数据库。
- 纪念卡中文依赖系统字体栈（PingFang SC / Microsoft YaHei / Noto Sans SC），已验证可用。
- 音效受浏览器 autoplay 策略限制：首次用户手势后出声；顶栏可一键静音。

---

## 已知限制

- Playwright bundled chromium 下载受限的环境使用 `msedge` channel（同 Chromium 内核）。
- 隐藏的调试浏览器面板会冻结 rAF（退出动画滞留）；真实浏览器与自动化测试均不受影响。
- 无云同步 / Service Worker 离线缓存（需求边界外）；v1/v2 历史 schema 升级按设计清除不兼容旧记录。