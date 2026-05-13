#!/usr/bin/env node

const { spawn } = require('child_process');

const SERVICE_GROUPS = {
  all: [],
  backend: [
    'api-gateway',
    'auth-service',
    'user-service',
    'worker-service',
    'catalog-service',
    'booking-service',
    'payment-service',
    'notification-service',
    'review-service',
    'admin-service',
  ],
  gateway: ['api-gateway'],
  auth: ['auth-service'],
  user: ['user-service'],
  worker: ['worker-service'],
  catalog: ['catalog-service'],
  booking: ['booking-service'],
  payment: ['payment-service'],
  notification: ['notification-service'],
  review: ['review-service'],
  admin: ['admin-service'],
};

const LEVEL_WEIGHT = { debug: 10, info: 20, warn: 30, error: 40 };
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const KNOWN_KEYS = new Set([
  'ts', 'eventId', 'level', 'service', 'requestId', 'request_id',
  'method', 'path', 'query', 'status', 'duration', 'bytes_sent',
  'ip', 'upstream', 'user_agent', 'fn', 'tag', 'userId', 'role',
  'action', 'msg', 'message', 'event', 'stack',
]);

const args = process.argv.slice(2);
const options = {
  service: 'all',
  level: 'debug',
  grep: '',
  raw: false,
  follow: true,
  tail: '100',
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  }
  if (arg === '--raw') {
    options.raw = true;
  } else if (arg === '--no-follow') {
    options.follow = false;
  } else if (arg === '--level') {
    options.level = args[++i] || options.level;
  } else if (arg === '--grep') {
    options.grep = args[++i] || '';
  } else if (arg === '--tail') {
    options.tail = args[++i] || options.tail;
  } else if (!arg.startsWith('--')) {
    options.service = arg;
  }
}

if (!LEVEL_WEIGHT[options.level]) {
  console.error(`Unknown level "${options.level}". Use debug, info, warn, or error.`);
  process.exit(1);
}

if (!Object.prototype.hasOwnProperty.call(SERVICE_GROUPS, options.service)) {
  console.error(`Unknown service/group "${options.service}".`);
  printHelp();
  process.exit(1);
}

const composeArgs = [
  'compose',
  'logs',
  ...(options.follow ? ['--follow'] : []),
  '--tail',
  options.tail,
  '--no-log-prefix',
  ...SERVICE_GROUPS[options.service],
];

const docker = spawn('docker', composeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
let stdoutBuffer = '';
let stderrBuffer = '';

docker.stdout.on('data', (chunk) => {
  stdoutBuffer = flushLines(stdoutBuffer + chunk.toString(), false);
});

docker.stderr.on('data', (chunk) => {
  stderrBuffer = flushLines(stderrBuffer + chunk.toString(), true);
});

docker.on('exit', (code) => {
  if (stdoutBuffer.trim()) printLine(stdoutBuffer, false);
  if (stderrBuffer.trim()) printLine(stderrBuffer, true);
  process.exit(code || 0);
});

function flushLines(buffer, isError) {
  const lines = buffer.split(/\r?\n/);
  const rest = lines.pop() || '';
  for (const line of lines) printLine(line, isError);
  return rest;
}

function printLine(line, isError) {
  if (!line.trim()) return;

  const parsed = parseJson(line);
  if (parsed) {
    const level = normalizeLevel(parsed.level || (isError ? 'error' : 'info'));
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[options.level]) return;

    const pretty = options.raw ? JSON.stringify(parsed) : formatJsonLog(parsed, level);
    if (matchesGrep(pretty, parsed)) console.log(pretty);
    return;
  }

  if (options.level !== 'debug' && !isError) return;
  if (matchesGrep(line)) console.log(isError ? `${COLORS.error}${line}${COLORS.reset}` : line);
}

function parseJson(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function formatJsonLog(entry, level) {
  const color = process.env.NO_COLOR ? '' : COLORS[level] || '';
  const reset = process.env.NO_COLOR ? '' : COLORS.reset;
  const dim = process.env.NO_COLOR ? '' : COLORS.dim;

  const ts = formatTime(entry.ts);
  const service = pad(String(entry.service || 'unknown'), 20);
  const requestId = entry.requestId || entry.request_id;
  const request = requestId ? ` req=${requestId}` : '';
  const event = entry.eventId ? ` event=${short(entry.eventId)}` : '';
  const label = entry.tag || entry.action || entry.fn || entry.event || 'log';
  const route = entry.method && entry.path ? ` ${entry.method} ${entry.path}` : '';
  const status = entry.status ? ` status=${entry.status}` : '';
  const message = entry.msg || entry.message || entry.event || '';
  const extra = extraJson(entry);
  const stack = entry.stack ? `\n${dim}${entry.stack}${reset}` : '';

  return `${color}[${ts}] ${pad(level.toUpperCase(), 5)} ${service}${request}${event} ${label}${route}${status} - ${message}${extra}${reset}${stack}`;
}

function extraJson(entry) {
  const extra = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!KNOWN_KEYS.has(key)) extra[key] = value;
  }
  return Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
}

function matchesGrep(text, parsed) {
  if (!options.grep) return true;
  const haystack = parsed ? `${text} ${JSON.stringify(parsed)}` : text;
  return haystack.toLowerCase().includes(options.grep.toLowerCase());
}

function normalizeLevel(level) {
  const value = String(level).toLowerCase();
  return LEVEL_WEIGHT[value] ? value : 'info';
}

function formatTime(ts) {
  const date = ts ? new Date(ts) : new Date();
  if (Number.isNaN(date.getTime())) return String(ts);
  return date.toISOString().slice(11, 19);
}

function short(value) {
  return String(value).slice(0, 8);
}

function pad(value, size) {
  return value.length >= size ? value : value + ' '.repeat(size - value.length);
}

function printHelp() {
  console.log(`Usage:
  node scripts/logs.js <service|group> [--level debug|info|warn|error] [--grep text] [--tail n] [--raw] [--no-follow]

Groups:
  all, backend

Services:
  gateway, auth, user, worker, catalog, booking, payment, notification, review, admin

Examples:
  npm run logs:booking
  npm run logs:errors
  npm run logs:backend -- --grep bookingService_createBooking
  npm run logs:backend -- --grep <requestId>
`);
}
