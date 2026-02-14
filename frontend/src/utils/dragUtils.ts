import React from 'react';

interface DragItem {
  type: 'file' | 'url' | 'folder';
  id: string;
}

/**
 * Sets a custom drag image for the drag event.
 * If multiple items are being dragged, it shows a stacked card preview with a count badge.
 * If a single item is dragged, it shows a single card preview.
 */
export const setDragPreview = (event: React.DragEvent, items: DragItem[]) => {
  const isMultiple = items.length > 1;
  const count = items.length;
  
  // Create container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-1000px';
  container.style.left = '-1000px';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  
  // Inner HTML structure
  let innerHTML = '';
  
  if (isMultiple) {
    // Stack effect for multiple items
    innerHTML = `
      <div style="position: relative; width: 64px; height: 64px;">
        <div style="position: absolute; top: 4px; left: 4px; right: -4px; bottom: -4px; background: rgba(255, 255, 255, 0.5); border-radius: 8px; border: 1px solid rgba(0, 0, 0, 0.1);"></div>
        <div style="position: absolute; top: 2px; left: 2px; right: -2px; bottom: -2px; background: rgba(255, 255, 255, 0.8); border-radius: 8px; border: 1px solid rgba(0, 0, 0, 0.1);"></div>
        <div style="position: absolute; inset: 0; background: white; border-radius: 8px; border: 1px solid rgba(0, 0, 0, 0.1); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-cyan-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        </div>
        <div style="position: absolute; top: -6px; right: -6px; background: #ef4444; color: white; font-size: 10px; font-weight: bold; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white;">
          ${count > 9 ? '9+' : count}
        </div>
      </div>
    `;
  } else {
    // Single item preview
    innerHTML = `
      <div style="width: 64px; height: 64px; background: white; border-radius: 8px; border: 1px solid rgba(0, 0, 0, 0.1); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-cyan-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
      </div>
    `;
  }
  
  container.innerHTML = innerHTML;
  document.body.appendChild(container);
  
  // Set drag image
  event.dataTransfer.setDragImage(container, 32, 32);
  
  // Clean up after a short delay (browser needs it momentarily)
  setTimeout(() => {
    document.body.removeChild(container);
  }, 0);
};
