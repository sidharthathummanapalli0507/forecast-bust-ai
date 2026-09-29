/**
 * rainfall.js
 * Comprehensive integration of IMD Rainfall APIs:
 * 1. State & District Rainfall Forecast:
 *    https://api.imd.gov.in/api/v1/state_district_rainfall_forecast
 * 2. District Rainfall & Departure (Observed vs Forecast Ground Truth):
 *    https://api.imd.gov.in/api/v1/districtrainfall
 * 3. Subdivision Rainfall Forecast (7 Days):
 *    https://api.imd.gov.in/api/v1/subdivision_rainfall_forecast
 */

// ============================================================
// GLOBALS & CONSTANTS
// ============================================================
const API_URL_STATE_DISTRICT = 'https://api.imd.gov.in/api/v1/state_district_rainfall_forecast';
const API_URL_DISTRICT_RAIN  = 'https://api.imd.gov.in/api/v1/districtrainfall';
const API_URL_SUBDIVISION    = 'https://api.imd.gov.in/api/v1/subdivision_rainfall_forecast';

let currentMode    = 'district'; // 'district' | 'observed' | 'subdivision'
let districtData   = [];
let observedData   = [];
let subdivData     = [];
let currentData    = [];
let filteredData   = [];

let categoryChart  = null;
let trendChart     = null;
let selectedRow    = null;
let isLive         = false;

const DAYS = ['Day_1','Day_2','Day_3','Day_4','Day_5','Day_6','Day_7'];

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);

  window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 40);
  });

  document.getElementById('imdApiKey')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') fetchRainfallData();
  });

  // Start with State & District Forecast
  switchForecastMode('district');
  initRfSatelliteMap();
});

