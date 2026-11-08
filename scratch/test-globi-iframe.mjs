async function run() {
  const res = await fetch('https://globi.bg/tools/motor-insurance', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  console.log('x-frame-options:', res.headers.get('x-frame-options'));
  console.log('content-security-policy:', res.headers.get('content-security-policy'));
}
run();
