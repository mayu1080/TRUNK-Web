import type { DemoListImage } from './types';

export class ZoomOverlay {
  private root: HTMLElement;
  private idEl: HTMLElement;
  private imgEl: HTMLImageElement;
  private closeBtn: HTMLButtonElement;
  private onCloseCallback: (() => void) | null = null;

  constructor() {
    const root = document.getElementById('zoom-overlay');
    const idEl = document.getElementById('zoom-id');
    const imgEl = document.getElementById('zoom-img') as HTMLImageElement | null;
    const closeBtn = document.getElementById('zoom-close') as HTMLButtonElement | null;
    if (!root || !idEl || !imgEl || !closeBtn) {
      throw new Error('zoom overlay DOM missing');
    }
    this.root = root;
    this.idEl = idEl;
    this.imgEl = imgEl;
    this.closeBtn = closeBtn;

    this.closeBtn.addEventListener('click', () => this.close());
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
  }

  open(image: DemoListImage, onClose: () => void): void {
    this.onCloseCallback = onClose;
    const category = image.categoryId ? `\ncategoryId: ${image.categoryId}` : '';
    this.idEl.textContent = `id: ${image.id}${category}\npath: ${image.relativePath}`;
    this.imgEl.src = image.url;
    this.imgEl.alt = image.fileName;
    this.root.classList.add('open');
    this.root.setAttribute('aria-hidden', 'false');
  }

  close(): void {
    if (!this.root.classList.contains('open')) return;
    this.root.classList.remove('open');
    this.root.setAttribute('aria-hidden', 'true');
    this.imgEl.removeAttribute('src');
    const cb = this.onCloseCallback;
    this.onCloseCallback = null;
    cb?.();
  }

  isOpen(): boolean {
    return this.root.classList.contains('open');
  }
}