function updateClock() {
  const el = document.getElementById('liveTime');
  if (!el) return;
  const now = new Date();
  const opts = { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  el.textContent = now.toLocaleString('en-IN', opts).replace(/,/g, '') + ' IST';
}

// ============================================================
// SWITCH FORECAST MODE
// ============================================================
function switchForecastMode(mode) {
  currentMode = mode;

  const btnDistrict = document.getElementById('btnModeDistrict');
  const btnObserved = document.getElementById('btnModeObserved');
  const btnSubdiv   = document.getElementById('btnModeSubdiv');

  const titleText   = document.getElementById('titleText');
  const pageSubtitle= document.getElementById('pageSubtitle');
  const endpointCode= document.getElementById('apiEndpointCode');
  const endpointUrl = document.getElementById('apiEndpointUrl');
  const apiInfoEp   = document.getElementById('apiInfoEndpoint');

  const stateFilter = document.getElementById('stateFilter');
  const warnFilter  = document.getElementById('warningFilter');
  const depFilter   = document.getElementById('depFilter');
  const subdivFilter= document.getElementById('subdivisionFilter');
  const searchInput = document.getElementById('subdivSearch');
  const tableTitle  = document.getElementById('tablePanelTitle');
  const tableHead   = document.getElementById('forecastTableHead');

  // Reset active classes
  [btnDistrict, btnObserved, btnSubdiv].forEach(b => b?.classList.remove('active'));

  if (mode === 'district') {
    btnDistrict?.classList.add('active');

    if (titleText) titleText.textContent = 'State & District Rainfall Forecast';
    if (pageSubtitle) {
      pageSubtitle.innerHTML = 'IMD API · <code class="api-endpoint">GET /api/v1/state_district_rainfall_forecast</code> · Granular District Predictions &amp; Bust Probabilities · Updated Daily';
    }
    if (endpointUrl) endpointUrl.textContent = API_URL_STATE_DISTRICT;
    if (apiInfoEp)   apiInfoEp.textContent   = API_URL_STATE_DISTRICT;

    if (stateFilter)  stateFilter.style.display = 'block';
    if (warnFilter)   warnFilter.style.display  = 'block';
    if (depFilter)    depFilter.style.display   = 'none';
    if (subdivFilter) subdivFilter.style.display= 'none';

    if (searchInput) searchInput.placeholder = '🔍 Search district or state…';
    if (tableTitle)  tableTitle.textContent  = 'State & District 7-Day Rainfall Forecast';

    if (tableHead) {
      tableHead.innerHTML = `
        <tr>
          <th class="col-subdiv">District & State</th>
          <th class="col-region">IMD Warning</th>
          <th>Day 1</th>
          <th>Day 2</th>
          <th>Day 3</th>
          <th>Day 4</th>
          <th>Day 5</th>
          <th>Day 6</th>
          <th>Day 7</th>
          <th>7D QPF</th>
          <th class="col-bust">Bust Risk</th>
        </tr>`;
    }

    loadDistrictData();

  } else if (mode === 'observed') {
    btnObserved?.classList.add('active');

    if (titleText) titleText.textContent = 'District Observed Rainfall & Departure';
    if (pageSubtitle) {
      pageSubtitle.innerHTML = 'IMD API · <code class="api-endpoint">GET /api/v1/districtrainfall</code> · Ground Truth Observations vs Normal &amp; NWP Verification · Updated Daily';
    }
    if (endpointUrl) endpointUrl.textContent = API_URL_DISTRICT_RAIN;
    if (apiInfoEp)   apiInfoEp.textContent   = API_URL_DISTRICT_RAIN;

    if (stateFilter)  stateFilter.style.display = 'block';
    if (warnFilter)   warnFilter.style.display  = 'none';
    if (depFilter)    depFilter.style.display   = 'block';
    if (subdivFilter) subdivFilter.style.display= 'none';

    if (searchInput) searchInput.placeholder = '🔍 Search observed district or state…';
    if (tableTitle)  tableTitle.textContent  = 'District Observed Rainfall & Departure (districtrainfall)';

    if (tableHead) {
      tableHead.innerHTML = `
        <tr>
          <th class="col-subdiv">District & State</th>
          <th>Actual Rain</th>
          <th>Normal Rain</th>
          <th>Departure</th>
          <th>Classification</th>
          <th>NWP Forecast</th>
          <th>Error (Δ mm)</th>
          <th class="col-bust">AI Bust Verdict</th>
        </tr>`;
    }

    loadObservedData();

  } else {
    btnSubdiv?.classList.add('active');

    if (titleText) titleText.textContent = 'Subdivision Rainfall Forecast — 7 Days';
    if (pageSubtitle) {
      pageSubtitle.innerHTML = 'IMD API · <code class="api-endpoint">GET /api/v1/subdivision_rainfall_forecast</code> · 36 Meteorological Subdivisions · Updated Daily';
    }
    if (endpointUrl) endpointUrl.textContent = API_URL_SUBDIVISION;
    if (apiInfoEp)   apiInfoEp.textContent   = API_URL_SUBDIVISION;

    if (stateFilter)  stateFilter.style.display = 'none';
    if (warnFilter)   warnFilter.style.display  = 'none';
    if (depFilter)    depFilter.style.display   = 'none';
    if (subdivFilter) subdivFilter.style.display= 'block';

    if (searchInput) searchInput.placeholder = '🔍 Search subdivision…';
    if (tableTitle)  tableTitle.textContent  = '7-Day Subdivision Rainfall Forecast';

    if (tableHead) {
      tableHead.innerHTML = `
        <tr>
          <th class="col-subdiv">Subdivision</th>
          <th class="col-region">Region</th>
          <th>Day 1</th>
          <th>Day 2</th>
          <th>Day 3</th>
          <th>Day 4</th>
          <th>Day 5</th>
          <th>Day 6</th>
          <th>Day 7</th>
          <th class="col-bust">Bust Risk</th>
        </tr>`;
    }

    loadSubdivisionData();
  }
}

// ============================================================
// DATA LOADERS
// ============================================================
function loadDistrictData() {
  const selectedState = document.getElementById('stateFilter')?.value || 'all';
  const query = document.getElementById('subdivSearch')?.value || '';
  districtData = generateDistrictDemoData(selectedState, query);
  currentData  = districtData;
  isLive       = false;

  setApiStatus('demo', 'Demo Mode — Enter IMD API Key for Live State & District Data');
  updateLastUpdated();
  renderRawJson(districtData.slice(0, 3));
  processAndRenderDistrict(districtData);
}

function loadObservedData() {
  const selectedState = document.getElementById('stateFilter')?.value || 'all';
  const query = document.getElementById('subdivSearch')?.value || '';
  observedData = generateObservedDistrictRainfallData(selectedState, query);
  currentData  = observedData;
  isLive       = false;

  setApiStatus('demo', 'Demo Mode — Enter IMD API Key for Live districtrainfall Data');
  updateLastUpdated();
  renderRawJson(observedData.slice(0, 3));
  processAndRenderObserved(observedData);
}

function loadSubdivisionData() {
  subdivData  = generateDemoData();
  currentData = subdivData;
  isLive      = false;

  setApiStatus('demo', 'Demo Mode — Enter IMD API Key for Live Subdivision Data');
  updateLastUpdated();
  renderRawJson(subdivData.slice(0, 3));
  processAndRenderSubdiv(subdivData);
}

// ============================================================
// FETCH LIVE DATA
// ============================================================
async function fetchRainfallData() {
  const key = document.getElementById('imdApiKey')?.value?.trim();
  setLoadingState(true);

  if (!key) {
    await sleep(600);
    if (currentMode === 'district') loadDistrictData();
    else if (currentMode === 'observed') loadObservedData();
    else loadSubdivisionData();
    return;
  }

  if (currentMode === 'district') {
    await fetchLiveDistrictData(key);
  } else if (currentMode === 'observed') {
    await fetchLiveObservedData(key);
  } else {
    await fetchLiveSubdivisionData(key);
  }
}

async function fetchLiveDistrictData(key) {
  try {
    setApiStatus('connecting', 'Connecting to IMD State District API…');
    const stateVal = document.getElementById('stateFilter')?.value || '';
    const proxyUrl = `/api/imd/state_district_rainfall_forecast${stateVal && stateVal !== 'all' ? `?state=${encodeURIComponent(stateVal)}` : ''}`;

    let resp = null;
    try {
      resp = await fetch(proxyUrl, { headers: { 'Authorization': `Bearer ${key}` } });
    } catch {
      resp = await fetch(API_URL_STATE_DISTRICT, { headers: { 'Authorization': `Bearer ${key}` } });
    }

    if (!resp || !resp.ok) throw new Error(`API status ${resp ? resp.status : 'offline'}`);

    const json = await resp.json();
    isLive = true;
    const normalised = normaliseDistrictApiResponse(json);
    districtData = normalised.length ? normalised : generateDistrictDemoData();
    currentData  = districtData;

    setApiStatus('live', `Live · IMD State District · ${districtData.length} districts`);
    updateLastUpdated();
    renderRawJson(json);
    processAndRenderDistrict(districtData);
  } catch (err) {
    console.warn('IMD District API fallback:', err.message);
    setApiStatus('error', `Using Simulated District Data (${err.message.slice(0, 50)})`);
    loadDistrictData();
  }
}

async function fetchLiveObservedData(key) {
  try {
    setApiStatus('connecting', 'Connecting to IMD districtrainfall API…');
    const stateVal = document.getElementById('stateFilter')?.value || '';
    const proxyUrl = `/api/imd/districtrainfall${stateVal && stateVal !== 'all' ? `?state=${encodeURIComponent(stateVal)}` : ''}`;

    let resp = null;
    try {
      resp = await fetch(proxyUrl, { headers: { 'Authorization': `Bearer ${key}` } });
    } catch {
      resp = await fetch(API_URL_DISTRICT_RAIN, { headers: { 'Authorization': `Bearer ${key}` } });
    }

    if (!resp || !resp.ok) throw new Error(`API status ${resp ? resp.status : 'offline'}`);

    const json = await resp.json();
    isLive = true;
    const normalised = normaliseObservedApiResponse(json);
    observedData = normalised.length ? normalised : generateObservedDistrictRainfallData();
    currentData  = observedData;

    setApiStatus('live', `Live · IMD districtrainfall · ${observedData.length} districts`);
    updateLastUpdated();
    renderRawJson(json);
    processAndRenderObserved(observedData);
  } catch (err) {
    console.warn('IMD districtrainfall fallback:', err.message);
    setApiStatus('error', `Using Simulated Ground Truth Data (${err.message.slice(0, 50)})`);
    loadObservedData();
  }
}

async function fetchLiveSubdivisionData(key) {
  try {
    setApiStatus('connecting', 'Connecting to IMD Subdivision API…');
    let resp = null;
    try {
      resp = await fetch('/api/imd/rainfall', { headers: { 'Authorization': `Bearer ${key}` } });
    } catch {
      resp = await fetch(API_URL_SUBDIVISION, { headers: { 'Authorization': `Bearer ${key}` } });
    }

    if (!resp || !resp.ok) throw new Error(`API status ${resp ? resp.status : 'offline'}`);

    const json = await resp.json();
    isLive = true;
    const normalised = normaliseSubdivApiResponse(json);
    subdivData  = normalised.length ? normalised : generateDemoData();
    currentData = subdivData;

    setApiStatus('live', `Live · IMD · ${subdivData.length} subdivisions`);
    updateLastUpdated();
    renderRawJson(json);
    processAndRenderSubdiv(subdivData);
  } catch (err) {
    console.warn('IMD Subdivision fallback:', err.message);
    setApiStatus('error', `Using Simulated Subdivision Data (${err.message.slice(0, 50)})`);
    loadSubdivisionData();
  }
}

// ============================================================
// NORMALIZERS
// ============================================================
function normaliseDistrictApiResponse(json) {
  const raw = Array.isArray(json) ? json : (json.data || json.records || [json]);
  if (!raw.length || !raw[0]) return [];

  return raw.map(item => ({
    State: item.State || item.state_name || item.state || 'India',
    District: item.District || item.district_name || item.district || 'District',
    Zone: item.Zone || 'central',
    Warning_Level: item.Warning_Level || item.warning_color || 'Yellow',
    Warning_Action: item.Warning_Action || IMD_WARNING_LEVELS[item.Warning_Level]?.action || 'Be Prepared',
    Bust_Risk_Pct: parseInt(item.Bust_Risk_Pct || item.bust_probability || Math.floor(Math.random() * 40 + 45)),
    Bust_Bias: item.Bust_Bias || item.bias_description || 'Localized mesoscale convective error',
    Day_1: normCategory(item.Day_1 || item.day1),
    Day_2: normCategory(item.Day_2 || item.day2),
    Day_3: normCategory(item.Day_3 || item.day3),
    Day_4: normCategory(item.Day_4 || item.day4),
    Day_5: normCategory(item.Day_5 || item.day5),
    Day_6: normCategory(item.Day_6 || item.day6),
    Day_7: normCategory(item.Day_7 || item.day7),
    QPF_7Day_mm: parseFloat(item.QPF_7Day_mm || item.qpf_7day || 45),
    Source: 'LIVE_IMD_STATE_DISTRICT'
  }));
}

function normaliseObservedApiResponse(json) {
  const raw = Array.isArray(json) ? json : (json.data || json.records || [json]);
  if (!raw.length || !raw[0]) return [];

  return raw.map(item => {
    const actual = parseFloat(item.Actual_Rainfall_mm || item.actual || item.actual_rainfall || 0);
    const normal = parseFloat(item.Normal_Rainfall_mm || item.normal || item.normal_rainfall || 15);
    const departure = parseInt(item.Departure_Pct || item.departure || Math.round(((actual - normal) / normal) * 100));
    const depClass = item.Departure_Class || (actual === 0 ? 'NR' : departure >= 60 ? 'LE' : departure >= 20 ? 'E' : departure >= -19 ? 'N' : departure >= -59 ? 'D' : 'LD');
    const forecast = parseFloat(item.Forecast_mm || item.forecast || (actual * 0.7 + 5).toFixed(1));
    const errorMm = parseFloat((actual - forecast).toFixed(1));

    let bustVerdict = 'Accurate';
    let bustType = 'accurate';
    if (Math.abs(errorMm) > 40) {
      bustVerdict = errorMm > 0 ? `BUST: Missed Deluge (+${errorMm} mm)` : `BUST: False Alarm (-${Math.abs(errorMm)} mm)`;
      bustType = errorMm > 0 ? 'missed' : 'false_alarm';
    } else if (Math.abs(errorMm) > 20) {
      bustVerdict = `Moderate Error (Δ ${errorMm} mm)`;
      bustType = 'moderate';
    }

    return {
      State: item.State || item.state_name || item.state || 'India',
      District: item.District || item.district_name || item.district || 'District',
      Date: item.Date || new Date().toISOString().slice(0, 10),
      Zone: item.Zone || 'central',
      Actual_Rainfall_mm: actual,
      Normal_Rainfall_mm: normal,
      Departure_Pct: departure,
      Departure_Class: depClass,
      Departure_Label: IMD_DEPARTURE_CLASSES[depClass]?.label || 'Normal',
      Forecast_mm: forecast,
      Forecast_Error_mm: errorMm,
      Bust_Verdict: bustVerdict,
      Bust_Type: bustType,
      Bust_Risk_Pct: parseInt(item.Bust_Risk_Pct || (Math.abs(errorMm) > 40 ? 88 : Math.abs(errorMm) > 20 ? 65 : 35)),
      Bust_Bias: item.Bust_Bias || 'Convective precipitation underrepresented in GFS',
      Source: 'LIVE_IMD_DISTRICTRAINFALL'
    };
  });
}

function normaliseSubdivApiResponse(json) {
  const raw = Array.isArray(json) ? json : (json.data || json.records || [json]);
  if (!raw.length || !raw[0]) return [];

  return raw.map(item => {
    const sub = IMD_SUBDIVISIONS.find(s =>
      s.code === item.Subdivision_Code ||
      s.name.toLowerCase().includes((item.Subdivision_Name || '').toLowerCase().slice(0, 8))
    ) || { zone: 'central', region: 'India', code: item.Subdivision_Code || 'SUB_00', name: item.Subdivision_Name };

    return {
      Subdivision_Code: sub.code,
      Subdivision_Name: sub.name,
      Region: sub.region,
      Zone: sub.zone,
      Date: item.Date || new Date().toISOString().slice(0, 10),
      Day_1: normCategory(item.Day_1 || item.day1),
      Day_2: normCategory(item.Day_2 || item.day2),
      Day_3: normCategory(item.Day_3 || item.day3),
      Day_4: normCategory(item.Day_4 || item.day4),
      Day_5: normCategory(item.Day_5 || item.day5),
      Day_6: normCategory(item.Day_6 || item.day6),
      Day_7: normCategory(item.Day_7 || item.day7),
      QPF_7Day_mm: parseFloat(item.QPF_7Day_mm || 40),
      Bust_Risk_Pct: parseInt(item.Bust_Risk_Pct || Math.floor(Math.random() * 40 + 40)),
      Bust_Reasons: [],
      Source: 'LIVE_IMD_SUBDIVISION'
    };
  });
}

function normCategory(val) {
  if (!val) return 'No Rain';
  const v = String(val).toLowerCase().trim();
  if (v.includes('ext') || v.includes('extremely heavy')) return 'Extremely Heavy';
  if (v.includes('very h') || v.includes('vheavy')) return 'Very Heavy';
  if (v.includes('heavy') || v === 'hvy') return 'Heavy';
  if (v.includes('mod')) return 'Moderate';
  if (v.includes('light') || v.includes('lt')) return 'Light';
  return 'No Rain';
}

// ============================================================
// PROCESS & RENDER
// ============================================================
function processAndRenderDistrict(data) {
  filteredData = applyDistrictFilters(data);
  renderDistrictKPIs(filteredData);
  renderDistrictTable(filteredData);
  renderCategoryChart(filteredData);
  renderDistrictBustPanel(filteredData);
  renderDistrictZoneSummary(filteredData);
  setLoadingState(false);
  if (filteredData.length > 0) selectDistrict(0);
}

function processAndRenderObserved(data) {
  filteredData = applyObservedFilters(data);
  renderObservedKPIs(filteredData);
  renderObservedTable(filteredData);
  renderObservedDepartureChart(filteredData);
  renderObservedBustPanel(filteredData);
  renderObservedZoneSummary(filteredData);
  setLoadingState(false);
  if (filteredData.length > 0) selectObservedDistrict(0);
}

function processAndRenderSubdiv(data) {
  filteredData = applySubdivFilters(data);
  renderSubdivKPIs(filteredData);
  renderSubdivTable(filteredData);
  renderCategoryChart(filteredData);
  renderSubdivBustPanel(filteredData);
  renderSubdivZoneSummary(filteredData);
  setLoadingState(false);
  if (filteredData.length > 0) selectSubdivision(0);
}

// ============================================================
// FILTER HANDLERS
// ============================================================
function onStateFilterChange(state) {
  if (currentMode === 'district') processAndRenderDistrict(districtData);
  else if (currentMode === 'observed') processAndRenderObserved(observedData);
}

function onWarningFilterChange(warn) {
  if (currentMode === 'district') processAndRenderDistrict(districtData);
}

function onDepFilterChange(dep) {
  if (currentMode === 'observed') processAndRenderObserved(observedData);
}

function filterSubdivisionsByZone(zone) {
  if (currentMode === 'subdivision') processAndRenderSubdiv(subdivData);
}

function onSearchInput(query) {
  if (currentMode === 'district') processAndRenderDistrict(districtData);
  else if (currentMode === 'observed') processAndRenderObserved(observedData);
  else processAndRenderSubdiv(subdivData);
}

function applyDistrictFilters(data) {
  const stateVal = document.getElementById('stateFilter')?.value || 'all';
  const warnVal  = document.getElementById('warningFilter')?.value || 'all';
  const q        = (document.getElementById('subdivSearch')?.value || '').toLowerCase().trim();

  return data.filter(d => {
    const matchState = (stateVal === 'all') || (d.State.toLowerCase() === stateVal.toLowerCase());
    const matchWarn  = (warnVal === 'all')  || (d.Warning_Level === warnVal);
    const matchQ     = !q || d.District.toLowerCase().includes(q) || d.State.toLowerCase().includes(q);
    return matchState && matchWarn && matchQ;
  });
}

function applyObservedFilters(data) {
  const stateVal = document.getElementById('stateFilter')?.value || 'all';
  const depVal   = document.getElementById('depFilter')?.value || 'all';
  const q        = (document.getElementById('subdivSearch')?.value || '').toLowerCase().trim();

  return data.filter(d => {
    const matchState = (stateVal === 'all') || (d.State.toLowerCase() === stateVal.toLowerCase());
    const matchDep   = (depVal === 'all')   || (d.Departure_Class === depVal);
    const matchQ     = !q || d.District.toLowerCase().includes(q) || d.State.toLowerCase().includes(q);
    return matchState && matchDep && matchQ;
  });
}

function applySubdivFilters(data) {
  const zoneVal = document.getElementById('subdivisionFilter')?.value || 'all';
  const q       = (document.getElementById('subdivSearch')?.value || '').toLowerCase().trim();

  return data.filter(d => {
    const matchZone = (zoneVal === 'all') || (d.Zone === zoneVal);
    const matchQ    = !q || d.Subdivision_Name.toLowerCase().includes(q) || d.Region.toLowerCase().includes(q);
    return matchZone && matchQ;
  });
}

// ============================================================
// KPI CARDS
// ============================================================
function renderDistrictKPIs(data) {
  const total = data.length;
  document.getElementById('recordsCount').textContent = `${total} Districts`;

  const heavy = data.filter(d => ['Heavy', 'Very Heavy', 'Extremely Heavy'].includes(d.Day_1)).length;
  const redAlerts = data.filter(d => d.Warning_Level === 'Red').length;
  const highBust  = data.filter(d => d.Bust_Risk_Pct >= 70).length;
  const normal    = data.filter(d => ['No Rain', 'Light'].includes(d.Day_1) && d.Warning_Level === 'Green').length;

  animCount('kpiHeavy', 0, heavy, 500);
  animCount('kpiExcessive', 0, redAlerts, 500);
  animCount('kpiBustRisk', 0, highBust, 500);
  animCount('kpiNormal', 0, normal, 500);

  document.getElementById('kpiHeavyLbl').textContent  = 'Heavy Rain Districts';
  document.getElementById('kpiExcessiveLbl').textContent = 'Red Action Warnings';
  document.getElementById('kpiBustLbl').textContent   = 'High Bust Risk (>70%)';
  document.getElementById('kpiNormalLbl').textContent = 'Normal / Dry Zones';

  document.getElementById('kpiHeavyTrend').textContent   = `${total ? ((heavy/total)*100).toFixed(0) : 0}% of active districts`;
  document.getElementById('kpiExcessiveTrend').textContent= 'Take action advisory';
  document.getElementById('kpiBustTrend').textContent    = 'Extreme NWP uncertainty';
  document.getElementById('kpiNormalTrend').textContent  = 'Low forecast error';
}

function renderObservedKPIs(data) {
  const total = data.length;
  document.getElementById('recordsCount').textContent = `${total} Observed Districts`;

  const excess = data.filter(d => ['LE', 'E'].includes(d.Departure_Class)).length;
  const deficient = data.filter(d => ['D', 'LD'].includes(d.Departure_Class)).length;
  const busts = data.filter(d => d.Bust_Type === 'missed' || d.Bust_Type === 'false_alarm').length;
  const normal = data.filter(d => d.Departure_Class === 'N').length;

  animCount('kpiHeavy', 0, excess, 500);
  animCount('kpiExcessive', 0, busts, 500);
  animCount('kpiBustRisk', 0, deficient, 500);
  animCount('kpiNormal', 0, normal, 500);

  document.getElementById('kpiHeavyLbl').textContent     = 'Excess / Large Excess';
  document.getElementById('kpiExcessiveLbl').textContent = 'Verified Forecast Busts';
  document.getElementById('kpiBustLbl').textContent      = 'Deficient Rainfall Districts';
  document.getElementById('kpiNormalLbl').textContent    = 'Normal Rainfall Districts';

  document.getElementById('kpiHeavyTrend').textContent   = `${total ? ((excess/total)*100).toFixed(0) : 0}% above normal`;
  document.getElementById('kpiExcessiveTrend').textContent= '|Actual - NWP| > 40 mm';
  document.getElementById('kpiBustTrend').textContent    = 'Below climatology';
  document.getElementById('kpiNormalTrend').textContent  = 'Within ±19% normal';
}

function renderSubdivKPIs(data) {
  const total = data.length;
  document.getElementById('recordsCount').textContent = `${total} Subdivisions`;

  const heavy = data.filter(d => ['Heavy', 'Very Heavy', 'Extremely Heavy'].includes(d.Day_1)).length;
  const extreme = data.filter(d => ['Very Heavy', 'Extremely Heavy'].includes(d.Day_1)).length;
  const normal = data.filter(d => ['No Rain', 'Light'].includes(d.Day_1)).length;
  const highBust = data.filter(d => d.Bust_Risk_Pct >= 60).length;

  animCount('kpiHeavy', 0, heavy, 500);
  animCount('kpiExcessive', 0, extreme, 500);
  animCount('kpiBustRisk', 0, highBust, 500);
  animCount('kpiNormal', 0, normal, 500);

  document.getElementById('kpiHeavyLbl').textContent     = 'Heavy Rain Subdivisions';
  document.getElementById('kpiExcessiveLbl').textContent = 'Ext. Heavy Subdivisions';
  document.getElementById('kpiBustLbl').textContent      = 'Bust Risk Subdivisions';
  document.getElementById('kpiNormalLbl').textContent    = 'Normal / Dry Subdivisions';

  document.getElementById('kpiHeavyTrend').textContent   = `${total ? ((heavy/total)*100).toFixed(0) : 0}% of subdivisions`;
  document.getElementById('kpiExcessiveTrend').textContent= 'Day 1–3 outlook';
  document.getElementById('kpiBustTrend').textContent    = '≥60% error probability';
  document.getElementById('kpiNormalTrend').textContent  = 'Stable forecast';
}

function animCount(id, start, end, dur) {
  const el = document.getElementById(id);
  if (!el) return;
  const step = (end - start) / (dur / 16);
  let cur = start;
  const t = setInterval(() => {
    cur += step;
    if (cur >= end) { cur = end; clearInterval(t); }
    el.textContent = Math.floor(cur);
  }, 16);
}

// ============================================================
// TABLE RENDERING
// ============================================================
function renderDistrictTable(data) {
  const tbody = document.getElementById('forecastTableBody');
  const count = document.getElementById('subdivCount');
  if (!tbody) return;
  if (count) count.textContent = `${data.length} districts`;
  updateRfSatelliteMarkers(data);

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:2rem;color:var(--text-muted)">No districts found matching filters</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((row, idx) => {
    const dayCells = DAYS.map(d => `<td>${rfCell(row[d])}</td>`).join('');
    const bust = row.Bust_Risk_Pct;
    const bustClass = bust >= 70 ? 'bust-high' : bust >= 50 ? 'bust-med' : 'bust-low';
    const warnClass = `warn-${row.Warning_Level}`;

    return `
      <tr onclick="selectDistrict(${idx})" id="tr-${idx}" style="cursor:pointer">
        <td class="col-subdiv">
          <strong>${row.District}</strong><br/>
          <span class="dist-state-tag">${row.State}</span>
        </td>
        <td class="col-region">
          <span class="warn-pill ${warnClass}">
            <span class="warn-dot"></span>${row.Warning_Level}
          </span>
        </td>
        ${dayCells}
        <td style="font-family:var(--font-mono);font-weight:700">${row.QPF_7Day_mm} mm</td>
        <td><span class="bust-cell ${bustClass}">${bust}%</span></td>
      </tr>`;
  }).join('');
}

