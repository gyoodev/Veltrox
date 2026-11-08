async function run() {
  try {
    const res = await fetch('https://globi.bg/tools/motor-insurance', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('Length:', html.length);

    // Look for keywords
    const keywords = ['api', 'check', 'insurance', 'endpoint', 'fetch', 'ajax', 'regNumber', 'plate'];
    for (const kw of keywords) {
      const idx = html.toLowerCase().indexOf(kw);
      if (idx !== -1) {
        console.log(`Keyword "${kw}" found around:`, html.slice(Math.max(0, idx - 100), Math.min(html.length, idx + 200)));
        break;
      }
    }

    // Find all script tags
    const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
    console.log('Total scripts found:', scriptMatches.length);
    for (let i = 0; i < scriptMatches.length; i++) {
      const tag = scriptMatches[i][0];
      const content = scriptMatches[i][1];
      if (content.length > 50 && (content.includes('fetch') || content.includes('http') || content.includes('insurance') || content.includes('submit'))) {
        console.log(`Script ${i} snippet:`, content.slice(0, 300));
      }
    }

    // Find form or input elements
    const inputs = [...html.matchAll(/<input[^>]*>/gi)].map(m => m[0]);
    console.log('Inputs:', inputs);

    const forms = [...html.matchAll(/<form[^>]*action=[\"']?([^\"' >]+)[\"']?[^>]*>/gi)].map(m => m[0]);
    console.log('Forms with action:', forms);

  } catch (err) {
    console.error('Error:', err);
  }
}
run();
