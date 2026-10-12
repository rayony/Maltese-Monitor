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

詳情請參考 [金寶湯官方 Facebook](https://www.facebook.com/share/1MCNJTc3h6/?mibextid=wwXIfr)。

官方地址（非即時更新）：[【金寶湯｜線條小狗 4罐禮品裝】分店列表](https://docs.google.com/document/d/1utbUxE3w15LOii3FxsbG2Q34GuGM6keUolN_V07po4I/edit?usp=sharing)。

## 本機先跑到

```bash
npm ci
npm run dev
```

開本機預覽。冇設 `DATABASE_URL` 時資料留喺記憶體，重新開程序會清。正式環境先設 `DATABASE_URL`。

## Credits

**Gary.TC**（[rayony](https://github.com/rayony)）

- 地圖圖磚：香港特別行政區政府地政總署。顯示時用佢指定嘅字句：「地圖由地政總署提供」／「Map from Lands Department」。畫圖用 [MapLibre GL JS](https://maplibre.org/)（BSD-3-Clause）。冇用 Leaflet。
- 界面同程式由 [Grok](https://grok.com) 協助整

## License

程式、自己寫嘅文字同界面用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)。歡迎非商業再用，但要註明 **Gary.TC**。

地圖圖磚同區界唔喺呢個授權入面，版權仍然係香港特別行政區政府。唔好把它當成可以轉授或者當係自己嘅地圖。地政總署 Map API 要求地圖上面見到「Map from Lands Department」，並保留地政總署標誌。資料只供參考，政府冇保證準確，亦唔負責使用上嘅損失。詳見 [CSDI Map API 說明](https://portal.csdi.gov.hk/csdi-webpage/apidoc/ImageryMapAPI) 同 [免責聲明](https://api.portal.hkmapservice.gov.hk/disclaimer)（2026-07-08 修訂）。