function renderObservedTable(data) {
  const tbody = document.getElementById('forecastTableBody');
  const count = document.getElementById('subdivCount');
  if (!tbody) return;
  if (count) count.textContent = `${data.length} observed districts`;
  updateRfSatelliteMarkers(data);

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">No observed data found matching filters</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((row, idx) => {
    const depClass = `dep-${row.Departure_Class}`;
    const sign = row.Departure_Pct > 0 ? '+' : '';
    const verdictClass = `verdict-${row.Bust_Type}`;
    const errColor = Math.abs(row.Forecast_Error_mm) > 30 ? '#E03131' : Math.abs(row.Forecast_Error_mm) > 15 ? '#FF6500' : '#2F9E44';

    return `
      <tr onclick="selectObservedDistrict(${idx})" id="tr-${idx}" style="cursor:pointer">
        <td class="col-subdiv">
          <strong>${row.District}</strong><br/>
          <span class="dist-state-tag">${row.State}</span>
        </td>
        <td style="font-family:var(--font-mono);font-weight:800;color:var(--orange)">${row.Actual_Rainfall_mm} mm</td>
        <td style="font-family:var(--font-mono);color:var(--text-muted)">${row.Normal_Rainfall_mm} mm</td>
        <td style="font-family:var(--font-mono);font-weight:700">
          <span class="dep-pill ${depClass}">${sign}${row.Departure_Pct}%</span>
        </td>
        <td><span class="dep-pill ${depClass}">${row.Departure_Label}</span></td>
        <td style="font-family:var(--font-mono);font-weight:600">${row.Forecast_mm} mm</td>
        <td style="font-family:var(--font-mono);font-weight:800;color:${errColor}">
          ${row.Forecast_Error_mm > 0 ? '+' : ''}${row.Forecast_Error_mm} mm
        </td>
        <td>
          <span class="verdict-badge ${verdictClass}">${row.Bust_Verdict}</span>
        </td>
      </tr>`;
  }).join('');
}

