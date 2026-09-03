/**
 * IMAGE_ZOOM / Category modal copy.
 * Phase 5.16: content/text/TOKYO FOOD.txt is the shared source (quotes kept, newlines kept).
 * Per-image / per-course files are deferred (see production-app-feedback-report.md).
 */
export const SAMPLE_IMAGE_DESCRIPTION = '説明文がここに入ります。';

export interface ImageCopy {
  title: string;
  description: string;
  categoryLabel: string;
}

export function formatDrawerLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  if (/^[A-Z0-9][A-Z0-9 _-]*$/.test(trimmed) && /[A-Z]/.test(trimmed)) {
    return trimmed
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return trimmed;
}

export function resolveImageCopy(input: {
  sharedTitle?: string | null;
  sharedDescription?: string | null;
  sourceImageId?: string | null;
  cardTitle?: string | null;
  categoryLabel?: string | null;
  categoryTitle?: string | null;
  categoryDescription?: string | null;
}): ImageCopy {
  const categoryLabel = formatDrawerLabel(input.categoryLabel ?? '');
  const sharedTitle = input.sharedTitle?.trim() ?? '';
  const sharedDescription = input.sharedDescription ?? '';
  if (sharedTitle || sharedDescription.trim()) {
    return {
      title: sharedTitle,
      description: sharedDescription.trim() || SAMPLE_IMAGE_DESCRIPTION,
      categoryLabel: '',
    };
  }
  const title =
    (input.cardTitle && input.cardTitle.trim()) ||
    (input.categoryTitle && input.categoryTitle.trim()) ||
    categoryLabel ||
    input.sourceImageId ||
    '';
  const fromCategory = input.categoryDescription?.trim() ?? '';
  const description = fromCategory || SAMPLE_IMAGE_DESCRIPTION;
  return { title, description, categoryLabel };
}
