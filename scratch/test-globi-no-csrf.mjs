async function run() {
  const fd = new URLSearchParams();
  fd.append('plate', 'CB5237HH');

  const launchRes = await fetch('https://globi.bg/tools/launch/insurance', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: fd.toString(),
    redirect: 'manual'
  });

  console.log('Launch without token status:', launchRes.status);
  console.log('Location:', launchRes.headers.get('location'));
}
run();
