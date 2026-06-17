const fs = require('fs');
const path = require('path');

const USERNAME = 'aroshwijesinghe';
const TOKEN = process.env.GITHUB_TOKEN || process.env.SUMMARY_GITHUB_TOKEN;

async function fetchStats() {
  const headers = {
    'User-Agent': 'node-fetch'
  };
  if (TOKEN) {
    headers['Authorization'] = `token ${TOKEN}`;
  }

  async function getCount(url, acceptHeader) {
    try {
      const fetchHeaders = { ...headers };
      if (acceptHeader) {
        fetchHeaders['Accept'] = acceptHeader;
      }
      const res = await fetch(url, { headers: fetchHeaders });
      if (!res.ok) {
        console.error(`Failed to fetch ${url}: ${res.statusText}`);
        return 0;
      }
      const data = await res.json();
      return data.total_count || 0;
    } catch (err) {
      console.error(`Error fetching ${url}:`, err);
      return 0;
    }
  }

  const commitsUrl = `https://api.github.com/search/commits?q=author:${USERNAME}`;
  const prsUrl = `https://api.github.com/search/issues?q=author:${USERNAME}+type:pr`;
  const issuesUrl = `https://api.github.com/search/issues?q=author:${USERNAME}+type:issue`;
  const reviewsUrl = `https://api.github.com/search/issues?q=reviewed-by:${USERNAME}+type:pr`;

  console.log('Fetching commits...');
  const commits = await getCount(commitsUrl, 'application/vnd.github.cloak-preview');
  console.log('Fetching pull requests...');
  const prs = await getCount(prsUrl);
  console.log('Fetching issues...');
  const issues = await getCount(issuesUrl);
  console.log('Fetching code reviews...');
  const reviews = await getCount(reviewsUrl);

  return { commits, prs, issues, reviews };
}

function generateSVG({ commits, prs, issues, reviews }) {
  const total = commits + prs + issues + reviews;
  console.log(`Stats fetched - Commits: ${commits}, PRs: ${prs}, Issues: ${issues}, Reviews: ${reviews}. Total: ${total}`);

  let cPct = 0, prPct = 0, iPct = 0, rPct = 0;
  if (total > 0) {
    cPct = Math.round((commits / total) * 100);
    prPct = Math.round((prs / total) * 100);
    iPct = Math.round((issues / total) * 100);
    rPct = Math.round((reviews / total) * 100);
    
    // Ensure they sum to 100 due to rounding
    const sum = cPct + prPct + iPct + rPct;
    if (sum !== 100 && sum > 0) {
      const diff = 100 - sum;
      // Adjust the largest one
      const maxVal = Math.max(cPct, prPct, iPct, rPct);
      if (maxVal === cPct) cPct += diff;
      else if (maxVal === prPct) prPct += diff;
      else if (maxVal === iPct) iPct += diff;
      else rPct += diff;
    }
  }

  const width = 350;
  const height = 180;
  const cx = 205; // Shifted right for label balance
  const cy = 90;
  const R = 55;

  const cX = cx - (cPct / 100) * R;
  const cY = cy;
  
  const prX = cx;
  const prY = cy + (prPct / 100) * R;
  
  const iX = cx + (iPct / 100) * R;
  const iY = cy;
  
  const rX = cx;
  const rY = cy - (rPct / 100) * R;

  const points = `${cX},${cY} ${prX},${prY} ${iX},${iY} ${rX},${rY}`;

  const circles = [];
  if (cPct > 0) circles.push({ x: cX, y: cY });
  if (prPct > 0) circles.push({ x: prX, y: prY });
  if (iPct > 0) circles.push({ x: iX, y: iY });
  if (rPct > 0) circles.push({ x: rX, y: rY });

  const circleElements = circles.map(c => `
    <circle cx="${c.x}" cy="${c.y}" r="3.5" fill="#ffffff" stroke="#00ff9d" stroke-width="2" filter="url(#glow)" />
  `).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .label {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      fill: #8b949e;
      font-size: 11px;
    }
    .val-text {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      fill: #ffffff;
      font-size: 12px;
      font-weight: 600;
    }
    .axis {
      stroke: #39d353;
      stroke-width: 1.5;
      opacity: 0.55;
    }
    .poly {
      fill: rgba(0, 255, 157, 0.22);
      stroke: #00ff9d;
      stroke-width: 2;
    }
    .card-bg {
      fill: #0d1117;
      stroke: #30363d;
      stroke-width: 1;
      rx: 6px;
    }
  </style>

  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.5" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Card Background -->
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" class="card-bg" />

  <!-- Radar Grid/Axes -->
  <!-- Vertical Axis (Code review - Pull requests) -->
  <line x1="${cx}" y1="${cy - R}" x2="${cx}" y2="${cy + R}" class="axis" />
  <!-- Horizontal Axis (Commits - Issues) -->
  <line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}" class="axis" />

  <!-- Data Polygon -->
  <polygon points="${points}" class="poly" />

  <!-- Data Points -->
  ${circleElements}

  <!-- Labels & Values -->
  
  <!-- Top: Code review -->
  ${rPct > 0 ? `
    <text x="${cx}" y="${cy - R - 18}" text-anchor="middle" class="val-text">${rPct}%</text>
    <text x="${cx}" y="${cy - R - 6}" text-anchor="middle" class="label">Code review</text>
  ` : `
    <text x="${cx}" y="${cy - R - 10}" text-anchor="middle" class="label">Code review</text>
  `}

  <!-- Right: Issues -->
  ${iPct > 0 ? `
    <text x="${cx + R + 10}" y="${cy - 4}" text-anchor="start" class="val-text">${iPct}%</text>
    <text x="${cx + R + 10}" y="${cy + 8}" text-anchor="start" class="label">Issues</text>
  ` : `
    <text x="${cx + R + 10}" y="${cy + 4}" text-anchor="start" class="label">Issues</text>
  `}

  <!-- Bottom: Pull requests -->
  ${prPct > 0 ? `
    <text x="${cx}" y="${cy + R + 16}" text-anchor="middle" class="val-text">${prPct}%</text>
    <text x="${cx}" y="${cy + R + 28}" text-anchor="middle" class="label">Pull requests</text>
  ` : `
    <text x="${cx}" y="${cy + R + 18}" text-anchor="middle" class="label">Pull requests</text>
  `}

  <!-- Left: Commits -->
  ${cPct > 0 ? `
    <text x="${cx - R - 10}" y="${cy - 4}" text-anchor="end" class="val-text">${cPct}%</text>
    <text x="${cx - R - 10}" y="${cy + 8}" text-anchor="end" class="label">Commits</text>
  ` : `
    <text x="${cx - R - 10}" y="${cy + 4}" text-anchor="end" class="label">Commits</text>
  `}

</svg>`;
}

async function main() {
  const stats = await fetchStats();
  const svg = generateSVG(stats);
  const outputPath = path.join(__dirname, 'github-contribution-radar.svg');
  fs.writeFileSync(outputPath, svg);
  console.log(`Successfully generated radar chart at: ${outputPath}`);
}

main().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