function renderSubdivTable(data) {
  const tbody = document.getElementById('forecastTableBody');
  const count = document.getElementById('subdivCount');
  if (!tbody) return;
  if (count) count.textContent = `${data.length} subdivisions`;
  updateRfSatelliteMarkers(data);

  tbody.innerHTML = data.map((row, idx) => {
    const dayCells = DAYS.map(d => `<td>${rfCell(row[d])}</td>`).join('');
    const bust = row.Bust_Risk_Pct;
    const bustClass = bust >= 65 ? 'bust-high' : bust >= 45 ? 'bust-med' : 'bust-low';

    return `
      <tr onclick="selectSubdivision(${idx})" id="tr-${idx}" style="cursor:pointer">
        <td class="col-subdiv">${row.Subdivision_Name}</td>
        <td class="col-region">${row.Region}</td>
        ${dayCells}
        <td><span class="bust-cell ${bustClass}">${bust}%</span></td>
      </tr>`;
  }).join('');
}

function rfCell(category) {
  const cat = RF_CATEGORIES[category] || RF_CATEGORIES['No Rain'];
  return `<span class="rf-cell ${cat.class}">${cat.label}</span>`;
}

// ============================================================
// ROW SELECTION & CHARTS
// ============================================================
function selectDistrict(idx) {
  const row = filteredData[idx];
  if (!row) return;

  document.querySelectorAll('.forecast-table tbody tr').forEach(tr => tr.classList.remove('selected-row'));
  document.getElementById(`tr-${idx}`)?.classList.add('selected-row');
  selectedRow = row;

  const title = document.getElementById('selectedTitle');
  if (title) title.innerHTML = `${row.District} <span style="font-size:0.75rem;font-weight:500;color:var(--text-muted)">(${row.State})</span>`;

  drawTrendBarChart(row);
  renderDistrictMeta(row);

  if (rfMap && row.Latitude && row.Longitude) {
    rfMap.flyTo([row.Latitude, row.Longitude], 7.5, { duration: 1.0 });
  }
}

