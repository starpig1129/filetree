# StellarNexus 系統架構設計

本文件說明 StellarNexus 系統的技術架構與資料流向。

## 1. 架構概述

StellarNexus 採用前後端分離的 **Pure SPA (Single Page Application)** 架構：

- **前端 (Frontend)**: 使用 React + Vite 構建，負責所有介面渲染與使用者互動。
- **後端 (Backend)**: 使用 FastAPI 構建，提供 RESTful API 與檔案處理服務。
- **儲存 (Storage)**: 
    - 檔案儲存：本地檔案系統 (`data/uploads`)。
    - 描述檔案：JSON 檔案 (`data/user_info.json`)。

## 2. 資料流向

### 使用者登入
1. 前端發送登入請求至 `/api/login`。
2. 後端驗證使用者 (透過 `UserService`)。
3. 後端回傳 Token 與使用者資訊。
4. 前端將資訊儲存於本地並導向儀表板。

### 檔案上傳
1. 前端透過 Multipart Form 發送檔案至 `/api/files/upload`。
2. 後端 `FileService` 接收檔案並儲存至使用者專屬目錄。
3. 更新 `user_info.json` 中的檔案列表。

## 3. 核心組件設計

### 後端服務層 (Services)
- `UserService`: 處理使用者註冊、登入與資料讀寫。
- `FileService`: 處理目錄創建、檔案上傳/下載/刪除。
- `TokenService`: 處理分享連結的 Token 生成與驗證。

### 前端頁面層 (Pages)
- `LandingPage`: 展現 StellarNexus 宇宙感品牌形象。
- `Dashboard`: 核心檔案管理介面。
- `LoginPage`: 驗證介面。
