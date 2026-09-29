/**
 * bust.js — Forecast Bust Probability Engine Dashboard
 * ForecastBustAI · Interactive meteorological analytics
 *
 * Architecture:
 *   State management → API layer → Map renderer → Chart renderers
 *
 * Backend: http://localhost:8001  (FastAPI Python)
 * Map:     Leaflet.js + India states GeoJSON
 * Charts:  Chart.js
 */

'use strict';

// Configurable Backend API Base (Works locally, via proxy, or deployed on Render)
const API_BASE = (typeof window !== 'undefined' && window.BUST_ENGINE_URL)
  ? window.BUST_ENGINE_URL.replace(/\/$/, '')
  : (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') ? '' : 'http://127.0.0.1:8001');
const INDIA_GEOJSON_URL = 'https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson';

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  leadDay:          1,
  forecastVariable: 'rainfall',
  weatherEvent:     'all',
  riskFilter:       'all',
  selectedRegion:   null,
  mapData:          null,
  geojsonLayer:     null,
  map:              null,
  charts:           {},
  loading:          false,
};

// ── State → GeoJSON mapping ───────────────────────────────────────────────
// Maps GeoJSON state name (ST_NM field) to IMD subdivision ID
const STATE_TO_SUB = {
  'Andaman & Nicobar Island': 'AN',
  'Andhra Pradesh':           'AP',
  'Arunachal Pradesh':        'ARP',
  'Assam':                    'ASS',
  'Bihar':                    'BIH',
  'Chandigarh':               'HAR',
  'Chhattisgarh':             'CHG',
  'Dadra and Nagar Haveli':   'GUJ',
  'Daman and Diu':            'SAU',
  'Delhi':                    'HAR',
  'Goa':                      'GOA',
  'Gujarat':                  'GUJ',
  'Haryana':                  'HAR',
  'Himachal Pradesh':         'HP',
  'Jammu & Kashmir':          'JAK',
  'Jharkhand':                'JHA',
  'Karnataka':                'NIO',
  'Kerala':                   'KER',
  'Lakshadweep':              'LAK',
  'Madhya Pradesh':           'WMP',
  'Maharashtra':              'KON',
  'Manipur':                  'MNP',
  'Meghalaya':                'ASS',
  'Mizoram':                  'MNP',
  'Nagaland':                 'NAG',
  'Odisha':                   'ORR',
  'Puducherry':               'TN',
  'Punjab':                   'PUN',
  'Rajasthan':                'RAJ',
  'Sikkim':                   'WB',
  'Tamil Nadu':               'TN',
  'Telangana':                'TEL',
  'Tripura':                  'MNP',
  'Uttar Pradesh':            'WUP',
  'Uttarakhand':              'UKD',
  'West Bengal':              'WB',
  'Ladakh':                   'JAK',
};

// ── Risk colours ──────────────────────────────────────────────────────────
function riskColor(prob) {
  if (prob < 0.25) return '#22C55E';
  if (prob < 0.45) return '#EAB308';
  if (prob < 0.65) return '#EA580C';
  return '#DC2626';
}
function riskLabel(prob) {
  if (prob < 0.25) return 'LOW';
  if (prob < 0.45) return 'MODERATE';
  if (prob < 0.65) return 'HIGH';
  return 'CRITICAL';
}
function riskBadgeStyle(level) {
  const map = {
    LOW:      'background:#DCFCE7;color:#16A34A;',
    MODERATE: 'background:#FEF9C3;color:#CA8A04;',
    HIGH:     'background:#FFEDD5;color:#EA580C;',
    CRITICAL: 'background:#FEE2E2;color:#DC2626;',
  };
  return map[level] || '';
}

// ── API helpers ───────────────────────────────────────────────────────────
async function apiGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${API_BASE}${path}${qs ? '?' + qs : ''}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`API ${resp.status}: ${url}`);
  return resp.json();
}

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initDayPills();
  initFilters();
  await initMap();
  await refreshAll();
  setInterval(refreshDataStatus, 60_000);
});

// ── Day Pills ─────────────────────────────────────────────────────────────
function initDayPills() {
  const container = document.getElementById('dayPills');
  if (!container) return;
  container.innerHTML = '';
  for (let d = 1; d <= 10; d++) {
    const btn = document.createElement('button');
    btn.className = `day-pill${d === 1 ? ' active' : ''}`;
    btn.textContent = d;
    btn.setAttribute('aria-label', `Day ${d}`);
    btn.addEventListener('click', () => selectDay(d));
    container.appendChild(btn);
  }
}

