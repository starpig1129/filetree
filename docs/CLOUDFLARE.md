# Cloudflare Tunnel 設定指南

為了繞過上傳限制並安全地將您的本地 FileNexus 實例公開到網際網路，我們建議使用 **Cloudflare Tunnel (`cloudflared`)**。

## 1. 安裝 cloudflared

### Linux (Debian/Ubuntu)
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

## 2. 身份驗證
執行以下指令並按照瀏覽器中的說明操作：
```bash
cloudflared tunnel login
```

## 3. 建立隧道
```bash
cloudflared tunnel create filenexus-tunnel
```
這將生成一個包含您隧道憑據的 JSON 檔案。

## 4. 設定隧道
建立 `config.yml`（通常位於 `~/.cloudflared/`）：
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/user/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: files.yourdomain.com
    service: http://localhost:5168
  - service: http_status:404
```

## 5. 設定路由
將您的域名映射到隧道：
```bash
cloudflared tunnel route dns filenexus-tunnel files.yourdomain.com
```

## 6. 執行隧道
```bash
cloudflared tunnel run filenexus-tunnel
```

---

> [!TIP]
> **為什麼選擇 Cloudflare Tunnel？**
> - 無需在路由器上開啟連接埠 (NAT 穿透)。
> - 內建 DDoS 防護。
> - **分片上傳**：我們的 Uppy + Tus 實作會自動將檔案切分為 5MB 的分片，因此對於單個請求，永遠不會達到 Cloudflare 免費層級的 100MB 限制。
