import { useState, useCallback } from 'react';
import type { SelectedItem } from '../types/dashboard';

export function useSelection() {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleSelectItem = useCallback((type: 'file' | 'url' | 'folder', id: string) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.type === type && i.id === id);
      if (exists) {
        return prev.filter(i => !(i.type === type && i.id === id));
      } else {
        return [...prev, { type, id }];
      }
    });
  }, []);

  const handleSelectAll = useCallback((
    items: SelectedItem[], 
    shouldSelect: boolean
  ) => {
    if (shouldSelect) {
      setSelectedItems(prev => {
         // Avoid duplicates
         const newItems = items.filter(item => !prev.some(p => p.type === item.type && p.id === item.id));
         return [...prev, ...newItems];
      });
    } else {
      // Remove specific items
      setSelectedItems(prev => prev.filter(p => !items.some(item => item.type === p.type && item.id === p.id)));
    }
  }, []);

  const handleBatchSelect = useCallback((items: SelectedItem[], action: 'add' | 'remove' | 'set') => {
    setSelectedItems(prev => {
      if (action === 'set') return items;
      if (action === 'add') {
        const newItems = items.filter(item => !prev.some(p => p.type === item.type && p.id === item.id));
        return [...prev, ...newItems];
      }
      if (action === 'remove') {
        return prev.filter(p => !items.some(item => item.type === p.type && item.id === p.id));
      }
      return prev;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems([]);
    setIsSelectionMode(false);
  }, []);

  return {
    selectedItems,
    setSelectedItems,
    isSelectionMode,
    setIsSelectionMode,
    toggleSelectItem,
    handleSelectAll,
    handleBatchSelect,
    clearSelection
  };
}
