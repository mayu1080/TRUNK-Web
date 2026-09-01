import { useEffect, useState } from 'react';
import { DRAWER_MOTION } from '../drawerMotion';
import { formatDrawerLabel } from '../imageCopy';

interface DrawerCategory {
  id: string;
  label: string;
}

interface CategoryDrawerProps {
  open: boolean;
  categories: DrawerCategory[];
  selectedCategoryId: string | null;
  onClose: () => void;
  onSelectCategory: (categoryId: string) => void;
}

/** No × control. Close via scrim / backdrop tap only. Hamburger is hidden while open. */
export function CategoryDrawer({
  open,
  categories,
  selectedCategoryId,
  onClose,
  onSelectCategory,
}: CategoryDrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [openClass, setOpenClass] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setOpenClass(false);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setOpenClass(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setOpenClass(false);
    const timer = window.setTimeout(() => setMounted(false), DRAWER_MOTION.closeMs);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;

  return (
    <div className={`drawer-root${openClass ? ' is-open' : ''}`} aria-hidden={!open}>
      <button type="button" className="drawer-scrim" aria-label="Close menu" onClick={onClose} />
      <aside className="drawer-panel" role="dialog" aria-modal={open} aria-label="Categories">
        <header className="drawer-header">
          <p className="drawer-eyebrow">Explore</p>
          <h2 className="drawer-title">Category</h2>
        </header>
        <nav className="drawer-list" aria-label="Category list">
          {categories.length === 0 ? (
            <p className="drawer-empty">no categories.json entries</p>
          ) : (
            categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`drawer-item${selectedCategoryId === cat.id ? ' selected' : ''}`}
                onClick={() => onSelectCategory(cat.id)}
              >
                <span className="drawer-item-label">{formatDrawerLabel(cat.label)}</span>
              </button>
            ))
          )}
        </nav>
      </aside>
    </div>
  );
}
