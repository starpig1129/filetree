import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface DropdownItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  hidden?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  className?: string;
  align?: 'left' | 'right';
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ 
  trigger, 
  items, 
  className,
  align = 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      });
    }
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateCoords();
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (isOpen && menuRef.current) {
      requestAnimationFrame(() => {
        const firstItem = menuRef.current?.querySelector('[role="menuitem"]') as HTMLElement;
        firstItem?.focus();
      });
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      const triggerButton = triggerRef.current?.querySelector('button');
      triggerButton?.focus();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || []) as HTMLElement[];
      if (!items.length) return;

      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      let nextIndex = 0;

      if (e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
      else if (e.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
      else if (e.key === 'Home') nextIndex = 0;
      else if (e.key === 'End') nextIndex = items.length - 1;

      items[nextIndex]?.focus();
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    const handleScrollOrResize = () => {
      if (isOpen) {
        updateCoords();
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const visibleItems = items.filter(item => !item.hidden);

  const menuContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          style={{
            position: 'fixed',
            top: coords.top + 8,
            ...(align === 'right' 
              ? { right: window.innerWidth - (coords.left + coords.width) } 
              : { left: coords.left }
            ),
            zIndex: 9999,
          }}
          className={cn(
            "min-w-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 p-1.5 focus:outline-none",
            className
          )}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-0.5">
            {visibleItems.map((item, index) => (
              <React.Fragment key={index}>
                {item.label === 'separator' ? (
                  <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />
                ) : (
                  <button
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      item.onClick();
                      setIsOpen(false);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all text-left focus:outline-none focus:bg-gray-100 dark:focus:bg-white/10 focus:ring-2 focus:ring-inset focus:ring-cyan-500/50",
                      item.variant === 'danger' 
                        ? "text-red-500 hover:bg-red-500/10" 
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
                    )}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="text-sm font-bold">{item.label}</span>
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="inline-block" ref={triggerRef}>
      <div
        onClick={toggleMenu}
        className="cursor-pointer"
        role="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // Need to simulate mouse event or just call toggleMenu?
            // toggleMenu expects MouseEvent. We can mock it or adjust toggleMenu signature.
            // Simpler: just call setIsOpen
            updateCoords();
            setIsOpen(!isOpen);
          }
        }}
      >
        {trigger}
      </div>
      {createPortal(menuContent, document.body)}
    </div>
  );
};
