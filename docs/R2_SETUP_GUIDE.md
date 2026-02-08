# Cloudflare R2 部署指南

為了啟用 **FileNexus Turbo Mode** (無限頻寬上傳/下載)，請依照以下步驟設定 Cloudflare R2。

## 1. 建立 R2 Bucket (儲存體)
1.  登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  進入 **R2** 選單。
3.  點擊 **"Create Bucket"**。
4.  **Bucket Name**: 輸入一個名稱 (例如 `filenexus-storage`)。
5.  **Location**: 選擇 `Automatic` 或離你最近的區域 (如 `APAC`)。
6.  點擊 **"Create Bucket"**。

## 2. 設定 CORS (跨來源資源共享) - **重要！**
前端 Uppy 直接上傳到 R2 需要此設定。

1.  進入剛建立的 Bucket。
2.  點擊 **"Settings"** 分頁。
3.  找到 **"CORS Policy"**區塊，點擊 **"Add CORS Policy"**。
4.  貼上以下 JSON 設定：

```json
[
  {
    "AllowedOrigins": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3600
  }
]
```
> **注意**：為了安全性，生產環境建議將 `AllowedOrigins` 的 `*` 改為您的網域 (例如 `https://file.yourdomain.com`)。

## 3. 設定生命週期規則 (Lifecycle Rules) - **省錢關鍵**
確保 R2 不會變成永久儲存 (因為我們只用它來做暫存加速)。

1.  在 **Settings** 分頁，找到 **"Object Lifecycle Rules"**。
2.  點擊 **"Add Rule"**。
3.  **Rule Name**: `Auto Delete Temp`
4.  **Condition**: Leave blank (Apply to all objects) OR Prefix `temp/` and `cache/`.
    - 建議設定兩個規則，分別針對 `temp/` 和 `cache/`。
5.  **Action**:
    - **Delete object**: Set to **1 Day** (or even 1 Hour).
6.  點擊 **"Save"**。

## 4. 取得 API 金鑰 (Access Keys)
1.  回到 R2 主畫面 (R2 Overview)。
2.  在右側點擊 **"Manage R2 API Tokens"**。
3.  點擊 **"Create API Token"**。
4.  **Permissions**: 選擇 **"Admin Read & Write"**。
5.  **TTL**: `Forever` (或您自行管理)。
6.  點擊 **"Create API Token"**。
7.  **抄寫以下資訊 (只會顯示一次！)**：
    - `Access Key ID`
    - `Secret Access Key`
    - `Endpoint` (格式通常為 `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)

## 5. 設定 FileNexus `.env`
回到您的伺服器，編輯專案根目錄下的 `.env` 檔案：

```bash
# Cloudflare R2 Configuration
R2__ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2__ACCESS_KEY_ID=<YOUR_ACCESS_KEY_ID>
R2__SECRET_ACCESS_KEY=<YOUR_SECRET_ACCESS_KEY>
R2__BUCKET_NAME=filenexus-storage
R2__PUBLIC_DOMAIN=  # 留空即可 (除非您有綁定自訂網域)
R2__THRESHOLD_MB=100  # 超過 100MB 自動走 R2
```

## 6. 重啟服務
設定完成後，請重啟後端服務以套用設定。

```bash
# 若使用 PM2
pm2 restart all

# 若使用 Docker
docker-compose restart
```

現在，您應該能在前端看到 **火箭圖示 (Turbo Mode)**，試著上傳一個大檔案體驗極速快感吧！
