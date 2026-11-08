import fs from 'fs';

async function run() {
  const res = await fetch('https://globi.bg/tools/motor-insurance', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  console.log('--- Script 14 ---');
  console.log(scriptMatches[14][1]);
}
run();
