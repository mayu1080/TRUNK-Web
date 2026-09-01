import { DEMO_PHASE, demoConfig } from '../demoConfig';
import { runtimeConfig } from '../runtimeConfig';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../uiScale';
import type { ImageZoomLoadStatus, ListDebugStats, SelectedDemoCard } from '../types';
import type { LogoAssetStatus } from './ListLogo';

export interface DebugHudProps {
  screenState: string;
  reviewMode: boolean;
  debugHudEnabled: boolean;
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio: number;
  uiScale: number;
  demoMode: boolean;
  forceSingleMonitor: boolean;
  monitorId: number | null;
  monitorCount: number | null;
  categoryDrawer: string;
  selectedCategoryId: string | null;
  selectedCategoryLabel: string | null;
  productDetailOpen: boolean;
  drawerOpen: boolean;
  drawerScrimVisible: boolean;
  hamburgerVisible: boolean;
  hamburgerMode: 'bars' | 'close';
  selectedListImageId: string | null;
  imageZoomOpen: boolean;
  imageZoomLoadStatus: ImageZoomLoadStatus;
  exploreHostMounted: boolean;
  listReady: boolean;
  selectedCard: SelectedDemoCard | null;
  listStats: ListDebugStats | null;
  logoStatus?: LogoAssetStatus | null;
}

