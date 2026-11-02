import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { serverEnv } from "./env";

/**
 * Startar en separat kopia av produktionsbygget på egen port. Kopian kan ändras (t.ex. simulera ett nytt bygge)
 * och stoppas mitt i ett test så att nätverket verkligen är borta, även för service workern.
 */
export class NextCopy {
  dir = "";
  proc?: ChildProcess;
  constructor(public port: number) {}
  get base() {
    return `http://localhost:${this.port}`;
  }
  async start() {
    const root = process.cwd();
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), "japan-next-"));
    const dist = process.env.NEXT_DIST_DIR || ".next";
    fs.cpSync(path.join(root, dist), path.join(this.dir, dist), { recursive: true, filter: (src) => !/\.next[^\\/]*[\\/](cache|dev)/.test(src) });
    fs.cpSync(path.join(root, "public"), path.join(this.dir, "public"), { recursive: true });
    fs.mkdirSync(path.join(this.dir, "src"), { recursive: true });
    fs.cpSync(path.join(root, "src/content"), path.join(this.dir, "src/content"), { recursive: true });
    for (const f of ["package.json", "next.config.ts"]) fs.copyFileSync(path.join(root, f), path.join(this.dir, f));
    fs.symlinkSync(path.join(root, "node_modules"), path.join(this.dir, "node_modules"), "dir");
    this.proc = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(this.port)], {
      cwd: this.dir,
      env: serverEnv(this.port) as NodeJS.ProcessEnv,
      stdio: "ignore",
      detached: true,
    });
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(`${this.base}/offline.html`);
        if (r.ok) return;
      } catch {
        /* inte uppe än */
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error("Next-servern startade inte");
  }
  kill() {
    if (this.proc?.pid) {
      try {
        process.kill(-this.proc.pid);
      } catch {
        /* redan stoppad */
      }
    }
    this.proc = undefined;
  }
  async stopAndWait() {
    this.kill();
    for (let i = 0; i < 50; i++) {
      const up = await fetch(`${this.base}/offline.html`).then(() => true, () => false);
      if (!up) return;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error("Servern stoppade inte");
  }
  cleanup() {
    this.kill();
    if (this.dir) fs.rmSync(this.dir, { recursive: true, force: true });
  }
}
