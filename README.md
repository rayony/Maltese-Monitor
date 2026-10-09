# 金寶湯糾察

香港超市金寶湯現場報料。綠點係好多，紅點係好少。揀舖或者自己喺地圖釘低位置，公開紀錄，唔使登入。

<p align="center">
  <img src="public/og.jpg" alt="金寶湯糾察" width="640">
</p>

## GitHub Pages 跑唔到

**唔係。** 開 `https://rayony.github.io/Maltese-Monitor/` 唔會係個可用嘅糾察。

GitHub Pages 只會派靜態檔。呢個 app 係 TanStack Start：

- 報料要寫入 Postgres（正式環境係 Neon；本機冇 `DATABASE_URL` 就用內嵌 PGLite）
- 清單、提交、管理員頁 `/desk` 都係伺服器功能
- 地圖要個 Node 程序先渲染到

所以 Pages 上面唔會有資料庫，報料都交唔到。而家用緊嘅版本，請用 App Builder 發佈出嚟嗰個網站。

## 本機先跑到

```bash
npm ci
npm run dev
```

開本機預覽。冇設 `DATABASE_URL` 時資料留喺記憶體，重新開程序會清。正式環境先設 `DATABASE_URL`。

管理員頁係 `/desk`。密碼只以 scrypt 雜湊加 salt 存喺資料庫，唔會寫喺程式入面。

## Credits

**Gary.TC**（[rayony](https://github.com/rayony)）

- 地圖：香港特別行政區政府地政總署 WGS84 矢量圖，用 [MapLibre GL](https://maplibre.org/) 顯示
- 界面同程式由 [Grok](https://grok.com) 協助整

## License

未另發授權。地圖資料跟地政總署嘅使用條款，唔屬於呢個 repo。