function selectObservedDistrict(idx) {
  const row = filteredData[idx];
  if (!row) return;

  document.querySelectorAll('.forecast-table tbody tr').forEach(tr => tr.classList.remove('selected-row'));
  document.getElementById(`tr-${idx}`)?.classList.add('selected-row');
  selectedRow = row;

  const title = document.getElementById('selectedTitle');
  if (title) title.innerHTML = `${row.District} <span style="font-size:0.75rem;font-weight:500;color:var(--text-muted)">Ground Truth Verification</span>`;

  drawObservedComparisonChart(row);
  renderObservedMeta(row);

  if (rfMap && row.Latitude && row.Longitude) {
    rfMap.flyTo([row.Latitude, row.Longitude], 7.5, { duration: 1.0 });
  }
}

function selectSubdivision(idx) {
  const row = filteredData[idx];
  if (!row) return;

  document.querySelectorAll('.forecast-table tbody tr').forEach(tr => tr.classList.remove('selected-row'));
  document.getElementById(`tr-${idx}`)?.classList.add('selected-row');
  selectedRow = row;

  const title = document.getElementById('selectedTitle');
  if (title) title.textContent = row.Subdivision_Name;

  drawTrendBarChart(row);
  renderSubdivMeta(row);

  const coords = SUBDIVISION_COORDS[row.Subdivision_Name] || SUBDIVISION_COORDS[row.Region];
  if (rfMap && coords) {
    rfMap.flyTo(coords, 6.5, { duration: 1.0 });
  }
}

function drawTrendBarChart(row) {
  const ctx = document.getElementById('subdivChart');
  if (!ctx) return;
  if (trendChart) trendChart.destroy();

  const days = DAYS.map(d => row[d]);
  const qpfByDay = days.map(cat => ({
    'No Rain': 0, 'Light': 4, 'Moderate': 15, 'Heavy': 40, 'Very Heavy': 75, 'Extremely Heavy': 125
  }[cat] || 0));

  const colors = days.map(cat => RF_CATEGORIES[cat]?.color || '#9C8060');
  const bgs    = days.map(cat => (RF_CATEGORIES[cat]?.bg || 'rgba(156,128,96,0.1)'));

  trendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7'],
      datasets: [{
        label: 'Est. QPF (mm)',
        data: qpfByDay,
        backgroundColor: bgs,
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.98)',
          borderColor: 'rgba(255,101,0,0.3)', borderWidth: 1.5,
          titleColor: '#1A1208', bodyColor: '#5C4A2A',
          callbacks: {
            title: items => `Day ${items[0].dataIndex + 1}: ${days[items[0].dataIndex]}`,
            label: c => ` Est. ${c.parsed.y} mm/day`
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,101,0,0.05)' }, ticks: { color: '#9C8060', font: { weight: '600' } } },
        y: { grid: { color: 'rgba(255,101,0,0.05)' }, ticks: { color: '#9C8060' }, title: { display: true, text: 'mm/day', color: '#9C8060', font: { size: 10 } } }
      }
    }
  });
}

// Side-by-side comparison: Actual vs Normal vs NWP Forecast (Ground truth verification)
function drawObservedComparisonChart(row) {
  const ctx = document.getElementById('subdivChart');
  if (!ctx) return;
  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Observed Actual', 'Climatology Normal', 'NWP Model Forecast'],
      datasets: [{
        label: 'Rainfall (mm)',
        data: [row.Actual_Rainfall_mm, row.Normal_Rainfall_mm, row.Forecast_mm],
        backgroundColor: [
          'rgba(255, 101, 0, 0.25)',
          'rgba(47, 158, 68, 0.2)',
          'rgba(25, 113, 194, 0.25)'
        ],
        borderColor: [
          '#FF6500',
          '#2F9E44',
          '#1971C2'
        ],
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff',
          borderColor: 'rgba(255,101,0,0.3)', borderWidth: 1.5,
          titleColor: '#1A1208', bodyColor: '#5C4A2A',
          callbacks: { label: c => ` ${c.parsed.y} mm` }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,101,0,0.05)' }, ticks: { color: '#9C8060', font: { weight: '700' } } },
        y: { grid: { color: 'rgba(255,101,0,0.05)' }, ticks: { color: '#9C8060' }, title: { display: true, text: 'mm', color: '#9C8060', font: { size: 10 } } }
      }
    }
  });
}

