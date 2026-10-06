/**
 * File-backed store for SharedState. All VS Code windows point at the same file
 * (the extension's global storage folder), and writes take a lock file so two
 * windows can't overwrite each other's changes. No `vscode` dependency.
 */
import * as fs from 'fs';
import * as path from 'path';
import { initialState, parseState, SharedState } from './sharedState';

const LOCK_WAIT_MS = 2000;
const LOCK_STALE_MS = 3000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const sleepSync = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const codeOf = (err: unknown) => (err as NodeJS.ErrnoException | undefined)?.code;

export class SharedStore {
  readonly file: string;
  private readonly lockFile: string;
  private cache: SharedState;

  constructor(dir: string, private readonly now: () => number = Date.now) {
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'shared-state.json');
    this.lockFile = `${this.file}.lock`;
    this.cache = initialState(now());
  }

  exists(): boolean {
    return fs.existsSync(this.file);
  }

  /** Latest state on disk. A missing or half-written file falls back to the last good read. */
  read(): SharedState {
    try {
      this.cache = parseState(JSON.parse(fs.readFileSync(this.file, 'utf8')), this.now());
    } catch {
      // keep cache
    }
    return this.cache;
  }

  /** Read-modify-write under the lock. `fn` returns its input unchanged to skip the write. */
  async update(fn: (s: SharedState) => SharedState): Promise<SharedState> {
    const locked = await this.acquireLock();
    try {
      const current = this.read();
      const next = fn(current);
      if (next !== current) {
        const out = { ...next, rev: current.rev + 1 };
        this.write(out);
        this.cache = out;
      }
      return this.cache;
    } finally {
      if (locked) {
        try {
          fs.unlinkSync(this.lockFile);
        } catch {
          // already gone
        }
      }
    }
  }

  private async acquireLock(): Promise<boolean> {
    const deadline = Date.now() + LOCK_WAIT_MS;
    for (;;) {
      try {
        fs.closeSync(fs.openSync(this.lockFile, 'wx'));
        return true;
      } catch (err) {
        if (codeOf(err) !== 'EEXIST') {
          return false; // can't lock (e.g. permissions); write anyway
        }
      }
      try {
        // A window that crashed mid-write leaves a lock behind; break it.
        if (Date.now() - fs.statSync(this.lockFile).mtimeMs > LOCK_STALE_MS) {
          fs.unlinkSync(this.lockFile);
        }
      } catch {
        // lock vanished between calls, or couldn't be removed; retry below
      }
      // Always yield and respect the deadline, so a stuck lock can never freeze the window.
      if (Date.now() > deadline) {
        return false;
      }
      await sleep(10 + Math.random() * 20);
    }
  }

  /** Write to a temp file and rename, so readers never see a partial file. */
  private write(s: SharedState): void {
    const data = JSON.stringify(s);
    const tmp = `${this.file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    fs.writeFileSync(tmp, data);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.renameSync(tmp, this.file);
        return;
      } catch (err) {
        // Windows refuses the rename while another window is reading the file.
        if (codeOf(err) !== 'EPERM' && codeOf(err) !== 'EBUSY' && codeOf(err) !== 'EACCES') {
          break;
        }
        sleepSync(10);
      }
    }
    fs.writeFileSync(this.file, data);
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
}
