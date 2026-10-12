# 金寶湯糾察

香港超市金寶湯現場報料。綠點係好多，黃點係好少，紅點係冇晒。揀舖或者自己喺地圖釘低位置，公開紀錄，唔使登入。

而家公開嘅網站：[maltese-gumboton.grok.me](https://maltese-gumboton.grok.me/)

<p align="center">
  <img src="public/og.jpg" alt="金寶湯糾察" width="640">
</p>

## 點用

- 時間滑桿跟**目擊時間**，由 10 分鐘到 7 日，預設 1 日。報料時間只係顯示交表嗰刻。
- 頂部可剔品牌組（百佳／惠康／其他）、顏色、同埋合併附近釘。
- 地區可以多選。揀咗之後地圖會框住嗰幾區，選擇記喺瀏覽器。
- 顏色篩選會先收起未剔嘅報料，釘色跟剩下最新一條目擊。
- 同一個舖只得一粒釘，彈出視窗最多列 5 條。撳地址會開 Google 地圖搜尋。
- 留言最多 50 字。每個舖只留最新 5 條，超過 7 日嘅報料唔再顯示。

交報料：`POST /api/reports`，JSON 欄位係 `brand`、`name`、`address`、`lat`、`lng`、`qty`（好多／好少／冇晒，亦接受多貨／少量／無貨）、`note`、`at`（目擊時間，ISO）。`GET /api/reports` 讀返近 7 日、未隱藏嘅報料。

管理員頁係 `/desk`。密碼只以 scrypt 雜湊加 salt 存喺資料庫，登入維持 12 小時。可以改數量、留言、目擊時間，或者隱藏一條。

## GitHub Pages 跑唔到

**唔係。** 開 `https://rayony.github.io/Maltese-Monitor/` 唔會係個可用嘅糾察。

GitHub Pages 只會派靜態檔。呢個 app 係 TanStack Start：

- 報料要寫入 Postgres（正式環境係 Neon；本機冇 `DATABASE_URL` 就用內嵌 PGLite）
- 清單、提交、管理員頁 `/desk` 都係伺服器功能
- 地圖要個 Node 程序先渲染到

所以 Pages 上面唔會有資料庫，報料都交唔到。而家用緊嘅版本，請用上面個公開網站。

## 本機先跑到

```bash
npm ci
npm run dev
```

開本機預覽。冇設 `DATABASE_URL` 時資料留喺記憶體，重新開程序會清。正式環境先設 `DATABASE_URL`。

## Credits

**Gary.TC**（[rayony](https://github.com/rayony)）

- 地圖：香港特別行政區政府地政總署 WGS84 矢量圖，用 [MapLibre GL](https://maplibre.org/) 顯示
- 界面同程式由 [Grok](https://grok.com) 協助整

## License

未另發授權。地圖資料跟地政總署嘅使用條款，唔屬於呢個 repo。