function selectDay(day) {
  state.leadDay = day;
  document.querySelectorAll('.day-pill').forEach((p, i) => {
    p.classList.toggle('active', i + 1 === day);
  });
  refreshMap();
  refreshKPI();
  refreshRanking();
  if (state.selectedRegion) refreshExplanation(state.selectedRegion);
}

// ── Filters ───────────────────────────────────────────────────────────────
function initFilters() {
  const varSel   = document.getElementById('varFilter');
  const eventSel = document.getElementById('eventFilter');
  const riskSel  = document.getElementById('riskFilter');
  const refBtn   = document.getElementById('refreshBtn');

  if (varSel)   varSel.addEventListener('change',   e => { state.forecastVariable = e.target.value; refreshAll(); });
  if (eventSel) eventSel.addEventListener('change', e => { state.weatherEvent      = e.target.value; refreshAll(); });
  if (riskSel)  riskSel.addEventListener('change',  e => { state.riskFilter        = e.target.value; refreshRanking(); });
  if (refBtn)   refBtn.addEventListener('click', () => { refBtn.classList.add('loading'); refreshAll().then(() => refBtn.classList.remove('loading')); });
}

// ── Master refresh ────────────────────────────────────────────────────────
async function refreshAll() {
  await Promise.allSettled([
    refreshDataStatus(),
    refreshKPI(),
    refreshMap(),
    refreshTimeline(),
    refreshRanking(),
  ]);
}

// ── Data Status Bar ───────────────────────────────────────────────────────
async function refreshDataStatus() {
  const bar = document.getElementById('statusChips');
  if (!bar) return;
  try {
    const data = await apiGet('/api/data-status');
    bar.innerHTML = '';
    data.data_sources.forEach(src => {
      const cls = src.status === 'LIVE' ? 'live' : src.status === 'DEGRADED' ? 'degraded' : 'unavailable';
      bar.innerHTML += `
        <span class="ds-chip ${cls}" title="${src.note}">
          <span class="ds-dot"></span>
          ${src.source_name}
        </span>`;
    });
    const el = document.getElementById('lastUpdated');
    if (el && data.last_updated) el.textContent = `Updated: ${new Date(data.last_updated).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })} IST`;
  } catch {
    if (bar) bar.innerHTML = '<span class="ds-chip unavailable"><span class="ds-dot"></span>Backend offline — start bust-engine/start.bat</span>';
  }
}

// ── KPI Cards ─────────────────────────────────────────────────────────────
async function refreshKPI() {
  const ids = ['kpiIndia','kpiHighReg','kpiMaxProb','kpiCritDay'];
  try {
    const d = await apiGet('/api/bust-probability', {
      lead_day: state.leadDay,
      forecast_variable: state.forecastVariable,
      weather_event: state.weatherEvent,
    });

    setKPI('kpiIndia',    d.india_risk_level,
      `${(d.india_avg_probability * 100).toFixed(0)}%`,
      'Avg. bust probability',
      `k-${d.india_risk_level.toLowerCase()}`);

    setKPI('kpiHighReg',  d.highest_risk_region,
      `${(d.max_bust_probability * 100).toFixed(0)}%`,
      'Max probability region',
      `k-${riskLabel(d.max_bust_probability).toLowerCase()}`);

    setKPI('kpiMaxProb', `${(d.max_bust_probability * 100).toFixed(0)}%`,
      riskLabel(d.max_bust_probability),
      'Highest region bust risk',
      `k-${riskLabel(d.max_bust_probability).toLowerCase()}`);

    setKPI('kpiCritDay',  `Day ${d.critical_lead_day}`,
      `${d.total_high_risk_regions} regions HIGH+`,
      'First critical lead day',
      'k-navy');

    // Card accent colour
    ids.forEach(id => {
      const card = document.getElementById(id);
      if (card) {
        card.className = card.className.replace(/k-\S+/g, '');
        if (id === 'kpiIndia')   card.classList.add(`k-${d.india_risk_level.toLowerCase()}`);
        if (id === 'kpiHighReg') card.classList.add(`k-${riskLabel(d.max_bust_probability).toLowerCase()}`);
        if (id === 'kpiMaxProb') card.classList.add(`k-${riskLabel(d.max_bust_probability).toLowerCase()}`);
        if (id === 'kpiCritDay') card.classList.add('k-navy');
      }
    });
  } catch {
    ids.forEach(id => setKPIError(id));
  }
}

function setKPI(id, value, sub1, sub2, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('.kpi-value').textContent = value;
  el.querySelector('.kpi-sub').textContent   = `${sub1} · ${sub2}`;
}
function setKPIError(id) {
  const el = document.getElementById(id);
  if (el) el.querySelector('.kpi-value').textContent = '—';
}

