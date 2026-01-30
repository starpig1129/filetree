# FileNexus 前端介面說明

本文件說明前端 (React/Vite) 的介面開發與設計哲學。

## 1. 核心技術棧

- **Vite**: 高性能開發建構工具。
- **React 19**: 組件化開發框架。
- **TailwindCSS**: 原子化樣式系統，用於快速建構現代化 UI。
- **Framer Motion**: 強大的動畫庫，用於實現流暢的視覺效果。
- **Lucide React**: 向量圖示庫。

## 2. 視覺設計 (FileNexus Theme)

專案的核心設計理念是「現代化極簡檔案中心」：
- **配色**: 深色背景 (Cosmic Dark) 搭配精確設計的漸變色 (`indigo-500` -> `purple-600` -> `pink-500`)。
- **背景**: 自定義的星空背景動畫，提供深邃且專業的流動感。
- **組件**: 採用玻璃擬態 (Glassmorphism) 設計，提供輕盈且高級的質感。

## 3. 組件結構

```
frontend/src/
├── components/     # 通用 UI 組件 (按鈕、輸入框等)
├── pages/          # 頁面級組件 (Landing, Dashboard, Login)
├── lib/            # 工具函數 (axios 實例, clsx 合併等)
├── App.tsx         # 路由配置與全域佈局
└── index.css       # Tailwind 指令與全域動畫定義
```

## 4. 開發流程

1. **樣式開發**: 優先使用 `index.css` 定義變數與核心動畫。
2. **組件封裝**: 保持組件邏輯專一，樣式由 Tailwind 處理。
3. **API 調用**: 統一使用 `lib/api.ts` (如有創建) 進行非同步請求處理。
