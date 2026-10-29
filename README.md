# To Whity.

写给一个人的日记站。

---

## 目录结构

```
index.html            首页：正文、留言、两级归档
admin.html            内容后台：GitHub API 直写 posts/
whityedits.html       她的写稿台：前端 AES 加密后存到 Worker
whityswritings.html   她的阅读页：取回密文在浏览器里解密

posts/                <id>.json 单篇 + index.json 索引
images/               图片（照片统一 WebP，动图保留 GIF）
fonts/                标题字体子集（Noto Serif SC，223 KB）
assets/css/base.css   全站设计系统（CSS 变量 + 组件）
assets/js/motion.js   开屏、打字机、滚动入场、两级归档
```

## 设计体系

日记页（index / admin）走 **奶油 + 珊瑚 + 深墨**：

| 角色 | 值 |
|---|---|
| canvas | `#faf9f5` 奶白，品牌基石 |
| surface-card | `#efe9de` |
| surface-dark | `#181715` 页脚 |
| primary | `#cc785c` 珊瑚，只给主按钮与当前项 |
| ink | `#141413` |

她的页面（whityedits / whityswritings）走 **紫**：`#472153` 凝夜紫 / `#8b5fa0` 浅石英紫 / `#faf8f7` 底。

标题用 Noto Serif SC **400 字重**，正文用系统黑体。不用冷灰、不用纯白、不用蓝色当品牌色；阴影只在弹窗上保留一条 `0 1px 3px rgba(20,20,19,.08)`。

## 归档规则

两级：**月份 → 周**，周一起算。

- 跨月的那一周在两个月的归档里都出现（例如 9/28 那周在「9月」和「10月」里各有一份）
- 周标题带日期区间与篇数：`第五周 10月26日 – 11月1日 · 3 篇`
- 周序号按「这周落在哪个自然月」判定：同一个跨月周，在 10 月记为第一周，在 9 月记为第五周
- 默认只展开最新一周，月份与周都可点击折叠

## 本地预览

```bash
python -m http.server 8899 --bind 127.0.0.1
```

然后打开 http://127.0.0.1:8899/

不要直接双击 `index.html`——`file://` 下 `fetch` 会被 CORS 拦掉，页面会显示空内容。

## 部署

GitHub Pages，分支 `main`，根目录发布。

- 站点地址：https://cedricmeng24-cyber.github.io/beihuanfatie/
- 推送到 `main` 后约 1 分钟自动更新
- 改了 `posts/` 或 `images/` 直接推，后台写入走的也是这条链路

## 日常维护

- 写新文章：走 `admin.html`（需要 GitHub Token，Token 只存本地 localStorage）
- 她的私密文章：走 `whityedits.html`，正文在浏览器里用 PBKDF2 + AES-GCM 加密后才上传，服务端拿到的只有密文
- 图片建议上传前压到 1600px 宽以内；照片存 WebP，需要动图才用 GIF

## 后端

Cloudflare Worker：`https://empty-bird-fb8b.cedricmeng24.workers.dev`

| 接口 | 用途 |
|---|---|
| `GET /comments?post=<id>` | 拉某篇的留言 |
| `POST /comment` | 发留言 |
| `GET /comments` | 全部留言（需管理密码） |
| `POST /comment/delete?pwd=` | 删留言 |
| `POST /log` `GET /logs?pwd=` | 访问记录 |
| `GET /her-list` `POST /her-save` `POST /her-delete` `POST /her-upload` | 她的文章 |

## 许可

私人站点，内容版权归作者所有。
