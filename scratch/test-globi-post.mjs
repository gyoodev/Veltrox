async function test() {
  const pageRes = await fetch('https://globi.bg/tools/motor-insurance', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await pageRes.text();
  const rawCookies = pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : [pageRes.headers.get('set-cookie')];
  console.log('Set-Cookies:', rawCookies);

  const cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ');
  console.log('Cookie header:', cookieHeader);

  const tokenMatch = html.match(/name="_token" value="([^"]+)"/);
  const token = tokenMatch ? tokenMatch[1] : '';
  console.log('CSRF Token:', token);

  const fd = new URLSearchParams();
  fd.append('_token', token);
  fd.append('plate', 'CB5237HH');
  fd.append('date_mode', 'now');

  const checkRes = await fetch('https://globi.bg/tools/motor-insurance/check', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': token,
      'Cookie': cookieHeader,
      'Referer': 'https://globi.bg/tools/motor-insurance'
    },
    body: fd.toString()
  });

  console.log('Check Status:', checkRes.status);
  const json = await checkRes.json().catch(async () => await checkRes.text());
  console.log('Check Response:', json);
}
test();
