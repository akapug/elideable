import { spawn } from 'node:child_process';

export function streamAppArchive(res, appDir, appId) {
  // Prefer "zip" CLI if available, else fallback to tar.gz
  const checkZip = spawn('bash', ['-lc', 'command -v zip >/dev/null 2>&1; echo $?']);
  let codeStr = '';
  checkZip.stdout.on('data', (d) => { codeStr += d.toString(); });
  checkZip.on('close', () => {
    const hasZip = codeStr.trim() === '0';
    if (hasZip) {
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="app-${appId}.zip"`
      });
      const z = spawn('bash', ['-lc', 'zip -r - .'], { cwd: appDir });
      z.stdout.pipe(res);
      z.stderr.on('data', (d) => process.stderr.write(`[export-zip] ${d}`));
      z.on('close', () => res.end());
    } else {
      res.writeHead(200, {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="app-${appId}.tar.gz"`
      });
      const t = spawn('bash', ['-lc', 'tar -czf - .'], { cwd: appDir });
      t.stdout.pipe(res);
      t.stderr.on('data', (d) => process.stderr.write(`[export-tar] ${d}`));
      t.on('close', () => res.end());
    }
  });
}

