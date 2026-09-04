export interface RectDump {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ViewportOverflowFlags {
  innerWidthNear1080: boolean | null;
  documentWiderThanInner: boolean;
  canvasWiderThanInner: boolean;
  drawerOverflowsRight: boolean;
  imageZoomOverflows: boolean;
  categoryModalOverflows: boolean;
  widthMismatchWarning: boolean;
}

export interface ViewportDebugDump {
  monitorId: number | null;
  screenX: number;
  screenY: number;
  outerWidth: number;
  outerHeight: number;
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio: number;
  visualViewportWidth: number | null;
  visualViewportHeight: number | null;
  documentElementClientWidth: number;
  documentElementClientHeight: number;
  bodyClientWidth: number;
  bodyClientHeight: number;
  rootRect: RectDump | null;
  appRootRect: RectDump | null;
  stageRect: RectDump | null;
  threeLayerRect: RectDump | null;
  canvasClientWidth: number | null;
  canvasClientHeight: number | null;
  canvasRect: RectDump | null;
  cameraAspect: number | null;
  canvasAspect: number | null;
  localOverlay: string;
  categoryDrawerRect: RectDump | null;
  imageZoomOverlayRect: RectDump | null;
  imageZoomCardRect: RectDump | null;
  categoryModalRect: RectDump | null;
  overflow: ViewportOverflowFlags;
}

function roundRect(rect: DOMRect): RectDump {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    left: Math.round(rect.left),
    right: Math.round(rect.right),
    top: Math.round(rect.top),
    bottom: Math.round(rect.bottom),
  };
}

function queryRect(selector: string): RectDump | null {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement) || el.getClientRects().length === 0) return null;
  return roundRect(el.getBoundingClientRect());
}

function overflowsRight(rect: RectDump | null, innerWidth: number): boolean {
  return Boolean(rect && rect.right > innerWidth + 1);
}

function overflowsHorizontal(rect: RectDump | null, innerWidth: number): boolean {
  return Boolean(rect && (rect.right > innerWidth + 1 || rect.left < -1));
}

export function collectViewportDebug(params: {
  monitorId: number | null;
  localOverlay: string;
  cameraAspect: number | null;
}): ViewportDebugDump {
  const canvas = document.querySelector('.three-canvas, canvas') as HTMLCanvasElement | null;
  const innerWidth = window.innerWidth;
  const innerHeight = window.innerHeight;
  const canvasRect = canvas ? roundRect(canvas.getBoundingClientRect()) : null;
  const canvasClientWidth = canvas?.clientWidth ?? null;
  const canvasClientHeight = canvas?.clientHeight ?? null;
  const categoryDrawerRect = queryRect('.drawer-panel');
  const imageZoomOverlayRect = queryRect('.image-zoom-overlay');
  const imageZoomCardRect = queryRect('.image-zoom-overlay__card');
  const categoryModalRect = queryRect('.category-modal__card');
  const documentWidth = document.documentElement.clientWidth;
  const widthMismatch =
    Math.abs(innerWidth - documentWidth) > 2 ||
    (canvasClientWidth != null && Math.abs(innerWidth - canvasClientWidth) > 2);

  const dump: ViewportDebugDump = {
    monitorId: params.monitorId,
    screenX: window.screenX,
    screenY: window.screenY,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    innerWidth,
    innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    visualViewportWidth: window.visualViewport?.width ?? null,
    visualViewportHeight: window.visualViewport?.height ?? null,
    documentElementClientWidth: documentWidth,
    documentElementClientHeight: document.documentElement.clientHeight,
    bodyClientWidth: document.body?.clientWidth ?? 0,
    bodyClientHeight: document.body?.clientHeight ?? 0,
    rootRect: queryRect('#root'),
    appRootRect: queryRect('.app'),
    stageRect: queryRect('.list-stage'),
    threeLayerRect: queryRect('.three-layer'),
    canvasClientWidth,
    canvasClientHeight,
    canvasRect,
    cameraAspect: params.cameraAspect,
    canvasAspect:
      canvasClientWidth && canvasClientHeight ? canvasClientWidth / Math.max(canvasClientHeight, 1) : null,
    localOverlay: params.localOverlay,
    categoryDrawerRect,
    imageZoomOverlayRect,
    imageZoomCardRect,
    categoryModalRect,
    overflow: {
      innerWidthNear1080: innerWidth > 0 ? Math.abs(innerWidth - 1080) <= 24 : null,
      documentWiderThanInner: documentWidth > innerWidth + 1,
      canvasWiderThanInner: Boolean(canvasClientWidth != null && canvasClientWidth > innerWidth + 1),
      drawerOverflowsRight: overflowsRight(categoryDrawerRect, innerWidth),
      imageZoomOverflows: overflowsHorizontal(imageZoomCardRect, innerWidth),
      categoryModalOverflows: overflowsHorizontal(categoryModalRect, innerWidth),
      widthMismatchWarning: widthMismatch,
    },
  };
  return dump;
}
