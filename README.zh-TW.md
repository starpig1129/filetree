# StellarNexus - 全球神經矩陣系統

StellarNexus 是一個基於 FastAPI 和 React/Vite 構建的高性能檔案管理與神經矩陣系統。本專案採用現代化的 Single Page Application (SPA) 架構，提供極致的視覺體驗與流暢的操作。

## 🚀 快速啟動

### 1. 環境需求
- **Python**: 3.10+
- **Node.js**: 20+ (推薦)
- **NPM**: 10+

### 2. 後端設定 (FastAPI)
後端負責 API 邏輯、身份驗證與檔案處理。

```bash
# 進入後端目錄 (如有需要)
cd backend

# 安裝依賴
pip install -r requirements.txt

# 啟動後端服務 (預設埠號 5168)
PYTHONPATH=. python3 backend/app.py
```

### 3. 前端設定 (Vite + React)
前端提供基於 StellarNexus 主題的宇宙感視覺介面。

```bash
# 進入前端目錄
cd frontend

# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```

## 🛠️ 管理員指令 (CLI)

系統內建開發者工具 `backend/cli.py` 用於管理使用者：

```bash
# 創建使用者
PYTHONPATH=. python3 backend/cli.py createuser --name admin --password yourpassword

# 列出所有使用者
PYTHONPATH=. python3 backend/cli.py listusers
```

## 📂 系統架構

- `/backend`: FastAPI 伺服器、路由與服務。
- `/frontend`: React SPA 前端，使用 TailwindCSS 與 Framer Motion。
- `/static`: 前端編譯後的靜態檔案。
- `/data`: 使用者上傳的檔案與資料庫 (JSON 檔案)。
- `/docs`: 詳細的系統說明文件。

## 📖 更多說明

請參考 `docs/` 資料夾下的詳細說明：
- [系統架構設計](docs/ARCHITECTURE.md)
- [後端開發說明](docs/BACKEND.md)
- [前端介面說明](docs/FRONTEND.md)
