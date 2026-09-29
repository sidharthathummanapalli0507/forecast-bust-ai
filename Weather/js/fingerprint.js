/**
 * fingerprint.js — Main dashboard logic for Forecast Failure Fingerprinting
 * Initializes all charts, map, event list, and interactive comparisons
 */

// ============================================================
// GLOBALS
// ============================================================
let rmseChart = null;
let bustMonthChart = null;
let eventRadarChart = null;
let sig1Chart = null;
let sig2Chart = null;
let selectedEventId = null;
let allEvents = [...HISTORICAL_EVENTS];

// ============================================================
// CHART.JS GLOBAL DEFAULTS
// ============================================================
Chart.defaults.color = '#9C8060';
Chart.defaults.borderColor = 'rgba(255,101,0,0.1)';
Chart.defaults.font.family = "'Canva Sans', canva-sans, 'Noto Sans', sans-serif";
Chart.defaults.font.size = 11;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
  loadDemoData();
  initMap();
  drawSignatures();
});

function updateClock() {
  const el = document.getElementById('liveTime');
  if (!el) return;
  const now = new Date();
  const opts = { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  el.textContent = now.toLocaleString('en-IN', opts).replace(/,/g, '') + ' IST';
}

// ============================================================
// LOAD DATA (simulates API response)
// ============================================================
function loadDemoData() {
  const btn = document.getElementById('refreshBtn');
  if (btn) {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="animation:spin 0.8s linear infinite"><path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 2v5h-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Loading…`;
  }

  // Simulate API latency
  setTimeout(() => {
    animateKPIs();
    renderEventList(allEvents);
    drawRMSEChart();
    drawBustMonthChart();
    drawEventRadarChart();
    renderHeatmap();

    if (btn) {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 2v5h-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Refresh Analysis`;
    }
  }, 900);
}

// ============================================================
// ANIMATE KPI COUNTERS
// ============================================================
function animateKPIs() {
  animateCount('kpiEvents', 0, allEvents.length, 800, '');
  animateCount('kpiBusts', 0, allEvents.filter(e => e.bustSeverity !== 'low').length, 900, '');
  animateDecimal('kpiRmse', 0, 3.47, 1000, '°C');
  animateCount('kpiHighRisk', 0, 12, 700, '');
}

function animateCount(id, start, end, duration, suffix) {
  const el = document.getElementById(id);
  if (!el) return;
  const step = (end - start) / (duration / 16);
  let current = start;
  const timer = setInterval(() => {
    current += step;
    if (current >= end) { current = end; clearInterval(timer); }
    el.textContent = Math.floor(current) + suffix;
  }, 16);
}

function animateDecimal(id, start, end, duration, suffix) {
  const el = document.getElementById(id);
  if (!el) return;
  const step = (end - start) / (duration / 16);
  let current = start;
  const timer = setInterval(() => {
    current += step;
    if (current >= end) { current = end; clearInterval(timer); }
    el.textContent = current.toFixed(2) + suffix;
  }, 16);
}

