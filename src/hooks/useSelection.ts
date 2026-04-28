import { useState, useCallback, useRef } from 'react';

export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set<string>());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const enter = useCallback((id?: string) => {
    setSelectionMode(true);
    if (id) setSelected(new Set([id]));
  }, []);

  const exit = useCallback(() => {
    setSelectionMode(false);
    setSelected(new Set());
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => setSelected(new Set(ids)), []);

  // Returns props to spread on each grid item
  const getLongPressProps = useCallback((id: string) => {
    const start = (e: React.PointerEvent) => {
      e.preventDefault();
      longPressTimer.current = setTimeout(() => {
        enter(id);
        navigator.vibrate?.(30);
      }, 480);
    };
    const cancel = () => clearTimeout(longPressTimer.current);
    return { onPointerDown: start, onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: cancel };
  }, [enter]);

  return { selected, selectionMode, enter, exit, toggle, selectAll, getLongPressProps };
}
