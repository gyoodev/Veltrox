async function run() {
  const res = await fetch('https://globi.bg/tools/motor-insurance', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();
  const searchMatches = [...html.matchAll(/location\.search|URLSearchParams|searchParams|query/gi)];
  console.log('Matches:', searchMatches.length);
  for (const m of searchMatches) {
    const idx = m.index;
    console.log(html.slice(Math.max(0, idx - 50), Math.min(html.length, idx + 100)));
  }
}
run();
