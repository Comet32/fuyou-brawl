// Measure how the deployed site loads from mainland China carrier networks
// using Globalping probes (https://globalping.io, no auth needed).
// Usage: npx tsx scripts/check-china.ts [url]
const target = new URL(process.argv[2] ?? 'https://comet32.github.io/fuyou-brawl/');
const API = 'https://api.globalping.io/v1/measurements';

interface ProbeResult {
  probe: { city?: string; network?: string };
  result: { status: string; statusCode?: number; timings?: { total?: number }; rawOutput?: string };
}

const body = {
  type: 'http',
  target: target.hostname,
  locations: [
    { magic: 'China Mobile', limit: 3 },
    { magic: 'China Telecom', limit: 3 },
    { magic: 'China Unicom', limit: 3 },
  ],
  measurementOptions: {
    protocol: target.protocol === 'https:' ? 'HTTPS' : 'HTTP',
    request: { path: target.pathname + target.search, method: 'GET' },
  },
};

const created = await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(30_000),
});
if (!created.ok) throw new Error(`Globalping HTTP ${created.status}: ${await created.text()}`);
const { id } = (await created.json()) as { id: string };

let results: ProbeResult[] = [];
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const res = await fetch(`${API}/${id}`, { signal: AbortSignal.timeout(30_000) });
  const data = (await res.json()) as { status: string; results: ProbeResult[] };
  results = data.results;
  if (data.status === 'finished') break;
}

console.log(`${target.href} from ${results.length} China probes:`);
let ok = 0;
for (const { probe, result } of results) {
  const where = `${probe.city ?? '?'} · ${(probe.network ?? '').slice(0, 28)}`.padEnd(42);
  if (result.status === 'finished' && result.statusCode && result.statusCode < 400) {
    ok++;
    console.log(`  ✓ ${where} ${result.statusCode}  ${result.timings?.total ?? '?'} ms`);
  } else {
    const why = result.statusCode ?? (result.rawOutput ?? result.status).split('\n')[0].slice(0, 60);
    console.log(`  ✗ ${where} ${why}`);
  }
}
console.log(`${ok}/${results.length} succeeded`);
if (ok === 0) process.exit(1);

// Top-level await needs module scope for the type checker.
export {};
