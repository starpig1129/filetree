# FileNexus 後端開發說明

本文件詳細說明後端 (FastAPI) 的實作細節。

## 1. 目錄結構

```
backend/
├── app.py           # 進入點 (Uvicorn 啟動)
├── config.py        # Pydantic 效能設定
├── config.yaml      # 系統設定參數
├── cli.py           # 管理員指令工具
├── core/            # 核心邏輯 (Auth 等)
├── routes/          # API 路由定義
├── schemas/         # Pydantic 資料模型
└── services/        # 核心商業邏輯 (UserService, FileService 等)
```

## 2. 核心模組說明

### `app.py`
主要的 FastAPI 應用物件。配置了：
- CORS 中間件。
- API 路由掛載。
- 靜態檔案處理與 SPA 路由支持 (自動重導向至 `index.html`)。

### `config.py` & `config.yaml`
使用 Pydantic BaseSettings 實作。支援：
- YAML 設定。
- 環境變數覆蓋。
- 自動建立必要的資料夾。

### `services/UserService.py`
封裝了所有與使用者相關的操作：
- 密碼雜湊與驗證。
- JSON 資料持久化。
- 使用者目錄管理。

### `services/FileService.py`
處理實體檔案操作：
- 安全的檔名檢查。
- 遞迴目錄掃描。
- 磁碟空間檢查（待實作）。

## 3. API 設計規範

- **回傳內容**: 統一使用 JSON 格式。
- **錯誤處理**: 使用 FastAPI 的 `HTTPException` 並包含清晰的說明訊息。
- **類型標記**: 所有函數均包含完整的 Python Type Hints。
## 4. 核心 API 端點

- `GET /api/init`: 初始化 SPA 資料。
- `POST /api/login`: 使用者身份驗證。
- `POST /api/upload`: 實體檔案上傳。
- `POST /api/upload_url`: 建立連結 (URL)。
- `POST /admin/create-user`: [ADMIN] 建立新使用者。
- `POST /admin/reset-password`: [ADMIN] 強制重設使用者密碼。
