/** Läser en hemlighet utan att den hamnar i kommandoradshistorik, processlista eller loggar. */
import readline from "node:readline";

export async function readSecret(prompt: string, opts: { fromStdin: boolean; envVar?: string }): Promise<string> {
  if (opts.envVar && process.env[opts.envVar]) {
    const v = process.env[opts.envVar]!;
    delete process.env[opts.envVar];
    return v;
  }
  if (opts.fromStdin || !process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString("utf8").split(/\r?\n/)[0];
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const w = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    process.stdout.write(prompt);
    w._writeToOutput = () => undefined; // ekar inte tecken
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}
