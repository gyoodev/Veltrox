async function run() {
  const res = await fetch('https://globi.bg/tools/motor-insurance?plate=CB5237HH', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();
  const inputMatch = html.match(/<input[^>]*id="plate"[^>]*>/);
  console.log('Plate input with ?plate=CB5237HH:', inputMatch ? inputMatch[0] : null);

  // Check if plate appears in value
  const matches = [...html.matchAll(/CB5237HH/gi)];
  console.log('Occurrences of CB5237HH:', matches.length);
}
run();
