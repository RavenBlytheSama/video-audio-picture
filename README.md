# 格式转换工具

纯前端本地处理的视频转音频 / 图片格式转换工具，可部署在 **Cloudflare Pages** + **自定义域名** `sfn.dpdns.org`。

---

## 功能特性

| 功能 | 支持格式 | 说明 |
|------|----------|------|
| **视频 → 音频** | MP4, AVI, MOV, MKV → MP3 / WAV | 使用 `ffmpeg.wasm` 单线程 core 在浏览器本地转码 |
| **图片格式互转** | JPG, PNG, GIF, WEBP, BMP 任意互转 | 使用 Canvas API + `toDataURL`，GIF 动图仅取首帧 |
| **完全本地** | 无文件上传 | 文件始终停留在用户设备，隐私安全 |
| **进度条** | 实时显示 | 视频转码阶段进度、图片处理进度 |
| **Base64 下载** | 直接生成 data: URL | 点击“下载”即可保存，无需服务端中转 |
| **无状态** | 单次请求独立 | 无登录、无历史记录、刷新即清空 |

---

## 本地预览

```bash
# 在项目根目录启动静态服务器（任选其一）
npx serve format-converter
# 或
python -m http.server 8080 -d format-converter
# 然后访问 http://localhost:8080
```

---

## 部署到 Cloudflare Pages（推荐）

> 纯静态站点，**无需 Workers**，也无需绑定 R2 / KV / D1。只需把 `format-converter/` 文件夹作为 Pages 项目部署即可。

### 1. 准备 Git 仓库
```bash
cd format-converter
git init
git add .
git commit -m "init: format converter static site"
# 推送到 GitHub / GitLab / Bitbucket
git remote add origin https://github.com/<your-name>/format-converter.git
git push -u origin main
```

### 2. 在 Cloudflare Dashboard 创建 Pages 项目
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Pages** → **Create a project** → **Connect to Git**。
2. 选择刚才推送的仓库，**Project name** 填 `format-converter`。
3. **Build settings** 保持默认（无构建命令、无输出目录，或显式填 `Build command: (空)` / `Build output directory: /`）。
4. 点击 **Save and Deploy**，等待部署完成，得到 `https://format-converter.pages.dev`。

### 3. 绑定自定义域名 `sfn.dpdns.org`
1. 在 Pages 项目 → **Custom domains** → **Set up a custom domain**。
2. 输入 `sfn.dpdns.org`，按提示在你的 DNS 提供商（或 Cloudflare DNS）添加 **CNAME** 记录：
   - **Type**: CNAME
   - **Name**: sfn
   - **Target**: `format-converter.pages.dev`（或分配的 `*.pages.dev` 域名）
   - **Proxy status**: **Proxied (橙色云朵)** —— 必须开启，否则 COOP/COEP 头部不会生效。
3. 等待 DNS 生效（通常 < 1 分钟），Pages 会自动签发 TLS 证书。

> **注意**：`_headers` 中的 `Cross-Origin-Opener-Policy: same-origin` 与 `Cross-Origin-Embedder-Policy: require-corp` 要求站点必须在 **HTTPS + 同源隔离** 环境下运行，Cloudflare Pages 的默认 `*.pages.dev` 与自定义域名（开启橙色云朵）均满足条件。

---

## 目录结构

```
format-converter/
├── index.html        # 单页面入口（两个标签页：视频/图片）
├── style.css         # 纯色 UI、无渐变、响应式
├── script.js         # 核心逻辑（ffmpeg.wasm + Canvas）
├── _headers          # Cloudflare Pages 响应头（COOP/COEP、缓存、CORS）
├── wrangler.toml     # 仅作备忘，Pages 部署不需要
└── README.md         # 本文件
```

---

## 技术细节

| 项目 | 说明 |
|------|------|
| **视频转码** | `ffmpeg.wasm` v0.12.10 单线程 core（`@ffmpeg/ffmpeg` + `@ffmpeg/util`），通过 `createFFmpeg({log:true})` + `fetchFile()` + `FS.writeFile/run/readFile` 完成。无需 `SharedArrayBuffer`，因此 **不需要 COOP/COEP**，但保留 `_headers` 以兼容未来多线程版本。 |
| **图片转换** | `HTMLCanvasElement.toDataURL(mime, quality)`，支持 `image/jpeg`、`image/png`、`image/webp`、`image/bmp`、`image/gif`（仅首帧）。 |
| **进度条** | 视频：下载 core(15%) → 写入文件(35%) → 转码(55%) → 读取结果(90%) → 完成(100%)。<br>图片：加载(5%) → 绘制+导出(100%)。 |
| **Base64 下载** | 视频：`URL.createObjectURL(blob)` → `<a download>`。<br>图片：直接使用 `canvas.toDataURL()` 产生的 data: URL。 |
| **错误处理** | `try/catch` 捕获 ffmpeg / Canvas 错误，统一在对应标签页的 `error-card` 中显示 `err.message`。 |
| **文件大小限制** | 代码中仅做**提示**（视频建议 ≤ 1 GB，图片建议 ≤ 200 MB），实际受限于浏览器可用内存（64 位 Chrome 约 1.5–2 GB）。若需严格限制，可在 `input` 的 `change` 事件中校验 `file.size` 并 `alert`。 |

---

## 常见问题

| 问题 | 解决方法 |
|------|----------|
| **视频转码极慢 / 卡死** | ffmpeg.wasm 为纯 WASM 解释执行，CPU 密集。建议：<br>• 仅转码短视频（< 5 分钟）<br>• 关闭其他标签页释放内存<br>• 使用桌面端 Chrome/Edge（移动端内存更受限） |
| **下载后文件无法播放** | 确认输出格式与扩展名一致（MP3→`.mp3`，WAV→`.wav`）。部分播放器对裸流容器支持有限，可尝试用 ffmpeg 重新封装。 |
| **GIF 动图变静态** | Canvas `toDataURL('image/gif')` 仅导出首帧。如需保留动画，需引入 `gif.js` / `omggif` 等库，体积会显著增加，当前版本不包含。 |
| **自定义域名打不开 / 证书报错** | 确认 DNS CNAME 已生效，**且 Cloudflare 代理状态为「Proxied (橙云)」**。若仍失败，在 Pages → Custom domains 点击「Re-verify」或删除重新添加。 |
| **想加 Worker 做服务端转码** | 当前方案为**纯前端**，无 Worker。若后续需要服务端转码（突破浏览器内存限制），需另建 Worker 绑定 R2、使用 `ffmpeg.wasm` 多线程或原生 ffmpeg（需 Docker/Container），架构将完全不同。 |

---

## 许可证

MIT License — 可自由使用、修改、分发。

---

## 更新日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-11-21 | 初始版本：视频转音频 + 图片格式互转，纯前端，Cloudflare Pages 部署 |