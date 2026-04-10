## 2024-05-24 - FileItem Action Buttons Accessibility
**Learning:** Found that the primary grid and list views of the FileNexus dashboard (`FileItem.tsx`) were heavily relying on icon-only buttons for critical actions (Share, Download, Delete, Lock, QR Code) without `aria-label`s, presenting a significant barrier for screen reader users. The app uses Traditional Chinese for UI labels, so all `aria-label` additions needed to match this localization.
**Action:** Always verify icon-only buttons in new components for `aria-label`s, ensuring the text matches the application's localized language (Traditional Chinese) rather than defaulting to English.

## 2024-05-24 - Pervasive Icon-Only Button Pattern
**Learning:** The missing `aria-label` pattern on icon-only action buttons extends beyond just `FileItem.tsx` to all dashboard item components, including `FolderItem.tsx` and `UrlView.tsx`. This indicates a pervasive design system gap where the `Action Buttons` group lacks accessibility by default.
**Action:** When auditing or creating any new dashboard item types (e.g., File, Folder, URL, Note), proactively check and add Traditional Chinese `aria-label`s to the standard action icon set (Share, Delete, Copy, QR Code, Lock).
