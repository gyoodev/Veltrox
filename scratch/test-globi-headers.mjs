async function run() {
  const res = await fetch('https://globi.bg/tools/motor-insurance', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  for (const [k, v] of res.headers.entries()) {
    console.log(`${k}: ${v}`);
  }
}
run();
