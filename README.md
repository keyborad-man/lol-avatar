# 召唤师图标档案馆

一个无需后端的英雄联盟历史召唤师图标浏览站。支持图标 ID 搜索、每页 50 个、原图预览与源站链接。

支持全息闪卡效果：列表悬停显示镭射流光，打开预览后可移动鼠标或左右滑动，让卡面倾斜并改变彩虹反光与闪点。聚焦预览卡片后也可用方向键调整、Home 复位。预览中的「闪卡效果」开关和「流光强度」滑块同时控制列表与大图，关闭后查看原图颜色；系统开启减少动态效果时不进行立体倾斜。

使用 CSS 叠层与原生指针交互实现，直接复用现有 PNG，不需要额外素材、构建步骤或 3D 依赖。源站链接仍然提供未经特效处理的原始图片。

## 在线预览

[lol-avatar.981127.xyz](https://lol-avatar.981127.xyz/)

### 全息闪卡效果

点击图标进入大图预览，移动鼠标即可观察随角度变化的镭射反光与闪点。下图为实际页面截图，静态图片仅展示一个观看角度。

![召唤师图标全息闪卡效果：立体倾斜、彩虹流光与强度调节](docs/holo-preview.png)

### 页面与图标列表

![召唤师图标档案馆页面预览](docs/preview.png)

![历史召唤师图标列表预览](docs/icons-preview.png)

## 本地运行

直接打开 `index.html`，或使用任意静态文件服务器：

```powershell
python -m http.server 4173
```

然后访问 `http://localhost:4173`。

## 更新图标索引

```powershell
node scripts/sync-icons.mjs
```

图标索引和原始 PNG 来自 [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon)。网站不需要 Riot API Key。

## 参考与致谢

感谢 [EverettFish](https://github.com/EverettFish) 及 [Holo Card Studio](https://github.com/EverettFish/holo-card-studio) 的贡献者开源分享全息闪卡的实现思路。本项目的立体倾斜、彩虹镭射、扫光与闪点效果受到该项目启发；针对现有的单张召唤师图标 PNG，使用 CSS 叠层和原生 JavaScript 实现了适合本静态站点的版本。

想了解分层视差、Three.js 着色器及 Blender 卡片制作流程，可访问 [Holo Card Studio 原仓库](https://github.com/EverettFish/holo-card-studio) 和[浏览器端参考实现](https://github.com/EverettFish/holo-card-studio/blob/main/assets/web-template/app.js)。
