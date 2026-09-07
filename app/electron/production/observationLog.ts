import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export type ObservationRecord = Record<string, unknown>;

let logFilePath: string | null = null;
let sessionStartedAt = 0;
let writeQueue: Promise<void> = Promise.resolve();

function tokyoIso(ms: number): string {
  const d = new Date(ms);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const grab = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const frac = String(ms % 1000).padStart(3, '0');
  return `${grab('year')}-${grab('month')}-${grab('day')}T${grab('hour')}:${grab('minute')}:${grab('second')}.${frac}+09:00`;
}

function tokyoDate(ms: number): string {
  return tokyoIso(ms).slice(0, 10);
}

function nextLogFile(dir: string, day: string): string {
  let n = 1;
  for (;;) {
    const name = `production-observation-${day}-${String(n).padStart(2, '0')}.ndjson`;
    const full = path.join(dir, name);
    if (!fs.existsSync(full)) return full;
    n += 1;
  }
}

export function getObservationLogPath(): string | null {
  return logFilePath;
}

export function startObservationLog(): string {
  sessionStartedAt = Date.now();
  const dir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  logFilePath = nextLogFile(dir, tokyoDate(sessionStartedAt));
  const header: ObservationRecord = {
    timestamp: tokyoIso(sessionStartedAt),
    elapsedMs: 0,
    source: 'main',
    event: 'OBSERVATION_SESSION_START',
    decision: 'INFO',
    appVersion: app.getVersion(),
    logFile: logFilePath,
  };
  fs.writeFileSync(logFilePath, `${JSON.stringify(header)}\n`, 'utf8');
  console.info(`INPUT TRACE LOG:\n${logFilePath}`);
  return logFilePath;
}

export function appendObservation(record: ObservationRecord): void {
  if (!logFilePath) return;
  const now = Date.now();
  const line = JSON.stringify({
    ...record,
    timestamp: tokyoIso(now),
    elapsedMs: now - sessionStartedAt,
  });
  writeQueue = writeQueue.then(
    () =>
      new Promise<void>((resolve) => {
        fs.appendFile(logFilePath!, `${line}\n`, () => resolve());
      }),
  );
}
