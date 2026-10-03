import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3006;
const serverProcess = spawn('node', ['server/index.js'], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'inherit',
});

await new Promise((resolve) => setTimeout(resolve, 1500));

try {
  const { execSync } = await import('node:child_process');
  execSync(`node scripts/test-auth.js`, {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'inherit',
  });
} finally {
  serverProcess.kill();
}