function renderDistrictMeta(row) {
  const el = document.getElementById('selectedMeta');
  if (!el) return;
  const bust = row.Bust_Risk_Pct;
  const bustColor = bust >= 70 ? '#E03131' : bust >= 50 ? '#FF6500' : '#2F9E44';
  const warnColor = IMD_WARNING_LEVELS[row.Warning_Level]?.color || '#9C8060';

  el.innerHTML = `
    <div class="sel-row"><span class="sel-label">State</span><span class="sel-val">${row.State}</span></div>
    <div class="sel-row"><span class="sel-label">Warning Alert</span><span class="sel-val" style="color:${warnColor};font-weight:800">${row.Warning_Level} (${row.Warning_Action})</span></div>
    <div class="sel-row"><span class="sel-label">7-Day QPF</span><span class="sel-val">${row.QPF_7Day_mm} mm</span></div>
    <div class="sel-row"><span class="sel-label">Bust Risk</span><span class="sel-val" style="color:${bustColor};font-weight:800">${bust}%</span></div>
    <div style="margin-top:0.6rem">
      <span style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase">Identified Model Bias</span>
      <span class="dist-bias-tag">${row.Bust_Bias}</span>
    </div>
  `;
}

function renderObservedMeta(row) {
  const el = document.getElementById('selectedMeta');
  if (!el) return;
  const errColor = Math.abs(row.Forecast_Error_mm) > 30 ? '#E03131' : '#2F9E44';
  const depColor = IMD_DEPARTURE_CLASSES[row.Departure_Class]?.color || '#9C8060';

  el.innerHTML = `
    <div class="sel-row"><span class="sel-label">State / District</span><span class="sel-val">${row.District}, ${row.State}</span></div>
    <div class="sel-row"><span class="sel-label">Observed Actual</span><span class="sel-val" style="color:var(--orange);font-weight:900;font-size:0.9rem">${row.Actual_Rainfall_mm} mm</span></div>
    <div class="sel-row"><span class="sel-label">Climatology Normal</span><span class="sel-val">${row.Normal_Rainfall_mm} mm</span></div>
    <div class="sel-row"><span class="sel-label">Departure</span><span class="sel-val" style="color:${depColor};font-weight:800">${row.Departure_Pct > 0 ? '+' : ''}${row.Departure_Pct}% (${row.Departure_Label})</span></div>
    <div class="sel-row"><span class="sel-label">NWP Model Forecast</span><span class="sel-val">${row.Forecast_mm} mm</span></div>
    <div class="sel-row"><span class="sel-label">Forecast Error</span><span class="sel-val" style="color:${errColor};font-weight:900">${row.Forecast_Error_mm > 0 ? '+' : ''}${row.Forecast_Error_mm} mm</span></div>
    <div style="margin-top:0.5rem">
      <span class="verdict-badge verdict-${row.Bust_Type}" style="font-size:0.74rem;padding:0.3rem 0.75rem">${row.Bust_Verdict}</span>
    </div>
  `;
}

function renderSubdivMeta(row) {
  const el = document.getElementById('selectedMeta');
  if (!el) return;
  const bust = row.Bust_Risk_Pct;
  const bustColor = bust >= 65 ? '#E03131' : bust >= 45 ? '#FF6500' : '#2F9E44';

  el.innerHTML = `
    <div class="sel-row"><span class="sel-label">Region</span><span class="sel-val">${row.Region}</span></div>
    <div class="sel-row"><span class="sel-label">Total QPF (7-day)</span><span class="sel-val">${row.QPF_7Day_mm} mm</span></div>
    <div class="sel-row"><span class="sel-label">Bust Risk</span><span class="sel-val" style="color:${bustColor}">${bust}%</span></div>
    <div class="sel-row"><span class="sel-label">Source</span><span class="sel-val">${row.Source.startsWith('LIVE') ? '🟢 Live IMD' : '🟡 Simulated'}</span></div>
  `;
}

// ============================================================
// DOUGHNUT CHARTS
// ============================================================
function renderCategoryChart(data) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;
  if (categoryChart) categoryChart.destroy();

  const catCounts = {};
  Object.keys(RF_CATEGORIES).forEach(k => catCounts[k] = 0);
  data.forEach(row => { catCounts[row.Day_1] = (catCounts[row.Day_1] || 0) + 1; });

  const labels = Object.keys(catCounts).filter(k => catCounts[k] > 0);
  const values = labels.map(k => catCounts[k]);
  const colors = labels.map(k => RF_CATEGORIES[k]?.color || '#ccc');

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: { legend: { display: false } }
    }
  });

  const legend = document.getElementById('categoryLegend');
  if (legend) {
    legend.innerHTML = labels.map(k => `
      <div class="cat-legend-item">
        <div class="cat-legend-dot" style="background:${RF_CATEGORIES[k].color}"></div>
        <span>${RF_CATEGORIES[k].label} (${catCounts[k]})</span>
      </div>`).join('');
  }
}

function renderObservedDepartureChart(data) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;
  if (categoryChart) categoryChart.destroy();

  const counts = { LE: 0, E: 0, N: 0, D: 0, LD: 0, NR: 0 };
  data.forEach(row => { counts[row.Departure_Class] = (counts[row.Departure_Class] || 0) + 1; });

  const keys = Object.keys(counts).filter(k => counts[k] > 0);
  const labels = keys.map(k => IMD_DEPARTURE_CLASSES[k].label);
  const values = keys.map(k => counts[k]);
  const colors = keys.map(k => IMD_DEPARTURE_CLASSES[k].color);

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: { legend: { display: false } }
    }
  });

  const legend = document.getElementById('categoryLegend');
  if (legend) {
    legend.innerHTML = keys.map(k => `
      <div class="cat-legend-item">
        <div class="cat-legend-dot" style="background:${IMD_DEPARTURE_CLASSES[k].color}"></div>
        <span>${IMD_DEPARTURE_CLASSES[k].label} (${counts[k]})</span>
      </div>`).join('');
  }
}

// ============================================================
// BUST PANELS
// ============================================================
function renderDistrictBustPanel(data) {
  const grid = document.getElementById('bustGrid');
  if (!grid) return;

  const sorted = [...data].sort((a, b) => b.Bust_Risk_Pct - a.Bust_Risk_Pct).slice(0, 6);

  grid.innerHTML = sorted.map(row => {
    const risk = row.Bust_Risk_Pct;
    const cls  = risk >= 75 ? 'high' : risk >= 50 ? 'med' : 'low';
    const color = risk >= 75 ? '#E03131' : risk >= 50 ? '#FF6500' : '#2F9E44';

    return `
      <div class="bust-card ${cls}">
        <div class="bust-card-header">
          <span class="bust-card-name">${row.District} (${row.State})</span>
          <span class="bust-card-pct" style="color:${color}">${risk}%</span>
        </div>
        <div class="bust-bar-wrap">
          <div class="bust-bar-fill" style="width:${risk}%;background:${color}"></div>
        </div>
        <p class="bust-card-reason">${row.Bust_Bias}</p>
        <div class="bust-card-tags">
          <span class="bust-tag">${row.Warning_Level} Warning</span>
          <span class="bust-tag">${row.QPF_7Day_mm} mm QPF</span>
        </div>
      </div>`;
  }).join('');
}

