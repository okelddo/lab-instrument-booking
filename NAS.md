# NAS 共用說明

共用資料夾：`\\nas\Temp\ChesterHsu`
共用檔名：`instrument-bookings.json`

## 為什麼不能「自動寫入路徑」？

瀏覽器安全限制不允許網頁直接寫 `\\nas\...`。
改為：每人用 Chrome / Edge 點一次「連接 NAS 資料夾」選該資料夾，之後：

- 開啟網頁 → 自動匯入 `instrument-bookings.json`
- 預約存檔 / 取消 → 自動寫回同一個檔
- 每 8 秒檢查檔案是否被別人更新

## 使用步驟

1. 確定電腦可開 `\\nas\Temp\ChesterHsu`
2. 用 Chrome 或 Edge 打開 https://okelddo.github.io/lab-instrument-booking/
3. 按「連接 NAS 資料夾」，選 `ChesterHsu` 資料夾（不是選 json 檔）
4. 允許讀寫
5. 填名稱、預約。完成後資料夾會出現 / 更新 `instrument-bookings.json`