// ── Leaflet Map ───────────────────────────────────────────────────────────
async function initMap() {
  state.map = L.map('bust-map', {
    center: [22.5, 82.5],
    zoom: 4.5,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CartoDB',
    subdomains: 'abcd',
    maxZoom: 10,
    minZoom: 3,
  }).addTo(state.map);
}

async function refreshMap() {
  showMapLoading(true);
  try {
    const [mapData, geojson] = await Promise.all([
      apiGet('/api/bust-probability/map', {
        lead_day: state.leadDay,
        forecast_variable: state.forecastVariable,
        weather_event: state.weatherEvent,
      }),
      fetchGeoJSON(),
    ]);

    state.mapData = mapData;

    // Build lookup: region_id → estimate
    const regionMap = {};
    mapData.regions.forEach(r => { regionMap[r.region_id] = r; });

    // Remove old layer
    if (state.geojsonLayer) { state.geojsonLayer.remove(); state.geojsonLayer = null; }

    state.geojsonLayer = L.geoJSON(geojson, {
      style: feature => {
        const stateName = feature.properties.ST_NM || feature.properties.NAME_1 || '';
        const subId     = STATE_TO_SUB[stateName];
        const region    = subId ? regionMap[subId] : null;
        const prob      = region ? region.bust_probability : 0.15;
        return {
          fillColor:   riskColor(prob),
          fillOpacity: 0.65,
          color:       '#1E293B',
          weight:      0.8,
          opacity:     0.6,
        };
      },
      onEachFeature: (feature, layer) => {
        const stateName = feature.properties.ST_NM || feature.properties.NAME_1 || '';
        const subId     = STATE_TO_SUB[stateName];
        const region    = subId ? regionMap[subId] : null;

        if (region) {
          const pct = (region.bust_probability * 100).toFixed(0);
          layer.bindTooltip(`
            <div class="bust-tooltip">
              <div class="tt-name">${region.region_name}</div>
              <div class="tt-row"><span class="tt-key">Day</span><span class="tt-val">${region.lead_day}</span></div>
              <div class="tt-row"><span class="tt-key">Bust Probability</span><span class="tt-val">${pct}%</span></div>
              <div class="tt-row"><span class="tt-key">Ensemble Spread</span><span class="tt-val">${(region.ensemble_spread_norm * 100).toFixed(0)}%</span></div>
              <div class="tt-row"><span class="tt-key">Main Risk Driver</span><span class="tt-val">${region.primary_risk_driver}</span></div>
              <div class="tt-row"><span class="tt-key">Data Source</span><span class="tt-val">${region.data_source}</span></div>
              <span class="tt-risk" style="${riskBadgeStyle(region.risk_level)}">${region.risk_level}</span>
            </div>`, { sticky: true, className: '' });

          layer.on('click', () => {
            state.selectedRegion = subId;
            refreshExplanation(subId);
            highlightLayer(layer, region.bust_probability);
          });

          layer.on('mouseover', () => {
            layer.setStyle({ weight: 2, fillOpacity: 0.80 });
          });
          layer.on('mouseout', () => {
            if (state.selectedRegion !== subId) {
              const prob2 = region.bust_probability;
              layer.setStyle({ weight: 0.8, fillOpacity: 0.65, fillColor: riskColor(prob2) });
            }
          });
        }
      },
    }).addTo(state.map);

    // Update freshness badge
    const freshEl = document.getElementById('mapFreshness');
    if (freshEl) {
      freshEl.textContent = `Data: ${mapData.data_freshness}`;
      freshEl.className   = `ds-chip ${mapData.data_freshness === 'LIVE' ? 'live' : 'degraded'}`;
    }

  } catch (err) {
    console.error('[BustEngine] Map error:', err);
    showMapError(err.message);
  } finally {
    showMapLoading(false);
  }
}

let _geojsonCache = null;
async function fetchGeoJSON() {
  if (_geojsonCache) return _geojsonCache;
  const resp = await fetch(INDIA_GEOJSON_URL);
  if (!resp.ok) throw new Error('Failed to load India GeoJSON');
  _geojsonCache = await resp.json();
  return _geojsonCache;
}

function highlightLayer(layer, prob) {
  layer.setStyle({ weight: 2.5, fillOpacity: 0.85, color: '#0F172A' });
}

function showMapLoading(show) {
  const el = document.getElementById('mapLoading');
  if (el) el.style.display = show ? 'flex' : 'none';
}
function showMapError(msg) {
  const el = document.getElementById('mapError');
  if (el) { el.style.display = 'flex'; el.querySelector('.map-loading-text').textContent = msg || 'Backend offline'; }
}