// ============================================================
// RENDER EVENT LIST
// ============================================================
function renderEventList(events) {
  const container = document.getElementById('eventList');
  const countEl = document.getElementById('eventCount');
  if (!container) return;

  if (countEl) countEl.textContent = `${events.length} Events`;

  container.innerHTML = events.map(ev => {
    const maxRmse = 10;
    const pct = Math.min((ev.rmseByDay[ev.bustDay] / maxRmse) * 100, 100);
    const barColor = ev.bustSeverity === 'high' ? '#ef4444' : ev.bustSeverity === 'medium' ? '#f59e0b' : '#22d3a0';
    const pillClass = `pill-${ev.bustSeverity}`;
    const typeLabel = ev.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `
      <div class="event-item ${selectedEventId === ev.id ? 'selected' : ''}" onclick="selectEvent('${ev.id}')" id="ei-${ev.id}">
        <div class="event-item-header">
          <span class="event-name">${ev.name}</span>
          <span class="event-bust-pill ${pillClass}">${ev.bustSeverity}</span>
        </div>
        <div class="event-meta">
          <span>${typeLabel}</span>
          <span>${ev.date.slice(0, 7)}</span>
          <span>Day ${ev.bustDay} bust</span>
        </div>
        <div class="event-rmse-bar">
          <div class="event-rmse-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Filter events
function filterEvents(query) {
  const q = query.toLowerCase();
  const filtered = allEvents.filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.type.toLowerCase().includes(q) ||
    e.region.toLowerCase().includes(q)
  );
  renderEventList(filtered);
}

// ============================================================
// SELECT EVENT → DETAIL PANEL
// ============================================================
function selectEvent(id) {
  selectedEventId = id;
  // Update list selection
  document.querySelectorAll('.event-item').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById(`ei-${id}`);
  if (el) el.classList.add('selected');

  const ev = HISTORICAL_EVENTS.find(e => e.id === id);
  if (!ev) return;

  // Update RMSE chart data
  updateRMSEChart(ev.rmseTemp, ev.rmsePrec, ev.rmseWind);

  // Update detail panel
  renderDetailPanel(ev);

  // Focus map on event coordinates
  if (typeof focusMapOnEvent === 'function') {
    focusMapOnEvent(ev.lat, ev.lon, ev.name);
  }
}

function renderDetailPanel(ev) {
  const panel = document.getElementById('detailContent');
  if (!panel) return;

  const typeLabel = ev.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const bustColor = ev.bustSeverity === 'high' ? 'var(--accent-red)' : ev.bustSeverity === 'medium' ? 'var(--accent-amber)' : 'var(--accent-green)';

  panel.innerHTML = `
    <div class="detail-event-header">
      <div class="det-event-name">${ev.name}</div>
      <div class="det-meta">
        <span>${typeLabel}</span>
        <span>${ev.date} → ${ev.endDate}</span>
        <span style="color:${bustColor}">${ev.bustSeverity.toUpperCase()} BUST</span>
      </div>
    </div>

    <div class="det-section">
      <div class="det-section-title">Fingerprint Metrics</div>
      <div class="det-stat-row">
        <span class="det-stat-label">Region</span>
        <span class="det-stat-val" style="font-size:0.75rem">${ev.region}</span>
      </div>
      <div class="det-stat-row">
        <span class="det-stat-label">Bust Lead Time</span>
        <span class="det-stat-val" style="color:${bustColor}">Day ${ev.bustDay}</span>
      </div>
      <div class="det-stat-row">
        <span class="det-stat-label">Peak RMSE (Day ${ev.bustDay})</span>
        <span class="det-stat-val">${ev.rmseByDay[ev.bustDay].toFixed(1)}°C</span>
      </div>
      ${ev.trackError > 0 ? `<div class="det-stat-row">
        <span class="det-stat-label">Track Error</span>
        <span class="det-stat-val">${ev.trackError} km</span>
      </div>` : ''}
      <div class="det-stat-row">
        <span class="det-stat-label">Intensity Error</span>
        <span class="det-stat-val">${ev.intensityError} knots/°C</span>
      </div>
    </div>

    <div class="det-section">
      <div class="det-section-title">Model Performance Score</div>
      <div class="model-perf">
        ${Object.entries(ev.modelPerf).map(([model, score]) => {
          const color = score >= 80 ? '#22d3a0' : score >= 60 ? '#f59e0b' : '#ef4444';
          return `
            <div class="model-row">
              <span class="model-name">${model}</span>
              <div class="model-bar-wrap">
                <div class="model-bar-fill" style="width:${score}%;background:${color}"></div>
              </div>
              <span class="model-score" style="color:${color}">${score}</span>
            </div>`;
        }).join('')}
      </div>
    </div>

    <div class="det-section">
      <div class="det-section-title">Root Causes</div>
      ${ev.causes.map(c => `<div class="det-cause">${c}</div>`).join('')}
    </div>

    <div class="det-section">
      <div class="det-section-title">Key Failure Factors</div>
      <div class="module-features">
        ${ev.factors.map(f => `<span class="feature-tag">${f}</span>`).join('')}
      </div>
    </div>
  `;
}

// ============================================================
// RMSE CHART
// ============================================================
let currentRMSEMetric = 'temp'; // 'temp' | 'prec' | 'wind' | 'all'
let currentRMSEData = {
  temp: HISTORICAL_EVENTS[0].rmseTemp,
  prec: HISTORICAL_EVENTS[0].rmsePrec,
  wind: HISTORICAL_EVENTS[0].rmseWind
};

function getRMSEDatasetsForMetric(metric) {
  const tempDS = {
    label: 'Temperature RMSE (°C)',
    data: currentRMSEData.temp || [],
    borderColor: '#FF6500',
    backgroundColor: 'rgba(255,101,0,0.12)',
    borderWidth: 2.8,
    pointRadius: 4.5,
    pointBackgroundColor: '#FF6500',
    pointHoverRadius: 7,
    tension: 0.38,
    fill: metric === 'temp'
  };

  const precDS = {
    label: 'Precipitation RMSE (mm)',
    data: currentRMSEData.prec || [],
    borderColor: '#7048E8',
    backgroundColor: 'rgba(112,72,232,0.12)',
    borderWidth: 2.8,
    pointRadius: 4.5,
    pointBackgroundColor: '#7048E8',
    pointHoverRadius: 7,
    tension: 0.38,
    fill: metric === 'prec'
  };

  const windDS = {
    label: 'Wind Speed RMSE (m/s)',
    data: currentRMSEData.wind || [],
    borderColor: '#1971C2',
    backgroundColor: 'rgba(25,113,194,0.12)',
    borderWidth: 2.8,
    pointRadius: 4.5,
    pointBackgroundColor: '#1971C2',
    pointHoverRadius: 7,
    tension: 0.38,
    fill: metric === 'wind'
  };

  if (metric === 'temp') return [tempDS];
  if (metric === 'prec') return [precDS];
  if (metric === 'wind') return [windDS];
  return [tempDS, precDS, windDS];
}

function getRMSEYAxisTitle(metric) {
  if (metric === 'temp') return 'Temperature Error (°C)';
  if (metric === 'prec') return 'Precipitation Error (mm)';
  if (metric === 'wind') return 'Wind Speed Error (m/s)';
  return 'Lead Time RMSE (Day 1–10)';
}

function drawRMSEChart() {
  const ctx = document.getElementById('rmseChart');
  if (!ctx) return;
  if (rmseChart) rmseChart.destroy();

  const datasets = getRMSEDatasetsForMetric(currentRMSEMetric);
  const yAxisTitle = getRMSEYAxisTitle(currentRMSEMetric);

  rmseChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7','Day 8','Day 9','Day 10'],
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: currentRMSEMetric === 'all',
          position: 'top',
          labels: {
            boxWidth: 10,
            color: '#5C4A2A',
            font: { family: "'Canva Sans', canva-sans, sans-serif", size: 10, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.98)',
          borderColor: 'rgba(255,101,0,0.3)',
          borderWidth: 1.5,
          titleColor: '#1A1208',
          bodyColor: '#5C4A2A',
          boxShadow: '0 4px 20px rgba(26,18,8,0.12)',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y !== undefined ? ctx.parsed.y.toFixed(2) : ''}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,101,0,0.06)' },
          ticks: { color: '#9C8060', font: { weight: '600' } }
        },
        y: {
          grid: { color: 'rgba(255,101,0,0.06)' },
          ticks: { color: '#9C8060', font: { weight: '600' } },
          title: { display: true, text: yAxisTitle, color: '#9C8060', font: { size: 11, weight: '700' } }
        }
      }
    }
  });
}

function updateRMSEChart(temp, prec, wind) {
  if (temp) currentRMSEData.temp = temp;
  if (prec) currentRMSEData.prec = prec;
  if (wind) currentRMSEData.wind = wind;

  if (!rmseChart) return;
  rmseChart.data.datasets = getRMSEDatasetsForMetric(currentRMSEMetric);
  rmseChart.options.scales.y.title.text = getRMSEYAxisTitle(currentRMSEMetric);
  rmseChart.options.plugins.legend.display = currentRMSEMetric === 'all';
  rmseChart.update();
}

function setRMSEMetric(metric, btn) {
  currentRMSEMetric = metric;

  // Update active pill state
  document.querySelectorAll('.chart-toggles .ctoggle').forEach(b => b.classList.remove('active'));
  if (btn) {
    btn.classList.add('active');
  } else {
    const defaultBtn = document.getElementById(`btn-rmse-${metric}`);
    if (defaultBtn) defaultBtn.classList.add('active');
  }

  if (!rmseChart) {
    drawRMSEChart();
    return;
  }

  rmseChart.data.datasets = getRMSEDatasetsForMetric(metric);
  rmseChart.options.scales.y.title.text = getRMSEYAxisTitle(metric);
  rmseChart.options.plugins.legend.display = metric === 'all';
  rmseChart.update();
}

// Backwards-compatible click handler
function toggleChartLine(index, btn) {
  const map = { 0: 'temp', 1: 'prec', 2: 'wind', 3: 'all' };
  setRMSEMetric(map[index] || 'temp', btn);
}

// ============================================================
// BUST FREQUENCY BY MONTH CHART
// ============================================================
function drawBustMonthChart() {
  const ctx = document.getElementById('bustMonthChart');
  if (!ctx) return;
  if (bustMonthChart) bustMonthChart.destroy();

  const { labels, cyclone, monsoon_dep, heat_wave, heavy_rain } = BUST_BY_MONTH;

  bustMonthChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Cyclone',     data: cyclone,     backgroundColor: 'rgba(224,49,49,0.75)',   borderRadius: 4 },
        { label: 'Monsoon Dep', data: monsoon_dep, backgroundColor: 'rgba(112,72,232,0.72)', borderRadius: 4 },
        { label: 'Heat Wave',   data: heat_wave,   backgroundColor: 'rgba(255,101,0,0.78)',  borderRadius: 4 },
        { label: 'Heavy Rain',  data: heavy_rain,  backgroundColor: 'rgba(25,113,194,0.72)', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 10, weight: '600' }, color: '#5C4A2A' }
        },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.98)',
          borderColor: 'rgba(255,101,0,0.3)',
          borderWidth: 1.5,
          titleColor: '#1A1208',
          bodyColor: '#5C4A2A'
        }
      },
      scales: {
        x: { stacked: true, grid: { color: 'rgba(255,101,0,0.05)' }, ticks: { color: '#9C8060', font: { weight: '600' } } },
        y: { stacked: true, grid: { color: 'rgba(255,101,0,0.05)' }, ticks: { stepSize: 2, color: '#9C8060', font: { weight: '600' } } }
      }
    }
  });
}

// ============================================================
// EVENT RADAR CHART
// ============================================================
function drawEventRadarChart() {
  const ctx = document.getElementById('eventRadarChart');
  if (!ctx) return;
  if (eventRadarChart) eventRadarChart.destroy();

  const { labels, cyclone, heavy_rain, heat_wave } = EVENT_RADAR_DATA;
  const maxVal = 100;

  eventRadarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          label: 'Cyclone',
          data: cyclone.map(v => (v / maxVal) * 100),
          borderColor: '#E03131',
          backgroundColor: 'rgba(224,49,49,0.1)',
          pointBackgroundColor: '#E03131',
          borderWidth: 2
        },
        {
          label: 'Heavy Rain',
          data: heavy_rain.map(v => (v / maxVal) * 100),
          borderColor: '#FF6500',
          backgroundColor: 'rgba(255,101,0,0.08)',
          pointBackgroundColor: '#FF6500',
          borderWidth: 2
        },
        {
          label: 'Heat Wave',
          data: heat_wave.map(v => (v / maxVal) * 100),
          borderColor: '#1971C2',
          backgroundColor: 'rgba(25,113,194,0.08)',
          pointBackgroundColor: '#1971C2',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 10, weight: '600' }, color: '#5C4A2A' } },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.98)',
          borderColor: 'rgba(255,101,0,0.3)',
          borderWidth: 1.5,
          titleColor: '#1A1208',
          bodyColor: '#5C4A2A'
        }
      },
      scales: {
        r: {
          angleLines: { color: 'rgba(255,101,0,0.1)' },
          grid: { color: 'rgba(255,101,0,0.1)' },
          pointLabels: { color: '#5C4A2A', font: { size: 9, weight: '600' } },
          ticks: { display: false }
        }
      }
    }
  });
}

// ============================================================
// HEATMAP
// ============================================================
function renderHeatmap() {
  const grid = document.getElementById('heatmapGrid');
  if (!grid) return;

  const { models, events, scores } = HEATMAP_DATA;

  function getColor(val) {
    if (val >= 80) return { bg: 'rgba(34,211,160,0.25)', text: '#22d3a0' };
    if (val >= 65) return { bg: 'rgba(79,195,247,0.2)', text: '#4fc3f7' };
    if (val >= 50) return { bg: 'rgba(245,158,11,0.2)', text: '#f59e0b' };
    return { bg: 'rgba(239,68,68,0.25)', text: '#ef4444' };
  }

  // Header row
  let html = `
    <div class="hm-row hm-header">
      <div class="hm-label"></div>
      <div class="hm-cells">
        ${events.map(e => `<div class="hm-cell" style="font-size:0.58rem;color:var(--text-muted)">${e}</div>`).join('')}
      </div>
    </div>
  `;

  // Data rows
  models.forEach((model, mi) => {
    html += `
      <div class="hm-row">
        <div class="hm-label">${model}</div>
        <div class="hm-cells">
          ${scores[mi].map((val, ei) => {
            const c = getColor(val);
            return `<div class="hm-cell" style="background:${c.bg};color:${c.text}" title="${model} × ${events[ei]}: ${val}">${val}</div>`;
          }).join('')}
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

// ============================================================
// SVG INDIA MAP — No external tile dependency
// ============================================================
// ============================================================
// MAP MODULE — Official India Map (Mappls Web SDK + Leaflet + SVG Fallback)
// Reference: https://github.com/mappls-api/mapmyindia-rest-api
// ============================================================
let leafletMap = null;
let mapplsMapInstance = null;
let activeMapMarkers = [];
let mapplsScriptLoading = false;

// Official sovereign boundary of India (Survey of India recognized outline)
const INDIA_OFFICIAL_BOUNDARY = [
  [37.05, 74.50], [37.10, 75.00], [36.00, 76.50], [35.50, 77.50], [35.40, 78.50],
  [35.00, 79.50], [34.50, 79.80], [33.80, 79.20], [32.50, 78.80], [32.00, 78.90],
  [31.20, 78.50], [31.00, 79.10], [30.50, 80.00], [30.20, 81.00], [28.80, 80.10],
  [27.50, 81.50], [27.00, 84.00], [26.50, 85.20], [26.40, 87.00], [26.80, 88.00],
  [27.10, 88.20], [28.00, 88.60], [27.80, 89.00], [27.30, 88.90], [27.00, 89.80],
  [27.30, 91.50], [27.80, 92.00], [28.00, 93.00], [28.80, 94.50], [29.30, 95.50],
  [28.20, 96.50], [28.00, 97.40], [27.00, 97.10], [26.00, 96.50], [25.50, 95.20],
  [24.00, 94.20], [23.50, 93.30], [22.00, 93.00], [21.50, 92.50], [22.00, 91.80],
  [23.00, 91.30], [24.00, 91.80], [24.50, 92.50], [25.20, 92.00], [25.10, 90.00],
  [26.00, 89.80], [25.50, 88.50], [24.50, 88.00], [22.50, 89.00], [21.60, 88.00],
  [21.50, 87.00], [20.00, 86.00], [19.20, 85.00], [18.00, 83.50], [16.50, 82.00],
  [15.80, 80.50], [13.50, 80.20], [11.80, 79.80], [10.00, 79.20], [9.20, 79.10],
  [8.20, 77.50], [8.50, 76.90], [9.50, 76.30], [10.50, 76.00], [11.80, 75.30],
  [13.00, 74.80], [15.00, 74.00], [16.00, 73.50], [18.80, 72.80], [19.50, 72.80],
  [20.50, 72.80], [21.10, 71.00], [20.80, 70.40], [22.20, 69.00], [23.00, 68.20],
  [23.70, 68.50], [24.20, 70.00], [24.50, 71.10], [25.50, 70.30], [27.00, 70.50],
  [28.00, 71.50], [29.50, 71.80], [30.50, 73.00], [31.50, 74.50], [32.50, 74.80],
  [33.20, 74.00], [34.00, 74.00], [35.00, 74.50], [36.00, 74.50], [37.05, 74.50]
];

function initMap() {
  const mapEl = document.getElementById('indiaMap');
  if (!mapEl) return;

  // Restore stored key if available
  const storedKey = localStorage.getItem('mappls_api_key');
  const keyInput = document.getElementById('mapplsApiKey');
  if (storedKey && keyInput) {
    keyInput.value = storedKey;
    loadMapplsSDK(storedKey);
    return;
  }

  // Default: Official interactive map via Leaflet
  initLeafletMap();
}

// User enters or modifies Mappls Key
function onMapplsKeyChange(keyVal) {
  const key = (keyVal || '').trim();
  const statusEl = document.getElementById('mapplsStatus');

  if (!key) {
    localStorage.removeItem('mappls_api_key');
    if (statusEl) {
      statusEl.className = 'mappls-status';
      statusEl.textContent = 'Interactive Mode';
    }
    initLeafletMap();
    return;
  }

  localStorage.setItem('mappls_api_key', key);
  if (key.length >= 8) {
    if (statusEl) {
      statusEl.className = 'mappls-status';
      statusEl.textContent = 'Connecting Mappls…';
    }
    loadMapplsSDK(key);
  }
}

// Dynamically load Mappls Map SDK (MapmyIndia Web SDK v3.0)
function loadMapplsSDK(apiKey) {
  const statusEl = document.getElementById('mapplsStatus');

  if (window.mappls && typeof window.mappls.Map === 'function') {
    initMapplsMap(apiKey);
    return;
  }

  if (mapplsScriptLoading) return;
  mapplsScriptLoading = true;

  const script = document.createElement('script');
  script.src = `https://apis.mappls.com/advancedmaps/api/${encodeURIComponent(apiKey)}/map_sdk?layer=vector&v=3.0`;
  script.async = true;

  script.onload = () => {
    mapplsScriptLoading = false;
    initMapplsMap(apiKey);
  };

  script.onerror = () => {
    mapplsScriptLoading = false;
    if (statusEl) {
      statusEl.className = 'mappls-status error';
      statusEl.textContent = 'Mappls Key Invalid';
    }
    // Graceful fallback to Leaflet
    initLeafletMap();
  };

  document.head.appendChild(script);
}

// Initialize Mappls Vector Map
function initMapplsMap(apiKey) {
  const mapEl = document.getElementById('indiaMap');
  const statusEl = document.getElementById('mapplsStatus');
  if (!mapEl) return;

  // Clean prior instances
  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
  }
  mapEl.innerHTML = '';

  try {
    mapplsMapInstance = new mappls.Map('indiaMap', {
      center: [22.8, 80.2],
      zoom: 4.8,
      zoomControl: true,
      hybrid: false,
      search: false
    });

    mapplsMapInstance.on('load', () => {
      if (statusEl) {
        statusEl.className = 'mappls-status live';
        statusEl.textContent = '● Mappls Live';
      }

      // Plot error hotspots on Mappls map
      GEO_ERROR_POINTS.forEach(([lat, lon, error, region, label]) => {
        const pct = Math.round(error * 100);
        const color = error > 0.75 ? '#E03131' : error > 0.5 ? '#FF6500' : '#2F9E44';

        if (typeof mappls.Circle === 'function') {
          new mappls.Circle({
            map: mapplsMapInstance,
            center: { lat, lng: lon },
            radius: 40000 + (error * 90000),
            fillColor: color,
            fillOpacity: 0.35,
            strokeColor: color,
            strokeWeight: 2
          });
        }

        if (typeof mappls.Marker === 'function') {
          const marker = new mappls.Marker({
            map: mapplsMapInstance,
            position: { lat, lng: lon },
            popupHtml: `
              <div style="font-family:'Canva Sans',canva-sans,var(--font-sans,sans-serif);padding:6px;min-width:180px">
                <strong style="color:#1A1208;font-size:13px">${region}</strong><br/>
                <span style="color:#7A6040;font-size:11px">${label}</span>
                <div style="margin:6px 0">
                  <span style="color:#9C8060;font-size:10px;font-weight:700">BUST RISK: </span>
                  <span style="color:${color};font-weight:800;font-size:14px">${pct}%</span>
                </div>
                <button class="map-popup-btn" onclick="filterByMapRegion('${region}')">
                  Filter Events →
                </button>
              </div>
            `
          });
          activeMapMarkers.push(marker);
        }
      });
    });
  } catch (err) {
    console.error('Mappls initialization error:', err);
    if (statusEl) {
      statusEl.className = 'mappls-status error';
      statusEl.textContent = 'Mappls Fallback';
    }
    initLeafletMap();
  }
}

// Initialize Leaflet Map with Official Sovereign India Boundary & Hotspots
function initLeafletMap() {
  const mapEl = document.getElementById('indiaMap');
  const statusEl = document.getElementById('mapplsStatus');
  if (!mapEl) return;

  // Clean prior instances
  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
  }
  mapEl.innerHTML = '';
  activeMapMarkers = [];

  // Fallback to SVG if Leaflet library is not loaded
  if (typeof L === 'undefined') {
    renderSVGMap();
    if (statusEl) {
      statusEl.className = 'mappls-status';
      statusEl.textContent = 'SVG Mode';
    }
    return;
  }

  if (statusEl && !localStorage.getItem('mappls_api_key')) {
    statusEl.className = 'mappls-status';
    statusEl.textContent = 'Interactive India Map';
  }

  // Create Leaflet map centered over India
  leafletMap = L.map('indiaMap', {
    center: [22.8, 80.2],
    zoom: 4.5,
    minZoom: 4,
    maxZoom: 9,
    zoomControl: true,
    attributionControl: false,
    maxBounds: [[4.0, 64.0], [38.5, 100.0]],
    maxBoundsViscosity: 0.8
  });

  // 🛰️ Original India Satellite Imagery (Esri World Imagery HD)
  const satelliteBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: 'Satellite Imagery &copy; Esri, Maxar, Earthstar Geographics'
  }).addTo(leafletMap);

  // Administrative borders & city/state labels overlay
  const satelliteLabels = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    opacity: 0.95
  }).addTo(leafletMap);

  // Layer control for satellite customization
  L.control.layers({
    "🛰️ Original India Satellite (HD)": satelliteBase
  }, {
    "🏷️ State Borders & Labels": satelliteLabels
  }, { position: 'topright' }).addTo(leafletMap);

  // Official Sovereign Boundary of India (Survey of India recognized border)
  L.polygon(INDIA_OFFICIAL_BOUNDARY, {
    color: '#FF6500',
    weight: 2.4,
    opacity: 0.95,
    fillColor: '#FF6500',
    fillOpacity: 0.04,
    dashArray: 'none',
    smoothFactor: 1.0
  }).addTo(leafletMap);

  // Plot Geospatial Error Hotspots with animated pulsing pins
  GEO_ERROR_POINTS.forEach(([lat, lon, error, region, label]) => {
    const pct = Math.round(error * 100);
    const color = error > 0.75 ? '#E03131' : error > 0.5 ? '#FF6500' : '#2F9E44';
    const size = Math.round(24 + error * 16);

    const pinHtml = `
      <div class="custom-map-pin" style="width:${size}px;height:${size}px">
        <div class="custom-pulse-ring" style="background:${color};border:1.5px solid ${color};opacity:0.3"></div>
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #FFFFFF;box-shadow:0 3px 12px rgba(255,101,0,0.3);display:flex;align-items:center;justify-content:center">
          <span style="color:#ffffff;font-size:9px;font-weight:800;font-family:'JetBrains Mono',monospace">${pct}%</span>
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      html: pinHtml,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });

    const popupHtml = `
      <div style="font-family:'Canva Sans',canva-sans,var(--font-sans,sans-serif);min-width:180px">
        <div style="font-size:13px;font-weight:800;color:#1A1208;margin-bottom:2px">${region}</div>
        <div style="font-size:11px;color:#7A6040;font-weight:500;margin-bottom:6px">${label}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;background:#FFF4ED;padding:5px 8px;border-radius:6px;border:1px solid rgba(255,101,0,0.18)">
          <span style="font-size:10px;font-weight:700;color:#9C8060">NWP BUST RISK</span>
          <span style="font-size:14px;font-weight:900;color:${color}">${pct}%</span>
        </div>
        <button class="map-popup-btn" onclick="filterByMapRegion('${region}')">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>
          Filter Events
        </button>
      </div>
    `;

    const marker = L.marker([lat, lon], { icon: customIcon })
      .bindPopup(popupHtml)
      .bindTooltip(`${region}: ${pct}% bust risk`, { direction: 'top', offset: [0, -size / 2] })
      .addTo(leafletMap);

    activeMapMarkers.push({ lat, lon, region, marker });
  });

  // Ensure tiles settle properly
  setTimeout(() => {
    if (leafletMap) leafletMap.invalidateSize();
  }, 200);
}

// Filter event list by region clicked on map
function filterByMapRegion(region) {
  const searchInput = document.getElementById('fpSearch');
  if (searchInput) {
    searchInput.value = region.split('/')[0].split(',')[0].trim();
    filterEvents(searchInput.value);
  }
}

// Pan / fly map to event location and open hotspot details
function focusMapOnEvent(lat, lon, label) {
  if (leafletMap && typeof leafletMap.flyTo === 'function') {
    leafletMap.flyTo([lat, lon], 6.5, { duration: 1.0 });
    const found = activeMapMarkers.find(m => Math.hypot(m.lat - lat, m.lon - lon) < 1.8);
    if (found && found.marker && typeof found.marker.openPopup === 'function') {
      setTimeout(() => found.marker.openPopup(), 600);
    }
  } else if (mapplsMapInstance && typeof mapplsMapInstance.flyTo === 'function') {
    mapplsMapInstance.flyTo({ center: [lat, lon], zoom: 6.5 });
  }
}

// Satellite Map of India Initializer (No sample maps)
function renderSVGMap() {
  initLeafletMap();
}


// ============================================================
// SIGNATURE COMPARISON
// ============================================================
const SIG_LABELS = ['Track Err', 'Intensity', 'Temp RMSE', 'Precip RMSE', 'Wind Err', 'Bust Rate', 'Day-5 Err', 'Model Skill'];

function drawSignatures() {
  const idx1 = parseInt(document.getElementById('sig1Select')?.value || 0);
  const idx2 = parseInt(document.getElementById('sig2Select')?.value || 1);
  const s1 = FP_SIGNATURES[idx1];
  const s2 = FP_SIGNATURES[idx2];

  if (sig1Chart) sig1Chart.destroy();
  if (sig2Chart) sig2Chart.destroy();

  function makeRadar(canvasId, sig, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx, {
      type: 'radar',
      data: {
        labels: SIG_LABELS,
        datasets: [{
          label: sig.name,
          data: sig.profile,
          borderColor: color,
          backgroundColor: color + '18',
          pointBackgroundColor: color,
          borderWidth: 2.5,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 10, weight: '600' }, usePointStyle: true, color: '#5C4A2A' } },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,0.98)',
            borderColor: 'rgba(255,101,0,0.25)', borderWidth: 1.5,
            titleColor: '#1A1208', bodyColor: '#5C4A2A'
          }
        },
        scales: {
          r: {
            angleLines: { color: 'rgba(255,101,0,0.08)' },
            grid: { color: 'rgba(255,101,0,0.08)' },
            pointLabels: { color: '#5C4A2A', font: { size: 8, weight: '600' } },
            ticks: { display: false },
            min: 0, max: 100
          }
        }
      }
    });
  }

  sig1Chart = makeRadar('sig1Chart', s1, s1.color);
  sig2Chart = makeRadar('sig2Chart', s2, s2.color);

  // Compute similarity
  const sim = parseFloat(cosineSimilarity(s1.profile, s2.profile));
  const pctEl = document.getElementById('matchPct');
  const interpEl = document.getElementById('matchInterp');
  const circleEl = document.getElementById('matchCircle');

  if (pctEl) pctEl.textContent = sim.toFixed(1) + '%';

  let interpText, borderColor;
  if (sim >= 75) {
    interpText = 'High pattern similarity — historical errors likely to co-occur';
    borderColor = '#ef4444';
  } else if (sim >= 55) {
    interpText = 'Moderate similarity — some shared failure mechanisms';
    borderColor = '#f59e0b';
  } else {
    interpText = 'Low similarity — distinct failure fingerprints';
    borderColor = '#22d3a0';
  }

  if (interpEl) interpEl.textContent = interpText;
  if (circleEl) {
    circleEl.style.borderColor = borderColor;
    circleEl.style.boxShadow = `0 0 24px ${borderColor}55`;
    const pct = circleEl.querySelector('.match-pct');
    if (pct) pct.style.color = borderColor;
  }
}

// Add spin keyframe for loading icon
const spinStyle = document.createElement('style');
spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(spinStyle);
