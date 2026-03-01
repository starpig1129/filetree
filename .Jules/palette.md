## 2026-03-01 - Add ARIA Labels to Icon-Only Buttons
**Learning:** Icon-only buttons without proper ARIA labels and titles create a confusing experience for screen reader users, as they are left without context for the button's action. This is a crucial accessibility gap, especially for frequent actions like 'Remove file' or 'Remove note' which can negatively impact usability.
**Action:** Always add `aria-label` and `title` attributes to icon-only buttons across the application to ensure that all users can understand and interact with these controls efficiently.
