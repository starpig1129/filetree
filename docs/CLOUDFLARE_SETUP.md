# 使用 Cloudflare Tunnel 讓系統上線

本指南將協助您使用 Cloudflare Tunnel 將您的 FileNexus 系統（運行於本地端口 5168）安全地連接到互聯網。無需設定路由器的端口轉發 (Port Forwarding)。

## 前置準備

1. **Cloudflare 帳號**: 您必須擁有一個 Cloudflare 帳號。
2. **域名 (Domain)**: 您必須有一個已經託管在 Cloudflare 上的域名（例如: `myserver.com`）。
3. **已安裝系統**: 確保您的 FileNexus 系統已經可以在本地運行。

## 步驟一：安裝 `cloudflared` 工具

我們需要下載 Cloudflare 的隧道客戶端。

1. **下載**:
   - 請前往 [Cloudflare 下載頁面](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)。
   - 下載 Windows 版本 (`cloudflared-windows-amd64.exe`)。
2. **放置**:
   - 將下載的 `.exe` 檔案改名為 `cloudflared.exe`。
   - 建議將其放入專案的根目錄 `f:\FILESTATION\filetree\`，或者放入 `C:\Windows\System32` 以便在任何地方執行。

## 步驟二：登入 Cloudflare

打開 PowerShell 或 CMD，進入 `cloudflared.exe` 所在的目錄，然後執行：

```powershell
.\cloudflared.exe tunnel login
```

這會打開瀏覽器，請選擇您要使用的域名進行授權。授權完成後，證書檔案會自動下載到您的電腦（通常在 `%USERPROFILE%\.cloudflared\cert.pem`）。

## 步驟三：建立隧道 (Tunnel)

1. **建立隧道**: (請將 `my-tunnel` 替換為您喜歡的名字)
   ```powershell
   .\cloudflared.exe tunnel create my-tunnel
   ```
   執行後，您會看到一個 **Tunnel ID** (一長串 UUID)。

2. **設定 DNS**: (將 `files.myserver.com` 替換為您想要的網址)
   ```powershell
   .\cloudflared.exe tunnel route dns my-tunnel files.myserver.com
   ```

## 步驟四：設定組態檔案

在專案目錄下建立一個 config 檔案，例如 `cloudflare_config.yml`：

```yaml
tunnel: <您的-Tunnel-ID>
credentials-file: C:\Users\sftp\.cloudflared\<您的-Tunnel-ID>.json

ingress:
  - hostname: files.myserver.com
    service: http://localhost:5168
  - service: http_status:404
```

> **注意**: `credentials-file` 的路徑必須正確，步驟三建立隧道時會顯示該 JSON 檔案的位置。

## 步驟五：啟動隧道

測試是否正常運作：

```powershell
.\cloudflared.exe tunnel run my-tunnel --config .\cloudflare_config.yml
```

如果出現 `Connection Registered`，代表成功了！現在您可以用瀏覽器訪問 `https://files.myserver.com`。

## 如何同時啟動系統與隧道

您可以使用我們提供的 `start_with_tunnel.ps1` 腳本來同時啟動後端與隧道。

```powershell
.\start_with_tunnel.ps1
```
