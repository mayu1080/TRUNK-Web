import { AnimatePresence, motion } from 'framer-motion';
import { DRAWER_MOTION, DRAWER_SCRIM_MOTION, MOCK_CATEGORIES } from '../drawerMotion';

interface CategoryDrawerProps {
  open: boolean;
  selectedCategoryId: string | null;
  showScrim: boolean;
  onClose: () => void;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoryDrawer({
  open,
  selectedCategoryId,
  showScrim,
  onClose,
  onSelectCategory,
}: CategoryDrawerProps) {
  const panelTransition = (state: string) => ({
    duration: (state === 'exit' ? DRAWER_MOTION.closeMs : DRAWER_MOTION.durationMs) / 1000,
    ease: DRAWER_MOTION.easing,
  });
  const scrimTransition = {
    duration: DRAWER_SCRIM_MOTION.durationMs / 1000,
    ease: DRAWER_SCRIM_MOTION.easing,
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {showScrim && (
            <motion.button
              type="button"
              className="drawer-scrim"
              aria-label="Close menu"
              initial={DRAWER_SCRIM_MOTION.initial}
              animate={DRAWER_SCRIM_MOTION.animate}
              exit={DRAWER_SCRIM_MOTION.exit}
              transition={scrimTransition}
              onClick={onClose}
            />
          )}
          <motion.aside
            className="drawer-panel"
            initial={DRAWER_MOTION.initial}
            animate={DRAWER_MOTION.animate}
            exit={DRAWER_MOTION.exit}
            transition={panelTransition}
            role="dialog"
            aria-modal="true"
            aria-label="Categories"
          >
            <header className="drawer-header">
              <p className="drawer-eyebrow">Explore</p>
              <h2 className="drawer-title">Category</h2>
            </header>
            <nav className="drawer-list" aria-label="Category list">
              {MOCK_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`drawer-item${selectedCategoryId === cat.id ? ' selected' : ''}`}
                  onClick={() => onSelectCategory(cat.id)}
                >
                  <span className="drawer-item-label">{cat.label}</span>
                </button>
              ))}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
