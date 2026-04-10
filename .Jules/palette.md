## 2024-05-24 - FileItem Action Buttons Accessibility
**Learning:** Found that the primary grid and list views of the FileNexus dashboard (`FileItem.tsx`) were heavily relying on icon-only buttons for critical actions (Share, Download, Delete, Lock, QR Code) without `aria-label`s, presenting a significant barrier for screen reader users. The app uses Traditional Chinese for UI labels, so all `aria-label` additions needed to match this localization.
**Action:** Always verify icon-only buttons in new components for `aria-label`s, ensuring the text matches the application's localized language (Traditional Chinese) rather than defaulting to English.

## 2024-05-24 - Folder and URL Items Accessibility
**Learning:** Similar to FileItem, FolderItem and UrlView lacked critical `aria-label`s for their respective action menus and icons. Screen reader users would hear an unlabeled "button" when tabbing through these core features. Applying Traditional Chinese labels (e.g., "分享", "刪除資料夾", "複製") maintains the strict localization pattern necessary for this app's accessibility tree.
**Action:** Extend the accessibility checklist to all resource views (Files, Folders, URLs) so that every interaction icon has an explicit, localized `aria-label`.
