import type { GlobalScene, VideoSessionInfo, VideoTrackInfo } from '../../shared/productionState';
import { appendObservation } from './observationLog';
import type { VideoPlaylist } from './videoPlaylist';

export class VideoSyncController {
  private sessionId = 0;
  private scene: VideoSessionInfo['scene'] = 'none';
  private startedAtMs = 0;
  private completeTimer: ReturnType<typeof setTimeout> | null = null;
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly ads: VideoPlaylist,
    private readonly animation: VideoPlaylist,
    private readonly onAnimationFinished: () => void,
    private readonly log: (message: string, context?: Record<string, unknown>) => void,
  ) {}

  onScene(scene: GlobalScene): void {
    this.clearTimers();
    if (scene === 'PRODUCT_LIST') {
      this.scene = 'none';
      this.log('video stop (PRODUCT_LIST)');
      return;
    }
    if (scene === 'AD_IDLE') {
      this.start('AD_IDLE', this.ads);
      return;
    }
    this.start('ANIMATION', this.animation);
  }

  sessionFor(monitorId: number): VideoSessionInfo {
    const playlist = this.scene === 'AD_IDLE' ? this.ads : this.scene === 'ANIMATION' ? this.animation : null;
    const track = playlist?.tracks.find((t) => t.monitorId === monitorId) ?? missingTrack(monitorId);
    return {
      scene: this.scene,
      contentId: playlist?.contentId ?? 'none',
      sessionId: this.sessionId,
      startedAtMs: this.startedAtMs,
      durationMs: playlist?.durationMs ?? 0,
      loop: playlist?.loop ?? false,
      skipOnTouch: false,
      track,
    };
  }

  dumpSummary(): Omit<VideoSessionInfo, 'track'> & { tracksFound: number } {
    const playlist = this.scene === 'AD_IDLE' ? this.ads : this.scene === 'ANIMATION' ? this.animation : null;
    return {
      scene: this.scene,
      contentId: playlist?.contentId ?? 'none',
      sessionId: this.sessionId,
      startedAtMs: this.startedAtMs,
      durationMs: playlist?.durationMs ?? 0,
      loop: playlist?.loop ?? false,
      skipOnTouch: false,
      tracksFound: playlist?.tracks.filter((t) => t.found).length ?? 0,
    };
  }

  destroy(): void {
    this.clearTimers();
  }

  private start(scene: 'AD_IDLE' | 'ANIMATION', playlist: VideoPlaylist): void {
    this.sessionId += 1;
    this.scene = scene;
    this.startedAtMs = Date.now();
    this.log('video session start', {
      scene,
      sessionId: this.sessionId,
      contentId: playlist.contentId,
      durationMs: playlist.durationMs,
      loop: playlist.loop,
      tracksFound: playlist.tracks.filter((t) => t.found).length,
    });
    if (scene === 'AD_IDLE') {
      appendObservation({
        source: 'main',
        event: 'AD_START_COMMAND',
        decision: 'INFO',
        scene,
        sessionId: this.sessionId,
        contentId: playlist.contentId,
        startedAtMs: this.startedAtMs,
        durationMs: playlist.durationMs,
        loop: playlist.loop,
        tracksFound: playlist.tracks.filter((t) => t.found).length,
      });
      for (const track of playlist.tracks) {
        appendObservation({
          source: 'main',
          event: 'AD_START_COMMAND',
          decision: 'INFO',
          reason: 'per-monitor',
          scene,
          monitorId: track.monitorId,
          contentId: playlist.contentId,
          sessionId: this.sessionId,
          currentTime: 0,
          relativePath: track.relativePath,
          found: track.found,
        });
      }
    }
    if (scene !== 'ANIMATION') return;
    const waitForMediaEnded =
      playlist.endPolicy === 'media-ended' && playlist.tracks.some((track) => track.found);
    if (!waitForMediaEnded) {
      this.completeTimer = setTimeout(() => {
        this.clearTimers();
        this.log('animation duration reached', { sessionId: this.sessionId, durationMs: playlist.durationMs });
        this.onAnimationFinished();
      }, playlist.durationMs);
    } else {
      this.log('animation waits for media ended', {
        sessionId: this.sessionId,
        durationMs: playlist.durationMs,
        safetyCapMs: playlist.safetyCapMs,
      });
    }
    this.safetyTimer = setTimeout(() => {
      this.clearTimers();
      this.log('animation safety cap', { sessionId: this.sessionId, safetyCapMs: playlist.safetyCapMs });
      this.onAnimationFinished();
    }, Math.max(playlist.safetyCapMs, playlist.durationMs + 1));
  }

  private clearTimers(): void {
    if (this.completeTimer != null) {
      clearTimeout(this.completeTimer);
      this.completeTimer = null;
    }
    if (this.safetyTimer != null) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
  }
}

function missingTrack(monitorId: number): VideoTrackInfo {
  return {
    monitorId,
    relativePath: '',
    url: null,
    found: false,
  };
}