function fmt(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

function trimUrl(url: string | null | undefined, max = 72): string {
  if (!url) return '(none)';
  return url.length > max ? `${url.slice(0, max)}…` : url;
}

export function DebugHud({
  screenState,
  reviewMode,
  debugHudEnabled,
  innerWidth,
  innerHeight,
  devicePixelRatio,
  uiScale,
  demoMode,
  forceSingleMonitor,
  monitorId,
  monitorCount,
  categoryDrawer,
  selectedCategoryId,
  selectedCategoryLabel,
  productDetailOpen,
  drawerOpen,
  drawerScrimVisible,
  hamburgerVisible,
  hamburgerMode,
  selectedListImageId,
  imageZoomOpen,
  imageZoomLoadStatus,
  exploreHostMounted,
  listReady,
  selectedCard,
  listStats,
  logoStatus,
}: DebugHudProps) {
  const canvasMounted = listStats?.canvasMounted ?? false;
  const selectedInstanceId = selectedCard?.instanceId ?? listStats?.selectedInstanceId ?? null;
  const selectedSourceImageId = selectedCard?.sourceImageId ?? listStats?.selectedSourceImageId ?? null;
  const selectedDisplayIndex = selectedCard?.displayIndex ?? listStats?.selectedDisplayIndex ?? null;
  const selectedImageUrl = selectedCard?.imageUrl ?? listStats?.selectedImageUrl ?? null;
  const selectedRelativePath = selectedCard?.relativePath ?? listStats?.selectedRelativePath ?? null;
  const selectedTitle = selectedCard?.title ?? listStats?.selectedTitle ?? null;
  const selectedCardCategoryId = selectedCard?.categoryId ?? listStats?.selectedCategoryId ?? null;
  const contentLines = [
    'PHASE 8 COLOR',
    `phase: ${DEMO_PHASE}  screen: ${screenState}`,
    `FPS: ${fmt(listStats?.fps ?? NaN, 1)}  pixelRatio: ${fmt(listStats?.rendererPixelRatio ?? NaN, 3)}  cap: ${runtimeConfig.rendererPixelRatioMax}`,
    `imageZoomOpen: ${imageZoomOpen}`,
    `productDetailOpen: ${productDetailOpen}`,
    `selectedCategoryId: ${selectedCategoryId ?? '(none)'}`,
    `selectedCategoryLabel: ${selectedCategoryLabel ?? '(none)'}`,
    `categoryDrawer: ${categoryDrawer}`,
    `drawerOpen: ${drawerOpen}  drawerScrimVisible: ${drawerScrimVisible}`,
    `hamburgerVisible: ${hamburgerVisible}  hamburgerMode: ${hamburgerVisible ? hamburgerMode : '(hidden)'}`,
    `ExploreHost mounted: ${exploreHostMounted}`,
    `listReady: ${listReady}  listWarmup: ${screenState === 'ANIMATION'}`,
    `logo: ${logoStatus == null ? '—' : logoStatus.found ? logoStatus.fileName : 'not found'}`,
    `logo scheme: ${logoStatus?.scheme ?? '—'}`,
    `variant: color (no grayscale shader)`,
    `Explore interaction enabled: ${listStats?.exploreInteractionEnabled ?? !(imageZoomOpen || productDetailOpen || drawerOpen)}`,
    `wheelMode: ${listStats?.wheelMode ?? 'normal'}  lastDollyInput: ${listStats?.lastDollyInput ?? 'none'}`,
    `dollyVelocity: ${fmt(listStats?.dollyVelocity ?? 0, 1)}  pinchActive: ${listStats?.pinchActive ?? false}`,
    `bubbleAllowed: ${listStats?.bubbleAllowed ?? false}  revealActive: ${listStats?.revealActive ?? false}`,
    `imageZoom load: ${imageZoomLoadStatus}`,
    `selectedListImageId: ${selectedListImageId ?? '(none)'}`,
    `selectedInstanceId: ${selectedInstanceId ?? '(none)'}`,
    `selectedSourceImageId: ${selectedSourceImageId ?? '(none)'}`,
    `selectedDisplayIndex: ${selectedDisplayIndex ?? '—'}`,
    `imageUrl: ${trimUrl(selectedImageUrl)}`,
    `relativePath: ${selectedRelativePath ?? '(none)'}`,
    '',
    '— Content / cards —',
    `content load status: ${listStats?.contentLoadStatus ?? 'idle'}`,
    `card generation mode: ${listStats?.cardGenerationMode ?? '—'}`,
    `exploreSource: ${listStats?.exploreSource ?? '—'}`,
    `realImageCount: ${listStats?.realImageCount ?? '—'}`,
    `sourceImageCount: ${listStats?.sourceImageCount ?? '—'}`,
    `displayedImageCount: ${listStats?.displayedImageCount ?? '—'}  (target ${demoConfig.targetCardCount})`,
    `duplicatedCount: ${listStats?.duplicatedCount ?? '—'}`,
    `textureLoadedCount: ${listStats?.textureLoadedCount ?? '—'}`,
    `textureFailedCount: ${listStats?.textureFailedCount ?? '—'}`,
    `first image URL scheme: ${listStats?.firstImageUrlScheme ?? '—'}`,
    `file protocol texture load: ${listStats?.fileProtocolTextureLoadResult ?? 'pending'}`,
    `firstImageUrl: ${trimUrl(listStats?.firstImageUrl)}`,
    `contentRoot: ${listStats?.contentRoot ?? '—'}`,
    listStats?.contentError ? `fallback reason: ${listStats.contentError}` : 'fallback reason: (none)',
  ];

  const restLines = [
    '— Selection —',
    `selectedInstanceId: ${selectedInstanceId ?? '(none)'}`,
    `sourceImageId: ${selectedSourceImageId ?? '(none)'}`,
    `displayIndex: ${selectedDisplayIndex ?? '—'}`,
    `imageUrl: ${trimUrl(selectedImageUrl)}`,
    `relativePath: ${selectedRelativePath ?? '(none)'}`,
    `title: ${selectedTitle ?? '(none)'}`,
    `categoryId: ${selectedCardCategoryId ?? '(none)'}`,
    `chosenImageId: ${listStats?.chosenImageId ?? '(none)'}`,
    `raycastCandidateCount: ${listStats?.raycastCandidateCount ?? 0}`,
    '',
    '— Canvas / Three —',
    `canvas mounted: ${canvasMounted}`,
    canvasMounted
      ? `canvas CSS: ${listStats!.canvasCssWidth} × ${listStats!.canvasCssHeight}`
      : 'canvas CSS size: not mounted',
    canvasMounted
      ? `drawing buffer: ${listStats!.drawingBufferWidth} × ${listStats!.drawingBufferHeight}`
      : 'drawing buffer size: not mounted',
    canvasMounted ? `renderer pixelRatio: ${fmt(listStats!.rendererPixelRatio, 3)} (cap ${runtimeConfig.rendererPixelRatioMax})` : 'renderer pixelRatio: —',
    canvasMounted ? `canvas count: ${listStats!.canvasCount}` : 'canvas count: 0',
    canvasMounted ? `FPS: ${fmt(listStats!.fps, 1)}` : 'FPS: —',
    canvasMounted ? `mesh count: ${listStats!.meshCount}` : 'mesh count: —',
    canvasMounted ? `texture count: ${listStats!.textureCount}` : 'texture count: —',
    '',
    '— Camera / interaction —',
    `camera: ${fmt(listStats?.cameraX ?? NaN)} / ${fmt(listStats?.cameraY ?? NaN)} / ${fmt(listStats?.cameraZ ?? NaN)}`,
    `target: ${fmt(listStats?.targetCameraX ?? NaN)} / ${fmt(listStats?.targetCameraY ?? NaN)} / ${fmt(listStats?.targetCameraZ ?? NaN)}`,
    `cameraZ clamp: ${listStats?.cameraZMin ?? '—'} … ${listStats?.cameraZMax ?? '—'} (Z wrap, not hard stop)`,
    `targetCameraZ at min/max: ${listStats?.targetCameraZAtMin ?? false} / ${listStats?.targetCameraZAtMax ?? false}`,
    `wrapCount: ${listStats?.wrapCount ?? 0}`,
    `card Z range: ${fmt(listStats?.cardZMin ?? NaN, 0)} … ${fmt(listStats?.cardZMax ?? NaN, 0)}`,
    `world: fov=${listStats?.cameraFov ?? '—'} initialZ=${listStats?.initialCameraZ ?? '—'} cardLongSide=${listStats?.cardLongSide ?? '—'} scale=${listStats?.cardScaleMin ?? '—'}…${listStats?.cardScaleMax ?? '—'}`,
    `scene spread: x=${listStats?.sceneSpreadX ?? '—'} y=${listStats?.sceneSpreadY ?? '—'} z=${listStats?.sceneSpreadZ ?? '—'}`,
    `X/Y pan hard clamp: ${listStats?.panHardClamp ?? true}  x ${listStats?.cameraXMin ?? '—'}…${listStats?.cameraXMax ?? '—'}  y ${listStats?.cameraYMin ?? '—'}…${listStats?.cameraYMax ?? '—'}`,
    `pointerType: ${listStats?.pointerType ?? 'none'}`,
    `isDragging: ${listStats?.isDragging ?? false}`,
    `isPinching: ${listStats?.isPinching ?? false}`,
    '',
    '— Dolly cruise —',
    `dollyCruiseEnabled: ${listStats?.dollyCruiseEnabled ?? demoConfig.dollyCruiseEnabled}`,
    `wheelMode: ${listStats?.wheelMode ?? 'normal'}`,
    `shiftWheelActive: ${listStats?.shiftWheelActive ?? false}`,
    `lastDollyInput: ${listStats?.lastDollyInput ?? 'none'}`,
    `inputSource: ${listStats?.lastDollyInput ?? 'none'}`,
    `dollyVelocity: ${fmt(listStats?.dollyVelocity ?? 0, 1)}`,
    `dollyImpulse: ${fmt(listStats?.dollyImpulse ?? 0, 1)}`,
    `dollyImpulseScale: ${fmt(listStats?.dollyImpulseScale ?? demoConfig.cameraDollySpeed, 2)}`,
    `dollySmoothing: ${fmt(listStats?.dollySmoothing ?? NaN, 2)}`,
    `dollyFriction: ${fmt(listStats?.dollyFriction ?? NaN, 2)}`,
    `cameraZ: ${fmt(listStats?.cameraZ ?? NaN)}  targetCameraZ: ${fmt(listStats?.targetCameraZ ?? NaN)}`,
    `wrapCount: ${listStats?.wrapCount ?? 0}`,
    `pinchActive: ${listStats?.pinchActive ?? false}  activePointerCount: ${listStats?.activePointerCount ?? 0}`,
    `pinchDistance: ${fmt(listStats?.pinchDistance ?? 0, 1)}  pinchDelta: ${fmt(listStats?.pinchDelta ?? 0, 1)}`,
    `pinchDollyScale: ${fmt(listStats?.pinchDollyScale ?? demoConfig.pinchDollyScale, 2)}`,
    `tapSuppressedByPinch: ${listStats?.tapSuppressedByPinch ?? false}`,
    '',
    '— Bubble —',
    `bubbleEnabled: ${listStats?.bubbleEnabled ?? demoConfig.bubbleEnabled}`,
    `bubbleVisible: ${listStats?.bubbleVisible ?? false}`,
    `bubbleAllowed: ${listStats?.bubbleAllowed ?? false}`,
    `bubbleSizePx: ${listStats?.bubbleSizePx ?? demoConfig.bubbleSizePx}`,
    `revealRadiusPx: ${listStats?.revealRadiusPx ?? demoConfig.revealRadiusPx}`,
    `bubbleFollowSmoothing: ${listStats?.bubbleFollowSmoothing ?? demoConfig.bubbleFollowSmoothing}`,
    `revealActive: ${listStats?.revealActive ?? false}`,
    `revealCenterNdc: ${fmt(listStats?.revealCenterNdcX ?? NaN, 3)}, ${fmt(listStats?.revealCenterNdcY ?? NaN, 3)}`,
    `bubbleScreen: ${fmt(listStats?.bubbleScreenX ?? NaN, 0)}, ${fmt(listStats?.bubbleScreenY ?? NaN, 0)}`,
    '',
    '— App —',
    `categoryDrawer: ${categoryDrawer}`,
    `selectedCategoryId: ${selectedCategoryId ?? '(none)'}`,
    `selectedCategoryLabel: ${selectedCategoryLabel ?? '(none)'}`,
    `productDetailOpen: ${productDetailOpen}`,
    `drawerOpen: ${drawerOpen}`,
    `drawerScrimVisible: ${drawerScrimVisible}`,
    `hamburgerVisible: ${hamburgerVisible}`,
    `hamburgerMode: ${hamburgerMode}`,
    `reviewMode: ${reviewMode}`,
    `debugHudEnabled: ${debugHudEnabled}`,
    `demoMode: ${demoMode}`,
    `forceSingleMonitor: ${forceSingleMonitor}`,
    `monitorId: ${monitorId ?? '—'} / monitorCount: ${monitorCount ?? '—'}`,
    `window: ${innerWidth} × ${innerHeight}  dpr=${devicePixelRatio}`,
    `uiScale: ${uiScale.toFixed(4)}  (design ${DESIGN_WIDTH}×${DESIGN_HEIGHT})`,
    `G/D: debug · R: review`,
  ];

  return (
    <>
      <pre className="debug-hud debug-hud--content" aria-label="0820 content debug">
        {contentLines.join('\n')}
      </pre>
      <pre className="debug-hud debug-hud--rest" aria-label="0820 debug hud">
        {restLines.join('\n')}
      </pre>
    </>
  );
}
