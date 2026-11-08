async function run() {
  const pageRes = await fetch('https://globi.bg/tools/motor-insurance', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await pageRes.text();
  const rawCookies = pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : [pageRes.headers.get('set-cookie')];
  const cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ');
  const tokenMatch = html.match(/name="_token" value="([^"]+)"/);
  const token = tokenMatch ? tokenMatch[1] : '';

  const fd = new URLSearchParams();
  fd.append('_token', token);
  fd.append('plate', 'CB5237HH');

  const launchRes = await fetch('https://globi.bg/tools/launch/insurance', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHeader,
      'Referer': 'https://globi.bg/tools/motor-insurance'
    },
    body: fd.toString(),
    redirect: 'manual'
  });

  console.log('Launch status:', launchRes.status);
  console.log('Location:', launchRes.headers.get('location'));
  console.log('Set-Cookie:', launchRes.headers.get('set-cookie'));
}
run();