// ── Explanation Panel ─────────────────────────────────────────────────────
async function refreshExplanation(regionId) {
  const body = document.getElementById('expBody');
  if (!body) return;
  body.innerHTML = '<div class="loading-placeholder"><div class="mini-spinner"></div> Loading explanation…</div>';

  try {
    const d = await apiGet(`/api/bust-probability/explanations/${regionId}`, {
      lead_day: state.leadDay,
      forecast_variable: state.forecastVariable,
      weather_event: state.weatherEvent,
    });

    const pct   = (d.bust_probability * 100).toFixed(0);
    const color = riskColor(d.bust_probability);

    // Update header
    document.getElementById('expRegionName').textContent = d.region_name;
    document.getElementById('expRegionSub').textContent  = `Day ${d.lead_day} · ${state.forecastVariable}`;
    document.getElementById('expProbValue').textContent  = `${pct}%`;
    document.getElementById('expProbValue').style.color  = color;

    // Factor bars
    const factors = d.factors;
    const factorNames = {
      lead_time_uncertainty:          'Lead-time Uncertainty',
      historical_failure_similarity:  'Historical Error Similarity',
      ensemble_spread:                'Ensemble Spread',
      forecast_divergence:            'Model Divergence',
      weather_event_complexity:       'Event Complexity',
      run_to_run_instability:         'Run-to-Run Instability',
      orography_complexity:           'Orography Complexity',
    };
    const factorBars = Object.entries(factors).map(([key, val]) => `
      <div class="rf-row">
        <div class="rf-label-row">
          <span class="rf-name">${factorNames[key] || key}</span>
          <span class="rf-pct">${(val * 100).toFixed(0)}%</span>
        </div>
        <div class="rf-bar-track">
          <div class="rf-bar-fill" style="width:${(val * 100).toFixed(1)}%; background:${color};"></div>
        </div>
      </div>`).join('');

    body.innerHTML = `
      <div class="risk-factors-section">
        <div class="rf-title">Risk Factor Breakdown</div>
        ${factorBars}
      </div>
      <div class="exp-summary">${d.summary}</div>
      <div class="exp-summary" style="border-left-color:#64748B; background:#F8FAFC; font-size:0.72rem;">${d.historical_context}</div>
      <div class="exp-disclaimer">⚠ ${d.confidence_note}</div>
      <div style="font-size:0.68rem;color:#64748B;margin-top:4px;">
        Sources: ${d.data_sources_used.join(' · ')}
      </div>`;

    // Also refresh the region timeline chart
    refreshTimeline(regionId);
  } catch (err) {
    body.innerHTML = `<div class="error-state">Failed to load explanation. Is the bust-engine running?<br><small>${err.message}</small></div>`;
  }
}

// ── Timeline Chart ────────────────────────────────────────────────────────
async function refreshTimeline(regionId = 'all') {
  const wrap = document.getElementById('timelineChartWrap');
  if (!wrap) return;
  try {
    const d = await apiGet('/api/bust-probability/timeline', {
      region_id: regionId,
      forecast_variable: state.forecastVariable,
      weather_event: state.weatherEvent,
    });

    const days   = d.timeline.map(t => `D${t.lead_day}`);
    const probs  = d.timeline.map(t => +(t.bust_probability * 100).toFixed(1));
    const confs  = d.timeline.map(t => +(t.confidence * 100).toFixed(1));
    const avgP   = d.india_average.map(t => +(t.bust_probability * 100).toFixed(1));
    const colors = d.timeline.map(t => riskColor(t.bust_probability));

    renderTimelineChart(days, probs, avgP, colors, d.region_name);
  } catch (err) {
    if (wrap) wrap.innerHTML = `<div class="error-state" style="margin:10px">Timeline unavailable: ${err.message}</div>`;
  }
}