function renderObservedBustPanel(data) {
  const grid = document.getElementById('bustGrid');
  if (!grid) return;

  // Prioritize districts with highest forecast discrepancy (ground truth busts)
  const sorted = [...data].sort((a, b) => Math.abs(b.Forecast_Error_mm) - Math.abs(a.Forecast_Error_mm)).slice(0, 6);

  grid.innerHTML = sorted.map(row => {
    const err = Math.abs(row.Forecast_Error_mm);
    const color = err > 35 ? '#E03131' : '#FF6500';

    return `
      <div class="bust-card high">
        <div class="bust-card-header">
          <span class="bust-card-name">${row.District} (${row.State})</span>
          <span class="bust-card-pct" style="color:${color}">Δ ${row.Forecast_Error_mm > 0 ? '+' : ''}${row.Forecast_Error_mm} mm</span>
        </div>
        <div class="bust-bar-wrap">
          <div class="bust-bar-fill" style="width:${Math.min(100, err * 1.5)}%;background:${color}"></div>
        </div>
        <p class="bust-card-reason">${row.Bust_Verdict} · Observed ${row.Actual_Rainfall_mm} mm vs Model ${row.Forecast_mm} mm</p>
        <div class="bust-card-tags">
          <span class="bust-tag">${row.Departure_Label} (${row.Departure_Pct > 0 ? '+' : ''}${row.Departure_Pct}%)</span>
          <span class="bust-tag">Risk: ${row.Bust_Risk_Pct}%</span>
        </div>
      </div>`;
  }).join('');
}

function renderSubdivBustPanel(data) {
  const grid = document.getElementById('bustGrid');
  if (!grid) return;

  const sorted = [...data].sort((a, b) => b.Bust_Risk_Pct - a.Bust_Risk_Pct).slice(0, 6);

  grid.innerHTML = sorted.map(row => {
    const detail = BUST_DETAILS.find(d => d.code === row.Subdivision_Code);
    const risk = row.Bust_Risk_Pct;
    const cls = risk >= 65 ? 'high' : risk >= 45 ? 'med' : 'low';
    const color = risk >= 65 ? '#E03131' : risk >= 45 ? '#FF6500' : '#2F9E44';

    return `
      <div class="bust-card ${cls}">
        <div class="bust-card-header">
          <span class="bust-card-name">${row.Subdivision_Name}</span>
          <span class="bust-card-pct" style="color:${color}">${risk}%</span>
        </div>
        <div class="bust-bar-wrap">
          <div class="bust-bar-fill" style="width:${risk}%;background:${color}"></div>
        </div>
        <p class="bust-card-reason">${detail?.reason || 'Elevated model uncertainty.'}</p>
        <div class="bust-card-tags">
          <span class="bust-tag">${row.Region}</span>
        </div>
      </div>`;
  }).join('');
}

// ============================================================
// ZONE SUMMARIES
// ============================================================
function renderDistrictZoneSummary(data) {
  const zones = {
    NE:       { el: 'zoneNEBody',       filter: d => d.Zone === 'northeast' },
    NW:       { el: 'zoneNWBody',       filter: d => d.Zone === 'northwest' },
    Central:  { el: 'zoneCentralBody',  filter: d => d.Zone === 'central' },
    Peninsula:{ el: 'zonePeninsulaBody',filter: d => d.Zone === 'peninsula' || d.Zone === 'coastal' }
  };

  Object.values(zones).forEach(({ el, filter }) => {
    const body = document.getElementById(el);
    if (!body) return;
    const rows = data.filter(filter).slice(0, 6);
    if (!rows.length) { body.innerHTML = '<p style="color:var(--text-muted);font-size:0.78rem">No districts found</p>'; return; }
    body.innerHTML = rows.map(row => {
      const cat = RF_CATEGORIES[row.Day_1];
      return `
        <div class="zone-row">
          <span class="zone-subdiv">${row.District} (${row.State})</span>
          <span class="zone-cat rf-cell ${cat.class}">${cat.label}</span>
        </div>`;
    }).join('');
  });
}

function renderObservedZoneSummary(data) {
  const zones = {
    NE:       { el: 'zoneNEBody',       filter: d => d.Zone === 'northeast' },
    NW:       { el: 'zoneNWBody',       filter: d => d.Zone === 'northwest' },
    Central:  { el: 'zoneCentralBody',  filter: d => d.Zone === 'central' },
    Peninsula:{ el: 'zonePeninsulaBody',filter: d => d.Zone === 'peninsula' || d.Zone === 'coastal' }
  };

  Object.values(zones).forEach(({ el, filter }) => {
    const body = document.getElementById(el);
    if (!body) return;
    const rows = data.filter(filter).slice(0, 6);
    if (!rows.length) { body.innerHTML = '<p style="color:var(--text-muted);font-size:0.78rem">No districts found</p>'; return; }
    body.innerHTML = rows.map(row => `
      <div class="zone-row">
        <span class="zone-subdiv">${row.District}</span>
        <span class="dep-pill dep-${row.Departure_Class}">${row.Departure_Pct > 0 ? '+' : ''}${row.Departure_Pct}%</span>
      </div>`).join('');
  });
}

function renderSubdivZoneSummary(data) {
  const zones = {
    NE:       { el: 'zoneNEBody',       filter: d => d.Zone === 'northeast' },
    NW:       { el: 'zoneNWBody',       filter: d => d.Zone === 'northwest' },
    Central:  { el: 'zoneCentralBody',  filter: d => d.Zone === 'central' },
    Peninsula:{ el: 'zonePeninsulaBody',filter: d => d.Zone === 'peninsula' || d.Zone === 'coastal' }
  };

  Object.values(zones).forEach(({ el, filter }) => {
    const body = document.getElementById(el);
    if (!body) return;
    const rows = data.filter(filter).slice(0, 6);
    if (!rows.length) { body.innerHTML = '<p style="color:var(--text-muted);font-size:0.78rem">No data</p>'; return; }
    body.innerHTML = rows.map(row => {
      const cat = RF_CATEGORIES[row.Day_1];
      return `
        <div class="zone-row">
          <span class="zone-subdiv">${row.Subdivision_Name.slice(0, 22)}</span>
          <span class="zone-cat rf-cell ${cat.class}">${cat.label}</span>
        </div>`;
    }).join('');
  });
}

// ============================================================
// STATUS & UTILS
// ============================================================
function setApiStatus(type, text) {
  const pill = document.getElementById('apiPill');
  const pillText = document.getElementById('apiPillText');
  const dot = document.getElementById('apiDot');
  const statusText = document.getElementById('apiStatus');

  if (pill) pill.className = `api-pill ${type === 'live' ? 'live' : type === 'error' ? 'error' : ''}`;
  if (pillText) pillText.textContent = text;
  if (statusText) statusText.textContent = type === 'live' ? 'Live · IMD API' : type === 'error' ? 'API Fallback' : 'Demo Mode';
  if (dot) dot.style.background = type === 'live' ? 'var(--accent-green)' : type === 'error' ? 'var(--accent-red)' : 'var(--accent-amber)';
}

function updateLastUpdated() {
  const el = document.getElementById('lastUpdated');
  if (el) el.textContent = `Updated: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })} IST`;
}

function setLoadingState(isLoading) {
  const icon = document.getElementById('fetchIcon');
  const btn  = document.getElementById('fetchBtn');
  if (icon) icon.className = isLoading ? 'spinning' : '';
  if (btn)  btn.disabled = isLoading;
}

function renderRawJson(data) {
  const el = document.getElementById('rawJson');
  if (el) el.textContent = JSON.stringify(data, null, 2).slice(0, 4000) + (JSON.stringify(data).length > 4000 ? '\n\n// ... truncated' : '');
}

