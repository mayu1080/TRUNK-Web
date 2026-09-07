'use strict';

/**
 * Summarize a Phase 1.6 production observation NDJSON file.
 * Usage (from app/):
 *   node scripts/summarize-observation-log.js <path-to.ndjson> [out-summary.json]
 */

const fs = require('node:fs');
const path = require('node:path');

const DROP_REASONS = [
  'DROP_DUPLICATE_POINTERDOWN',
  'DROP_SESSION_MISMATCH',
  'DROP_STALE_START',
  'DROP_NOT_BELONG_TO_WINDOW',
  'DROP_INTERACTION_LOCK',
  'DROP_NATIVE_TOUCH_COUNT',
  'DROP_MULTI_TOUCH_BLOCKED',
  'DROP_TWO_FINGER_SESSION',
];

const MONITORS = [1, 2, 3, 4];
const CROSS_WINDOW_MS = 250;
const FOCUS_DROP_MS = 500;
const CLICK_WINDOW_MS = 1500;
const UI_TARGET_RE = /hamburger|category-drawer|drawer|image-zoom|zoom/i;

function emptyCounts() {
  return { all: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
}

function bump(map, monitorId) {
  map.all += 1;
  if (monitorId >= 1 && monitorId <= 4) map[monitorId] += 1;
}

function hourKey(timestamp) {
  if (typeof timestamp !== 'string' || timestamp.length < 13) return 'unknown';
  return timestamp.slice(0, 13);
}

function readLines(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      rows.push({ parseError: true, raw: line.slice(0, 200) });
    }
  }
  return rows;
}

