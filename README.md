# 召唤师图标档案馆

一个无需后端的英雄联盟历史召唤师图标浏览站。支持图标 ID 搜索、每页 50 个、原图预览与源站链接。

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
