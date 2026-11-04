const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve(__dirname, '../artifacts/staging-verification-screenshots');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const targets = [
  {
    name: 'organizer_control_desktop.png',
    url: 'https://stagingbidwar.up.railway.app/tournament/4/auction',
    size: '1440,900',
  },
  {
    name: 'organizer_control_mobile.png',
    url: 'https://stagingbidwar.up.railway.app/tournament/4/auction',
    size: '390,844',
  },
  {
    name: 'owner_app_desktop.png',
    url: 'https://stagingbidwar.up.railway.app/owner-app/',
    size: '1440,900',
  },
  {
    name: 'owner_app_mobile.png',
    url: 'https://stagingbidwar.up.railway.app/owner-app/',
    size: '390,844',
  },
  {
    name: 'led_venue_display_desktop.png',
    url: 'https://stagingbidwar.up.railway.app/tournament/4/display',
    size: '1920,1080',
  },
  {
    name: 'led_venue_display_mobile.png',
    url: 'https://stagingbidwar.up.railway.app/tournament/4/display',
    size: '390,844',
  },
  {
    name: 'scoring_app_desktop.png',
    url: 'https://stagingbidwar.up.railway.app/scoring-app/',
    size: '1440,900',
  },
  {
    name: 'scoring_app_mobile.png',
    url: 'https://stagingbidwar.up.railway.app/scoring-app/',
    size: '390,844',
  },
];

console.log('Capturing staging browser verification screenshots via Chrome Headless...');
for (const t of targets) {
  const filePath = path.join(outDir, t.name);
  const cmd = `"${chromePath}" --headless=new --screenshot="${filePath}" --window-size=${t.size} --virtual-time-budget=4000 "${t.url}"`;
  console.log(`- Capturing ${t.name} (${t.size})...`);
  try {
    execSync(cmd, { stdio: 'ignore', timeout: 25000 });
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`  ✓ OK: ${t.name} (${Math.round(stats.size / 1024)} KB)`);
    } else {
      console.warn(`  ✗ Failed: ${t.name} was not generated`);
    }
  } catch (e) {
    console.error(`  ✗ Error capturing ${t.name}:`, e.message);
  }
}

console.log('Screenshot capture run completed.');
