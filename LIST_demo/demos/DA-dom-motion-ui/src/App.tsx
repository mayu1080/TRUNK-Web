import { useCallback, useMemo, useState } from 'react';
import { CategoryDrawer } from './components/CategoryDrawer';
import { DebugPanel } from './components/DebugPanel';
import { DemoBanner } from './components/DemoBanner';
import { ImageZoomOverlay } from './components/ImageZoomOverlay';
import { MockProductList } from './components/MockProductList';
import { useDemoCards } from './useDemoCards';
import { CLOSE_ON_BACKDROP_DEFAULT, DRAWER_MOTION } from './motionConfig';
import type { OverlayState } from './types';

export function App() {
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState('init');
  const [closeOnBackdrop, setCloseOnBackdrop] = useState(CLOSE_ON_BACKDROP_DEFAULT);
  const [showDrawerScrim, setShowDrawerScrim] = useState(DRAWER_MOTION.showScrimDefault);
  const { cards, indexLoaded } = useDemoCards();

  const pointerBlocked = isImageZoomOpen || isCategoryDrawerOpen;

  const overlayState: OverlayState = useMemo(() => {
    if (isImageZoomOpen) return 'image-zoom-open';
    if (isCategoryDrawerOpen) return 'drawer-open';
    return 'normal';
  }, [isImageZoomOpen, isCategoryDrawerOpen]);

  const openZoom = useCallback((imageId: string, imageUrl: string) => {
    if (isCategoryDrawerOpen) return;
    setSelectedImageId(imageId);
    setSelectedImageUrl(imageUrl);
    setIsImageZoomOpen(true);
    setLastAction(`open IMAGE_ZOOM: ${imageId}`);
  }, [isCategoryDrawerOpen]);

  const closeZoom = useCallback(() => {
    setIsImageZoomOpen(false);
    setLastAction('close IMAGE_ZOOM');
  }, []);

  const openDrawer = useCallback(() => {
    if (isImageZoomOpen) return;
    setIsCategoryDrawerOpen(true);
    setLastAction('open categoryDrawer');
  }, [isImageZoomOpen]);

  const closeDrawer = useCallback(() => {
    setIsCategoryDrawerOpen(false);
    setLastAction('close categoryDrawer');
  }, []);

  const selectCategory = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setLastAction(`select category: ${categoryId}`);
  }, []);

  return (
    <div className="app" data-demo="da-dom-motion-ui">
      <MockProductList cards={cards} blocked={pointerBlocked} onCardTap={openZoom} />

      <div className="ui-chrome-layer">
        <DemoBanner />

        <button
          type="button"
          className="hamburger"
          aria-label="Open category drawer"
          onPointerUp={(e) => {
            e.stopPropagation();
            openDrawer();
          }}
          disabled={isImageZoomOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <DebugPanel
          overlayState={overlayState}
          isImageZoomOpen={isImageZoomOpen}
          isCategoryDrawerOpen={isCategoryDrawerOpen}
          selectedImageId={selectedImageId}
          selectedImageUrl={selectedImageUrl}
          selectedCategoryId={selectedCategoryId}
          pointerBlocked={pointerBlocked}
          lastAction={lastAction}
          closeOnBackdrop={closeOnBackdrop}
          showDrawerScrim={showDrawerScrim}
          indexLoaded={indexLoaded}
        />

        <div className="demo-toggles">
          <label>
            <input
              type="checkbox"
              checked={closeOnBackdrop}
              onChange={(e) => {
                setCloseOnBackdrop(e.target.checked);
                setLastAction(`toggle closeOnBackdrop: ${e.target.checked}`);
              }}
            />
            ZOOM: close on backdrop
          </label>
          <label>
            <input
              type="checkbox"
              checked={showDrawerScrim}
              onChange={(e) => {
                setShowDrawerScrim(e.target.checked);
                setLastAction(`toggle drawerScrim: ${e.target.checked}`);
              }}
            />
            Drawer scrim
          </label>
        </div>
      </div>

      <ImageZoomOverlay
        open={isImageZoomOpen}
        imageId={selectedImageId}
        imageUrl={selectedImageUrl}
        closeOnBackdrop={closeOnBackdrop}
        onClose={closeZoom}
      />

      <CategoryDrawer
        open={isCategoryDrawerOpen}
        selectedCategoryId={selectedCategoryId}
        showScrim={showDrawerScrim}
        onClose={closeDrawer}
        onSelectCategory={selectCategory}
      />
    </div>
  );
}
