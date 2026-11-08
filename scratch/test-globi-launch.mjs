async function run() {
  const urls = [
    'https://globi.bg/tools/launch/insurance',
    'https://globi.bg/tools/launch/motor-insurance'
  ];
  for (const url of urls) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    console.log(url, res.status);
  }
}
run();
