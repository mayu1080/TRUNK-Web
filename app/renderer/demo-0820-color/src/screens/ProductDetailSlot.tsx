interface ProductDetailSlotProps {
  categoryId: string | null;
  categoryLabel: string | null;
  onClose: () => void;
}

export function ProductDetailSlot({ categoryId, categoryLabel, onClose }: ProductDetailSlotProps) {
  return (
    <div className="product-detail-overlay" role="dialog" aria-label="product detail">
      <button type="button" className="product-detail-overlay__close" onClick={onClose} aria-label="close">
        ×
      </button>
      <p className="screen-kicker">PRODUCT_DETAIL</p>
      <h1 className="screen-title">{categoryLabel || 'Category'}</h1>
      <p className="screen-hint">placeholder</p>
      <p className="product-detail-overlay__id">{categoryId || '(none)'}</p>
    </div>
  );
}