function renderTimelineChart(days, probs, avgProbs, colors, regionName) {
  const canvas = document.getElementById('timelineChart');
  if (!canvas) return;
  if (state.charts.timeline) { state.charts.timeline.destroy(); }

  state.charts.timeline = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        {
          label: regionName || 'Selected Region',
          data: probs,
          backgroundColor: colors.map(c => c + 'CC'),
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 4,
          order: 2,
        },
        {
          label: 'India Average',
          data: avgProbs,
          type: 'line',
          borderColor: '#0F172A',
          borderWidth: 1.5,
          pointRadius: 3,
          pointBackgroundColor: '#0F172A',
          fill: false,
          tension: 0.4,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { size: 10, family: 'Inter' }, boxWidth: 10, padding: 10 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}%`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 10, family: 'Inter' } },
        },
        y: {
          min: 0, max: 100,
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { font: { size: 10, family: 'Inter' }, callback: v => `${v}%` },
          title: { display: true, text: 'Bust Probability (%)', font: { size: 9, family: 'Inter' }, color: '#64748B' },
        },
      },
    },
  });
}

// ── Risk Ranking Table ────────────────────────────────────────────────────
async function refreshRanking() {
  const tbody = document.getElementById('rankingBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="loading-placeholder"><div class="mini-spinner"></div> Loading…</td></tr>';

  try {
    const d = await apiGet('/api/bust-probability/regions', {
      lead_day: state.leadDay,
      forecast_variable: state.forecastVariable,
      weather_event: state.weatherEvent,
      limit: 15,
      risk_level_filter: state.riskFilter,
    });

    if (d.regions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:12px;color:#64748B;font-size:0.75rem;">No regions match filter.</td></tr>';
      return;
    }

    tbody.innerHTML = d.regions.map(r => {
      const pct   = (r.bust_probability * 100).toFixed(0);
      const barW  = pct;
      const barC  = riskColor(r.bust_probability);
      return `
        <tr onclick="selectRegionFromTable('${r.region_id}')" title="Click for detail">
          <td class="rank-num">${r.rank}</td>
          <td class="region-name">${r.region_name}</td>
          <td>
            <span style="font-family:var(--mono);font-size:0.72rem;font-weight:600;">${pct}%</span>
            <div class="prob-bar-mini" style="width:${barW}%;background:${barC};"></div>
          </td>
          <td><span class="risk-badge" style="${riskBadgeStyle(r.risk_level)}">${r.risk_level}</span></td>
          <td style="font-size:0.68rem;color:#64748B;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.primary_driver}">${r.primary_driver}</td>
        </tr>`;
    }).join('');

    renderErrorTrendChart(d.regions);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error-state">Ranking unavailable: ${err.message}</td></tr>`;
  }
}

function selectRegionFromTable(regionId) {
  state.selectedRegion = regionId;
  refreshExplanation(regionId);
}

// ── Error Trend Chart ─────────────────────────────────────────────────────
function renderErrorTrendChart(regions) {
  const canvas = document.getElementById('errorTrendChart');
  if (!canvas) return;
  if (state.charts.errorTrend) { state.charts.errorTrend.destroy(); }

  const top8 = regions.slice(0, 8);
  const labels = top8.map(r => r.region_name.split(' ').slice(0, 2).join(' '));
  const probs  = top8.map(r => +(r.bust_probability * 100).toFixed(1));
  const colors = top8.map(r => riskColor(r.bust_probability));

  state.charts.errorTrend = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Bust Probability (%)',
        data: probs,
        backgroundColor: colors.map(c => c + 'BB'),
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 4,
        indexAxis: 'y',
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.parsed.x}%` },
        },
      },
      scales: {
        x: {
          min: 0, max: 100,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { size: 9, family: 'Inter' }, callback: v => `${v}%` },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 9, family: 'Inter' } },
        },
      },
    },
  });
}

// ── Probability Distribution Chart ────────────────────────────────────────
async function renderProbDistChart() {
  const canvas = document.getElementById('probDistChart');
  if (!canvas || !state.mapData) return;
  if (state.charts.probDist) { state.charts.probDist.destroy(); }

  const probs  = state.mapData.regions.map(r => r.bust_probability);
  const bins   = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const counts = new Array(bins.length - 1).fill(0);
  const binColors = bins.slice(0, -1).map(b => riskColor(b + 0.05));

  probs.forEach(p => {
    const idx = Math.min(Math.floor(p * 10), 9);
    counts[idx]++;
  });

  state.charts.probDist = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: bins.slice(0, -1).map((b, i) => `${(b * 100).toFixed(0)}–${(bins[i + 1] * 100).toFixed(0)}%`),
      datasets: [{
        label: 'Regions',
        data: counts,
        backgroundColor: binColors.map(c => c + 'BB'),
        borderColor: binColors,
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} regions` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 8, family: 'Inter' }, maxRotation: 45 } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 9, family: 'Inter' }, stepSize: 1 },
             title: { display: true, text: 'Regions', font: { size: 9, family: 'Inter' }, color: '#64748B' } },
      },
    },
  });
}

// Render prob dist after map loads
const origRefreshMap = refreshMap;
refreshMap = async function() {
  await origRefreshMap();
  if (state.mapData) renderProbDistChart();
};
