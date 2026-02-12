# FileNexus - 企業級高效能檔案管理系統

![Status](https://img.shields.io/badge/Status-Production-brightgreen)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)
![React](https://img.shields.io/badge/Frontend-React%2018-61DAFB)

FileNexus 是一個專為追求極致效能與視覺體驗而打造的現代化檔案管理系統。我們結合了高效的 FastAPI 後端與流暢的 React SPA 前端，提供安全、穩定且優雅的私有雲解決方案。

## ✨ 核心特色

- **🔒 企業級安全防護**：原生支援 Cloudflare Tunnel (反向代理) 部署，無需暴露真實 IP，自動享用 DDoS 防護。
- **🚀 極速傳輸架構**：基於 TUS 協議的斷點續傳技術，支援 GB 級大檔案穩定上傳。
- **💎 沉浸式視覺體驗**：精心設計的深色主題介面 (Dark Mode)，搭配流暢的互動動畫。
- **🛡️ 嚴格權限控管**：完整的用戶身份驗證 (JWT) 與角色權限管理系統 (RBAC)。
- **📂 智能檔案管理**：支援多層級目錄、即時預覽、拖曳上傳與批量操作。

---

## 🌩️ 產品級部署指南 (Cloudflare Tunnel)

為了確保生產環境的安全性與連線品質，**我們強烈建議使用 Cloudflare Tunnel 進行部署**。此架構無需在路由器開啟任何埠口 (Port Forwarding)，即可讓外部安全存取您的 FileNexus 實例。

### 即刻啟動 (Quick Start)

#### 1. 準備工作
- 一個由 Cloudflare 代管的網域 (例如 `your-domain.com`)。
- 一台運行 Linux (Ubuntu/Debian 推薦) 的伺服器。
- Python 3.10+ 與 Node.js 20+ 環境。

#### 2. 安裝 Cloudflared

**Linux (Ubuntu/Debian)**
```bash
# 透過官方儲存庫安裝
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

**Windows**
1. 下載官方執行檔：[cloudflared-windows-amd64.exe](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe)
2. 將檔案重新命名為 `cloudflared.exe` 並放置於慣用路徑 (例如 `C:\Cloudflared\`)。
3. 以**系統管理員身分**開啟 PowerShell 執行後續指令。

```powershell
# 驗證安裝
.\cloudflared.exe version
```

#### 3. 建立安全隧道 (Secure Tunnel)
登入您的 Cloudflare 帳號並授權伺服器：

```bash
# Linux/Mac
cloudflared tunnel login

# Windows (PowerShell)
.\cloudflared.exe tunnel login
```
系統將提供一個 URL，請在瀏覽器中開啟並選擇您的網域以完成授權。

建立一條名為 `filenexus` 的專屬隧道：

```bash
# Linux
cloudflared tunnel create filenexus

# Windows
.\cloudflared.exe tunnel create filenexus
```
記下回傳的 Tunnel ID (例如: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)。

#### 4. 配置 DNS 路由
將您的子網域 (例如 `files.your-domain.com`) 指向此隧道：

```bash
# Linux
cloudflared tunnel route dns filenexus files.your-domain.com

# Windows
.\cloudflared.exe tunnel route dns filenexus files.your-domain.com
```

#### 5. 啟動服務與反向代理
FileNexus 預設運行於本地 `5168` 埠。

```bash
# Linux
cloudflared tunnel run --url http://localhost:5168 filenexus

# Windows
.\cloudflared.exe tunnel run --url http://localhost:5168 filenexus
```

> **💡 專業建議**：在生產環境中，建議將 cloudflared 安裝為系統服務 (Systemd/Windows Service) 以確保開機自動啟動：
> - Linux: `sudo cloudflared service install`
> - Windows: `.\cloudflared.exe service install`

---

## 🛠️ 開發者部署 (Localhost)

僅供開發測試或區域網路內使用。

### 環境設置

1.  **後端 (Backend)**
    ```bash
    cd backend
    pip install -r requirements.txt
    
    # Linux / macOS
    PYTHONPATH=. python3 backend/app.py
    
    # Windows (PowerShell)
    $env:PYTHONPATH="."; python backend/app.py
    ```

2.  **前端 (Frontend)**
    ```bash
    cd frontend
    npm install
    
    # 啟動開發伺服器
    npm run dev
    ```

---

## ⚙️ 系統管理 (CLI)

FileNexus 內建強大的命令列工具，方便管理員進行維運操作。

### 用戶管理

```bash
# 創建新的管理員帳號
PF=backend PYTHONPATH=. python3 backend/cli.py createuser --name admin --password "StrongPassword123!"

# 列出所有系統用戶
PF=backend PYTHONPATH=. python3 backend/cli.py listusers

# 重設用戶密碼
PF=backend PYTHONPATH=. python3 backend/cli.py resetpassword --name admin --new-password "NewPassword456!"
```

---

## 🏗️ 系統架構

- **Backend**: FastAPI (Python), Uvicorn, SQLite/JSON (Metadata), TUS Protocol.
- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, Framer Motion.
- **Security**: OAuth2 with Password (Bearer JWT), BCrypt hashing.

## 📄 版權與授權

© 2024-2026 FileNexus Team. All Rights Reserved.
本專案採用 MIT 授權條款，詳情請參閱 [LICENSE](LICENSE) 文件。
