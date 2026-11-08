async function run() {
  const res = await fetch('https://globi.bg/tools/motor-insurance', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();
  const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  console.log('--- Script 15 ---');
  console.log(scriptMatches[15][1]);
  console.log('--- Script 16 ---');
  console.log(scriptMatches[16][1]);
}
run();