function summarize(rows) {
  const events = {
    pointerdown: emptyCounts(),
    pointerup: emptyCounts(),
    touchstart: emptyCounts(),
    mousedown: emptyCounts(),
    click: emptyCounts(),
  };
  const byEvent = {};
  const drops = {};
  for (const reason of DROP_REASONS) drops[reason] = emptyCounts();
  const otherDrops = {};

  const timed = [];

  const pointerDowns = [];
  const clicks = [];
  const captures = [];
  const mismatches = [];
  const focusLike = [];
  const ads = {
    AD_START_COMMAND: [],
    VIDEO_PLAY_CALLED: [],
    VIDEO_PLAY_RESOLVED: [],
    VIDEO_PLAYING: [],
    VIDEO_FIRST_FRAME: [],
  };

  let parseErrors = 0;

  for (const row of rows) {
    if (row.parseError) {
      parseErrors += 1;
      continue;
    }
    const event = String(row.event ?? '');
    const decision = String(row.decision ?? '');
    const monitorId = Number(row.monitorId);
    byEvent[event] = (byEvent[event] || 0) + 1;

    if (event === 'pointerdown') bump(events.pointerdown, monitorId);
    if (event === 'pointerup') bump(events.pointerup, monitorId);
    if (event === 'touchstart') bump(events.touchstart, monitorId);
    if (event === 'mousedown') bump(events.mousedown, monitorId);
    if (event === 'click') bump(events.click, monitorId);

    if (decision.startsWith('DROP_')) {
      if (!drops[decision]) {
        otherDrops[decision] = otherDrops[decision] || emptyCounts();
        bump(otherDrops[decision], monitorId);
      } else {
        bump(drops[decision], monitorId);
      }
    }

    if (event === 'pointerdown') pointerDowns.push(row);
    if (event === 'click') clicks.push(row);
    if (event === 'gotpointercapture' || event === 'lostpointercapture') captures.push(row);
    if (decision === 'DROP_SESSION_MISMATCH' || decision === 'DROP_STALE_START') {
      mismatches.push(row);
    }
    if (event === 'focus' || event === 'blur' || event === 'moveTop') focusLike.push(row);
    if (ads[event]) ads[event].push(row);

    const nTouch = row.nativeTouchCount;
    const nPtr = row.activeTouchPointerCount;
    row._mismatchTouch = Number.isFinite(nTouch) && Number.isFinite(nPtr) && nTouch !== nPtr;
    const t = Date.parse(row.timestamp);
    if (Number.isFinite(t)) timed.push({ ...row, _t: t });
  }

  timed.sort((a, b) => a._t - b._t);

  const crossMonitor = [];
  for (let i = 0; i < timed.length; i += 1) {
    const a = timed[i];
    if (a.event !== 'pointerdown' && a.event !== 'touchstart') continue;
    if (a.monitorId == null) continue;
    for (let j = i + 1; j < timed.length; j += 1) {
      const b = timed[j];
      if (b._t - a._t > CROSS_WINDOW_MS) break;
      if (b.monitorId == null || b.monitorId === a.monitorId) continue;
      if (b.event === 'pointerdown' || b.event === 'touchstart' || String(b.decision || '').startsWith('DROP_')) {
        crossMonitor.push({
          first: { timestamp: a.timestamp, monitorId: a.monitorId, event: a.event, pointerId: a.pointerId },
          other: {
            timestamp: b.timestamp,
            monitorId: b.monitorId,
            event: b.event,
            decision: b.decision,
            reason: b.reason ?? null,
            pointerId: b.pointerId,
          },
          deltaMs: b._t - a._t,
        });
        if (crossMonitor.length >= 200) break;
      }
    }
    if (crossMonitor.length >= 200) break;
  }

  const nativeMismatch = rows
    .filter((row) => row._mismatchTouch)
    .slice(0, 200)
    .map((row) => ({
      timestamp: row.timestamp,
      monitorId: row.monitorId,
      event: row.event,
      nativeTouchCount: row.nativeTouchCount,
      activeTouchPointerCount: row.activeTouchPointerCount,
      activePointerCount: row.activePointerCount,
      gestureMode: row.gestureMode ?? null,
    }));

  const clickMissing = [];
  for (const down of pointerDowns) {
    const target = String(down.target ?? '');
    if (!UI_TARGET_RE.test(target)) continue;
    const t = Date.parse(down.timestamp);
    if (!Number.isFinite(t)) continue;
    const gotClick = clicks.some((click) => {
      const tc = Date.parse(click.timestamp);
      return (
        Number.isFinite(tc) &&
        tc >= t &&
        tc - t <= CLICK_WINDOW_MS &&
        click.monitorId === down.monitorId &&
        String(click.target ?? '').slice(0, 40) === target.slice(0, 40)
      );
    });
    if (!gotClick) {
      clickMissing.push({
        timestamp: down.timestamp,
        monitorId: down.monitorId,
        target,
        pointerId: down.pointerId,
        pointerType: down.pointerType,
      });
    }
  }

  const capturePairs = [];
  const got = captures.filter((row) => row.event === 'gotpointercapture');
  const lost = captures.filter((row) => row.event === 'lostpointercapture');
  for (const g of got) {
    const match = lost.find(
      (l) =>
        l.monitorId === g.monitorId &&
        l.pointerId === g.pointerId &&
        Date.parse(l.timestamp) >= Date.parse(g.timestamp),
    );
    if (!match) {
      capturePairs.push({ kind: 'got-without-lost', timestamp: g.timestamp, monitorId: g.monitorId, pointerId: g.pointerId });
    }
  }
  for (const l of lost) {
    const match = got.find(
      (g) =>
        g.monitorId === l.monitorId &&
        g.pointerId === l.pointerId &&
        Date.parse(g.timestamp) <= Date.parse(l.timestamp),
    );
    if (!match) {
      capturePairs.push({ kind: 'lost-without-got', timestamp: l.timestamp, monitorId: l.monitorId, pointerId: l.pointerId });
    }
  }

  const mismatchByHour = {};
  for (const row of mismatches) {
    const key = hourKey(row.timestamp);
    mismatchByHour[key] = mismatchByHour[key] || emptyCounts();
    bump(mismatchByHour[key], Number(row.monitorId));
  }

  const dropsAfterFocus = [];
  for (let i = 0; i < timed.length; i += 1) {
    const focus = timed[i];
    if (focus.event !== 'focus' && focus.event !== 'blur' && focus.event !== 'moveTop') continue;
    let dropCount = 0;
    for (let j = i; j < timed.length; j += 1) {
      if (timed[j]._t - focus._t > FOCUS_DROP_MS) break;
      if (String(timed[j].decision || '').startsWith('DROP_')) dropCount += 1;
    }
    if (dropCount > 0) {
      dropsAfterFocus.push({
        timestamp: focus.timestamp,
        event: focus.event,
        monitorId: focus.monitorId,
        windowId: focus.windowId,
        dropsWithinMs: dropCount,
      });
      if (dropsAfterFocus.length >= 200) break;
    }
  }

  const adByMonitor = {};
  for (const monitorId of MONITORS) {
    const pick = (event) =>
      ads[event]
        .filter((row) => row.monitorId === monitorId)
        .map((row) => ({
          timestamp: row.timestamp,
          elapsedMs: row.elapsedMs ?? null,
          sessionId: row.sessionId ?? null,
          contentId: row.contentId ?? null,
          currentTime: row.currentTime ?? null,
          source: row.source ?? null,
          reason: row.reason ?? null,
        }));
    adByMonitor[monitorId] = {
      AD_START_COMMAND: pick('AD_START_COMMAND'),
      VIDEO_PLAY_CALLED: pick('VIDEO_PLAY_CALLED'),
      VIDEO_PLAY_RESOLVED: pick('VIDEO_PLAY_RESOLVED'),
      VIDEO_PLAYING: pick('VIDEO_PLAYING'),
      VIDEO_FIRST_FRAME: pick('VIDEO_FIRST_FRAME'),
    };
  }

  function maxSpread(eventName, field) {
    const firsts = MONITORS.map((id) => adByMonitor[id][eventName][0]).filter(Boolean);
    const times = firsts
      .map((row) => (field === 'elapsed' ? Number(row.elapsedMs) : Date.parse(row.timestamp)))
      .filter((n) => Number.isFinite(n));
    if (times.length < 2) return null;
    return Math.max(...times) - Math.min(...times);
  }

  return {
    generatedAt: new Date().toISOString(),
    parseErrors,
    totalRows: rows.length,
    eventCounts: {
      pointerdown: events.pointerdown,
      pointerup: events.pointerup,
      touchstart: events.touchstart,
      mousedown: events.mousedown,
      click: events.click,
      allEvents: byEvent,
    },
    dropCounts: { ...drops, other: otherDrops },
    anomalies: {
      A_crossMonitorAfterTouch: crossMonitor.slice(0, 200),
      B_nativeTouchCountMismatch: nativeMismatch,
      C_pointerDownWithoutClick: clickMissing.slice(0, 200),
      D_captureMismatch: capturePairs.slice(0, 200),
      E_sessionMismatchByHour: mismatchByHour,
      F_dropsAfterFocusBlurMoveTop: dropsAfterFocus.slice(0, 200),
    },
    ads: {
      byMonitor: adByMonitor,
      maxSpreadMs: {
        AD_START_COMMAND: maxSpread('AD_START_COMMAND', 'time'),
        VIDEO_PLAY_CALLED: maxSpread('VIDEO_PLAY_CALLED', 'time'),
        VIDEO_PLAYING: maxSpread('VIDEO_PLAYING', 'time'),
        VIDEO_FIRST_FRAME: maxSpread('VIDEO_FIRST_FRAME', 'time'),
      },
    },
  };
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node scripts/summarize-observation-log.js <production-observation-YYYY-MM-DD-NN.ndjson> [out.json]');
    process.exit(1);
  }
  const abs = path.resolve(input);
  const rows = readLines(abs);
  const summary = summarize(rows);
  summary.sourceFile = abs;
  const out =
    process.argv[3] ||
    path.join(path.dirname(abs), path.basename(abs, path.extname(abs)) + '-summary.json');
  fs.writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.info('wrote', out);
  console.info(JSON.stringify({
    eventCounts: summary.eventCounts,
    dropCounts: Object.fromEntries(
      Object.entries(summary.dropCounts).filter(([key]) => key !== 'other').map(([key, value]) => [key, value.all]),
    ),
    adsMaxSpreadMs: summary.ads.maxSpreadMs,
    anomalyCounts: {
      A: summary.anomalies.A_crossMonitorAfterTouch.length,
      B: summary.anomalies.B_nativeTouchCountMismatch.length,
      C: summary.anomalies.C_pointerDownWithoutClick.length,
      D: summary.anomalies.D_captureMismatch.length,
      F: summary.anomalies.F_dropsAfterFocusBlurMoveTop.length,
    },
  }, null, 2));
}

main();
