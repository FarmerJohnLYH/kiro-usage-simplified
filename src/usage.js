const { execFile } = require('node:child_process');
const { homedir } = require('node:os');
const path = require('node:path');
const { promisify, stripVTControlCharacters } = require('node:util');

const execute = promisify(execFile);
const CLI_ARGS = Object.freeze(['chat', '--no-interactive', '/usage', '--v2']);
const MAX_BUFFER = 1024 * 1024;
const ERRORS = {
  missing: ['CLI not found', 'Install Kiro CLI on the extension host, or set Kiro Usage: CLI Path to its executable. Restart VS Code after changing PATH.'],
  permission: ['CLI not executable', 'Check the executable path and file permissions. Windows requires an executable (.exe), not a .cmd, .bat or .ps1 wrapper.'],
  auth: ['Sign-in required', 'Authenticate Kiro CLI on the extension host, then click to refresh. Check the CLI authentication documentation for your version.'],
  timeout: ['Request timed out', 'Check your network and CLI, or increase Kiro Usage: Timeout Seconds.'],
  format: ['Unsupported usage output', 'The CLI returned no supported Credits line. Run the documented usage command manually and check CLI compatibility.'],
  incompatible: ['Incompatible CLI', 'This extension requires the chat --no-interactive /usage --v2 command. Check your Kiro CLI version.'],
  output: ['CLI output too large', 'The CLI exceeded the 1 MiB output limit. Run the usage command manually to investigate.'],
  failed: ['Refresh failed', 'Run the usage command manually to check authentication, network access and CLI health.'],
  cancelled: ['Refresh cancelled', 'The request was cancelled.'],
  config: ['Invalid CLI path', 'Use an executable name on PATH or an absolute executable path, without quotes, arguments or shell commands.'],
};

class UsageError extends Error {
  constructor(code) {
    super(ERRORS[code][1]);
    this.name = 'UsageError';
    this.code = code;
    this.label = ERRORS[code][0];
  }
}

function plainText(value) {
  return stripVTControlCharacters(String(value ?? '')).replace(/\r\n?/g, '\n');
}

function number(value) {
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) throw new UsageError('format');
  const parsed = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(parsed) || parsed > Number.MAX_SAFE_INTEGER) throw new UsageError('format');
  return parsed;
}

function parseUsage(output) {
  const text = plainText(output);
  const matches = [...text.matchAll(/(?:^|\n)[ \t]*Credits\s*\(([^()\n]+?)\s+of\s+([^()\n]+?)\s+covered in plan\)/gi)];
  if (matches.length !== 1) throw new UsageError('format');
  const match = matches[0];
  const used = number(match[1]);
  const total = number(match[2]);
  const lines = text.slice(match.index + match[0].length).split('\n');
  const progress = lines[0].trim() || lines.slice(1).find(line => line.trim()) || '';
  const percentMatch = progress.match(/^[\s,|\[\]█▓▒░━─■□#=]*([^\s%]+)\s*%/u);
  let percent = total === 0 ? null : Math.round((used / total) * 10000) / 100;
  if (percentMatch) {
    const reported = number(percentMatch[1]);
    if (total !== 0) percent = reported;
  }
  if (percent !== null && (!Number.isFinite(percent) || percent > Number.MAX_SAFE_INTEGER)) throw new UsageError('format');
  return { used, total, percent };
}

function classifyError(error) {
  if (error instanceof UsageError) return error;
  if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') return new UsageError('cancelled');
  if (error?.code === 'ENOENT') return new UsageError('missing');
  if (['EACCES', 'EPERM', 'ENOEXEC', 'EINVAL'].includes(error?.code)) return new UsageError('permission');
  if (error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return new UsageError('output');
  if (error?.killed || error?.code === 'ETIMEDOUT') return new UsageError('timeout');
  const detail = plainText(`${error?.stderr ?? ''}\n${error?.stdout ?? ''}`);
  if (/(?:not (?:logged|signed) in|unauthenticated|unauthorized|authentication (?:failed|required)|(?:token|credentials?) (?:has |have |is |are )?(?:expired|invalid)|(?:please|must|need to) (?:log|sign)[ -]?in|kiro-cli login|KIRO_API_KEY.*(?:required|missing|not set))/i.test(detail)) return new UsageError('auth');
  if (/(?:unexpected|unknown|unrecognized|invalid) (?:argument|option|flag)/i.test(detail)) return new UsageError('incompatible');
  return new UsageError('failed');
}

function normalizeSettings(values = {}) {
  const interval = values.refreshIntervalSeconds;
  const timeout = values.timeoutSeconds;
  return {
    cliPath: typeof values.cliPath === 'string' && values.cliPath.trim() ? values.cliPath.trim() : 'kiro-cli',
    refreshIntervalSeconds: Number.isFinite(interval) && interval >= 0 ? (interval === 0 ? 0 : Math.min(86400, Math.max(5, Math.floor(interval)))) : 60,
    timeoutSeconds: Number.isFinite(timeout) ? Math.min(120, Math.max(5, Math.floor(timeout))) : 30,
  };
}

function executablePath(value, platform = process.platform) {
  let executable = value;
  if (value.startsWith('~/') || value.startsWith('~\\')) executable = path.join(homedir(), value.slice(2));
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  if (!executable || /[\r\n\0"]/.test(executable) || (!pathApi.isAbsolute(executable) && /[\\/\s]/.test(executable))) throw new UsageError('config');
  if (platform === 'win32' && /\.(?:cmd|bat|ps1)$/i.test(executable)) throw new UsageError('permission');
  return executable;
}

async function fetchUsage(settings, signal, run = execute) {
  try {
    const executable = executablePath(settings.cliPath);
    const running = run(executable, [...CLI_ARGS], {
      timeout: settings.timeoutSeconds * 1000, maxBuffer: MAX_BUFFER,
      windowsHide: true, shell: false, cwd: homedir(),
      env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
      encoding: 'utf8', signal,
    });
    running.child?.stdin?.end();
    const { stdout, stderr } = await running;
    try {
      return parseUsage(stdout);
    } catch (error) {
      const classified = classifyError({ stdout, stderr });
      throw classified.code === 'failed' ? error : classified;
    }
  } catch (error) {
    throw classifyError(error);
  }
}

function formatUsage({ used, total, percent }) {
  return `${used}/${total} · ${percent === null ? 'n/a' : `${percent}%`}`;
}

function severity(percent) {
  return percent === null ? 'unknown' : percent > 90 ? 'high' : percent >= 60 ? 'medium' : 'low';
}

module.exports = { CLI_ARGS, MAX_BUFFER, UsageError, parseUsage, classifyError, normalizeSettings, executablePath, fetchUsage, formatUsage, severity };