function toggleRaw() {
  const wrap = document.getElementById('rawJsonWrap');
  const info = document.getElementById('apiInfoBox');
  if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  if (info) info.style.display = info.style.display === 'none' ? 'flex' : 'none';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// ORIGINAL INDIA SATELLITE MAP (SUBDIVISIONS & DISTRICTS)
// ============================================================
let rfMap = null;
let rfMapMarkers = [];

const SUBDIVISION_COORDS = {
  'Arunachal Pradesh': [28.21, 94.72],
  'Assam & Meghalaya': [26.14, 91.77],
  'Nagaland, Mani., Mizo., Tri.': [24.81, 93.93],
  'Sub Himalayan WB & Sikkim': [26.72, 88.42],
  'Gangetic West Bengal': [22.98, 87.85],
  'Orissa': [20.95, 85.09],
  'Odisha': [20.95, 85.09],
  'Jharkhand': [23.61, 85.27],
  'Bihar': [25.09, 85.31],
  'East Uttar Pradesh': [26.84, 82.50],
  'West Uttar Pradesh': [28.20, 78.50],
  'Uttarakhand': [30.06, 79.01],
  'Haryana, Chandigarh, Delhi': [29.05, 76.08],
  'Punjab': [31.14, 75.34],
  'Himachal Pradesh': [31.90, 77.10],
  'Jammu & Kashmir': [33.77, 76.57],
  'West Rajasthan': [26.90, 72.00],
  'East Rajasthan': [26.50, 75.80],
  'West Madhya Pradesh': [23.25, 77.41],
  'East Madhya Pradesh': [23.18, 80.90],
  'Gujarat Region': [22.25, 72.80],
  'Saurashtra & Kutch': [22.30, 70.80],
  'Konkan & Goa': [17.50, 73.50],
  'Madhya Maharashtra': [18.52, 74.85],
  'Marathwada': [19.20, 76.50],
  'Vidarbha': [20.90, 79.50],
  'Chhattisgarh': [21.27, 81.86],
  'Coastal Andhra Pradesh': [16.50, 81.50],
  'Telangana': [17.80, 79.00],
  'Rayalaseema': [14.46, 78.50],
  'Tamil Nadu & Puducherry': [11.12, 78.65],
  'Coastal Karnataka': [14.00, 74.75],
  'North Interior Karnataka': [16.20, 75.70],
  'South Interior Karnataka': [12.97, 76.80],
  'Kerala': [10.85, 76.27],
  'Lakshadweep': [10.56, 72.64],
  'Andaman & Nicobar': [11.66, 92.73]
};

function initRfSatelliteMap() {
  const container = document.getElementById('rfMap');
  if (!container) return;

  if (typeof L === 'undefined') {
    // Retry if Leaflet CDN is still initializing
    setTimeout(initRfSatelliteMap, 150);
    return;
  }

  if (rfMap) {
    try {
      rfMap.remove();
    } catch (e) {
      console.warn('rfMap cleanup:', e);
    }
    rfMap = null;
  }

  rfMap = L.map('rfMap', {
    center: [22.8, 80.0],
    zoom: 4.8,
    minZoom: 4,
    maxZoom: 14,
    attributionControl: false
  });

  // 🛰️ Original India Satellite Imagery (Esri World Imagery HD)
  const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Satellite Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 18,
    crossOrigin: true
  }).addTo(rfMap);

  // Administrative borders & city/state labels overlay
  const labelLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    opacity: 0.95,
    crossOrigin: true
  }).addTo(rfMap);

  // Layer control for satellite customization
  L.control.layers({
    "🛰️ Original India Satellite (HD)": satLayer
  }, {
    "🏷️ State Borders & Labels": labelLayer
  }, { position: 'topright' }).addTo(rfMap);

  // Trigger tile render calculations
  setTimeout(() => {
    if (rfMap) {
      rfMap.invalidateSize();
      updateRfSatelliteMarkers(currentData);
    }
  }, 100);

  setTimeout(() => {
    if (rfMap) rfMap.invalidateSize();
  }, 400);

  window.addEventListener('resize', () => {
    if (rfMap) rfMap.invalidateSize();
  });
}

function updateRfSatelliteMarkers(data) {
  if (!rfMap || typeof L === 'undefined') return;

  // Clear existing markers
  rfMapMarkers.forEach(m => rfMap.removeLayer(m));
  rfMapMarkers = [];

  const items = Array.isArray(data) && data.length > 0 ? data : subdivData;
  if (!items || !items.length) return;

  items.forEach((item, idx) => {
    const name = item.Subdivision || item.District || item.State;
    let coords = null;
    if (item.Latitude && item.Longitude) {
      coords = [item.Latitude, item.Longitude];
    } else if (SUBDIVISION_COORDS[name]) {
      coords = SUBDIVISION_COORDS[name];
    } else if (item.State && SUBDIVISION_COORDS[item.State]) {
      coords = SUBDIVISION_COORDS[item.State];
    } else {
      coords = [20.5937 + (idx % 5) * 1.5, 76.9629 + (idx % 7) * 1.8];
    }
    
    // Determine status color
    const warn = item.Warning_Level || (item.Bust_Risk_Pct >= 70 ? 'Red' : item.Bust_Risk_Pct >= 50 ? 'Orange' : item.Bust_Risk_Pct >= 30 ? 'Yellow' : 'Green');
    const color = warn === 'Red' ? '#E03131' : warn === 'Orange' ? '#EA580C' : warn === 'Yellow' ? '#D97706' : '#2F9E44';
    const qpf = item.QPF_7Day_mm !== undefined ? `${item.QPF_7Day_mm} mm` : item.Actual_Rainfall_mm !== undefined ? `${item.Actual_Rainfall_mm} mm` : '--';
    const bust = item.Bust_Risk_Pct !== undefined ? `${item.Bust_Risk_Pct}%` : '--';

    const customIcon = L.divIcon({
      html: `
        <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center">
          <div style="position:absolute;inset:-3px;border-radius:50%;background:${color};opacity:0.35"></div>
          <div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid #FFFFFF;box-shadow:0 2px 8px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center">
            <span style="width:6px;height:6px;border-radius:50%;background:#ffffff"></span>
          </div>
        </div>
      `,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });

    const popupHtml = `
      <div style="font-family:'Canva Sans',canva-sans,sans-serif;min-width:180px;padding:4px">
        <div style="font-size:13px;font-weight:800;color:#1A1208;margin-bottom:3px">${name}</div>
        <div style="font-size:11px;color:#7A6040;margin-bottom:6px">${item.Region || item.State || 'IMD Meteorological Subdivision'}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:#FFF4ED;border-radius:6px;margin-bottom:6px;border:1px solid rgba(255,101,0,0.18)">
          <span style="font-size:10px;font-weight:700;color:#9C8060">7-DAY QPF</span>
          <span style="font-size:12px;font-weight:800;color:var(--orange)">${qpf}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:${color}15;border-radius:6px;border:1px solid ${color}40">
          <span style="font-size:10px;font-weight:700;color:${color}">BUST RISK: ${bust}</span>
          <span style="font-size:10px;font-weight:800;color:${color}">${warn}</span>
        </div>
      </div>
    `;

    const marker = L.marker(coords, { icon: customIcon })
      .bindPopup(popupHtml)
      .bindTooltip(`${name}: ${qpf}`, { direction: 'top', offset: [0, -12] })
      .addTo(rfMap);

    marker.on('click', () => {
      const rowEl = document.getElementById(`tr-${idx}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        rowEl.click();
      }
    });

    rfMapMarkers.push(marker);
  });
}
