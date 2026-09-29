/**
 * error_prone.js — Error-Prone Area Intelligence
 * FORECAST GUARDIAN · Real API Data Integration
 */

// Configurable Backend API Base (Works locally, via proxy, or deployed on Render)
const BUST_ENGINE_HOST = (typeof window !== 'undefined' && window.BUST_ENGINE_URL)
    ? window.BUST_ENGINE_URL.replace(/\/$/, '')
    : (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') ? '' : 'http://127.0.0.1:8001');
const API_BASE = `${BUST_ENGINE_HOST}/api/error-prone`;
const INDIA_GEOJSON_URL = 'https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson';

const state = {
    leadDay: 1,
    forecastVariable: 'rainfall',
    weatherEvent: 'all',
    selectedRegion: null,
    mapData: null,
    geojsonLayer: null,
    map: null,
    charts: {}
};

const STATE_TO_SUB = {
    'Andaman & Nicobar Island': 'AN', 'Andhra Pradesh': 'AP', 'Arunachal Pradesh': 'ARP',
    'Assam': 'ASS', 'Bihar': 'BIH', 'Chandigarh': 'HAR', 'Chhattisgarh': 'CHG',
    'Dadra and Nagar Haveli': 'GUJ', 'Daman and Diu': 'SAU', 'Delhi': 'HAR',
    'Goa': 'GOA', 'Gujarat': 'GUJ', 'Haryana': 'HAR', 'Himachal Pradesh': 'HP',
    'Jammu & Kashmir': 'JAK', 'Jharkhand': 'JHA', 'Karnataka': 'NIO',
    'Kerala': 'KER', 'Lakshadweep': 'LAK', 'Madhya Pradesh': 'WMP',
    'Maharashtra': 'KON', 'Manipur': 'MNP', 'Meghalaya': 'ASS', 'Mizoram': 'MNP',
    'Nagaland': 'NAG', 'Odisha': 'ORR', 'Puducherry': 'TN', 'Punjab': 'PUN',
    'Rajasthan': 'RAJ', 'Sikkim': 'WB', 'Tamil Nadu': 'TN', 'Telangana': 'TEL',
    'Tripura': 'MNP', 'Uttar Pradesh': 'WUP', 'Uttarakhand': 'UKD', 'West Bengal': 'WB', 'Ladakh': 'JAK'
};

function getScoreColor(score) {
    if (score < 20) return '#10B981'; // Low
    if (score < 40) return '#F59E0B'; // Moderate
    if (score < 60) return '#F97316'; // Elevated
    if (score < 80) return '#EF4444'; // High
    return '#991B1B'; // Critical
}

document.addEventListener('DOMContentLoaded', async () => {
    initFilters();
    await initMap();
    await refreshAll();
    await updateApiSourceStatuses();
});

function initFilters() {
    document.getElementById('leadDaySelect').addEventListener('change', e => { state.leadDay = parseInt(e.target.value); refreshAll(); });
    document.getElementById('varSelect').addEventListener('change', e => { state.forecastVariable = e.target.value; refreshAll(); });
    document.getElementById('eventSelect').addEventListener('change', e => { state.weatherEvent = e.target.value; refreshAll(); });
    const dateEl = document.getElementById('dateSelect');
    if (dateEl) {
        const today = new Date().toISOString().split('T')[0];
        dateEl.value = today;
        dateEl.addEventListener('change', () => refreshAll());
    }
    const regionEl = document.getElementById('regionSelect');
    if (regionEl) regionEl.addEventListener('change', e => { if (e.target.value !== 'all') selectRegion(e.target.value); });
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => { refreshAll(); updateApiSourceStatuses(); });

    // Live IST clock for Last Updated
    function tickISTClock() {
        const el = document.getElementById('lastUpdated');
        if (!el) return;
        const now = new Date();
        const opts = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        el.textContent = now.toLocaleTimeString('en-IN', opts) + ' IST';
    }
    tickISTClock();
    setInterval(tickISTClock, 1000);
}

async function apiGet(endpoint, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}${endpoint}?${qs}`);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
}

async function updateApiSourceStatuses() {
    try {
        const statuses = await apiGet('/status');
        const omStatusEl = document.getElementById('apiStatusOM');
        const imdStatusEl = document.getElementById('apiStatusIMD');

        if (statuses) {
            const list = Array.isArray(statuses) ? statuses : (statuses.sources || []);
            const omSource = list.find(s => s.source_name && (s.source_name.includes('Open-Meteo Multi-Model') || s.source_name.includes('Open-Meteo')));
            const imdSource = list.find(s => s.source_name && s.source_name.includes('IMD'));

            if (omStatusEl) {
                const isLive = statuses.open_meteo === 'AVAILABLE' || (omSource && omSource.status === 'LIVE');
                const color = isLive ? '#10B981' : '#EF4444';
                omStatusEl.innerHTML = `Open-Meteo Live Data: <span style="color:${color}; font-weight:700;">● ${isLive ? 'LIVE' : 'ERROR'}</span>`;
            }

            if (imdStatusEl) {
                const imdStatus = statuses.imd || (imdSource ? imdSource.status : 'NOT_CONFIGURED');
                const isPending = statuses.imd_status === 'pending_optional_integration' || imdStatus === 'NOT_CONFIGURED';
                const color = imdStatus === 'AVAILABLE' ? '#10B981' : (isPending ? '#94A3B8' : '#EF4444');
                const displayTxt = imdStatus === 'AVAILABLE' ? 'LIVE' : (isPending ? 'OPTIONAL (PENDING)' : 'ERROR');
                imdStatusEl.innerHTML = `IMD: <span style="color:${color}; font-weight:700;">● ${displayTxt}</span>`;
            }
        }
    } catch (e) {
        console.warn('Could not update source statuses:', e);
    }
}

async function refreshAll() {
    toggleLoading(true);
    try {
        await refreshMap();
        await refreshRanking();
        if (state.selectedRegion) {
            await selectRegion(state.selectedRegion);
        } else {
            // Select worst region by default
            if (state.mapData && state.mapData.regions.length > 0) {
                const worst = state.mapData.regions.reduce((max, r) => r.score > max.score ? r : max, state.mapData.regions[0]);
                await selectRegion(worst.region_id);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        toggleLoading(false);
    }
}

async function initMap() {
    state.map = L.map('ep-map').setView([22.5, 82.5], 4.5);
    // OpenStreetMap standard tile layer (Free, keyless, open-source)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
    }).addTo(state.map);
}

let _geojsonCache = null;
async function fetchGeoJSON() {
    if (_geojsonCache) return _geojsonCache;
    const res = await fetch(INDIA_GEOJSON_URL);
    _geojsonCache = await res.json();
    return _geojsonCache;
}

async function refreshMap() {
    const [mapData, geojson] = await Promise.all([
        apiGet('/map', { lead_day: state.leadDay, forecast_variable: state.forecastVariable, weather_event: state.weatherEvent }),
        fetchGeoJSON()
    ]);
    state.mapData = mapData;

    // Populate region dropdown if empty
    const regionSelectEl = document.getElementById('regionSelect');
    if (regionSelectEl && regionSelectEl.options.length <= 1) {
        const sorted = [...mapData.regions].sort((a, b) => a.region_name.localeCompare(b.region_name));
        sorted.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.region_id;
            opt.textContent = r.region_name;
            regionSelectEl.appendChild(opt);
        });
    }

    const regionMap = {};
    mapData.regions.forEach(r => regionMap[r.region_id] = r);

    if (state.geojsonLayer) state.map.removeLayer(state.geojsonLayer);

    state.geojsonLayer = L.geoJSON(geojson, {
        style: feature => {
            const subId = STATE_TO_SUB[feature.properties.ST_NM];
            const region = regionMap[subId];
            return {
                fillColor: region ? getScoreColor(region.score) : '#ccc',
                weight: 1, color: '#1E293B', fillOpacity: 0.7
            };
        },
        onEachFeature: (feature, layer) => {
            const subId = STATE_TO_SUB[feature.properties.ST_NM];
            const region = regionMap[subId];
            if (region) {
                layer.bindTooltip(`
                    <div class="ep-tooltip">
                        <div class="tt-title">${region.region_name}</div>
                        <div class="tt-row"><span>Error-Prone Score</span><span class="tt-val" style="color:${getScoreColor(region.score)}">${region.score} / 100</span></div>
                        <div class="tt-row"><span>Confidence</span><span class="tt-val">${(region.confidence*100).toFixed(0)}%</span></div>
                        <div class="tt-row"><span>Top Risk Driver</span><span class="tt-val">${region.top_driver.replace(/_/g, ' ')}</span></div>
                        <div class="tt-row"><span>Critical Lead Time</span><span class="tt-val">Day ${region.critical_lead_time}</span></div>
                    </div>
                `, { sticky: true });
                layer.on('click', () => {
                    if (regionSelectEl) regionSelectEl.value = subId;
                    selectRegion(subId);
                });
            }
        }
    }).addTo(state.map);
}

async function selectRegion(regionId) {
    state.selectedRegion = regionId;
    toggleLoading(true);
    try {
        const [detail, fingerprint, divergence, timeline, explanation] = await Promise.all([
            apiGet(`/region/${regionId}`, { lead_day: state.leadDay, weather_event: state.weatherEvent, forecast_variable: state.forecastVariable }),
            apiGet('/fingerprint', { region_id: regionId, lead_day: state.leadDay, weather_event: state.weatherEvent }),
            apiGet('/divergence', { region_id: regionId, forecast_variable: state.forecastVariable }),
            apiGet('/timeline', { region_id: regionId, weather_event: state.weatherEvent, forecast_variable: state.forecastVariable }),
            apiGet('/explanation', { region_id: regionId, lead_day: state.leadDay, weather_event: state.weatherEvent, forecast_variable: state.forecastVariable })
        ]);

        // Update Detail Panel
        const rName = detail.region_name || detail.region;
        document.getElementById('detRegionName').textContent = rName;
        const displayScore = detail.score !== undefined ? detail.score : (detail.risk?.score ?? '-');
        document.getElementById('detScore').textContent = displayScore;
        document.getElementById('detScore').style.color = getScoreColor(Number(displayScore) || 0);
        document.getElementById('detConf').textContent = `Confidence: ${(detail.confidence*100).toFixed(0)}%`;
        
        // Factors
        const factorNames = {
            historical_error: 'Historical Error Similarity',
            forecast_divergence: 'Forecast Divergence',
            ensemble_spread: 'Ensemble Spread',
            rapid_evolution: 'Rapid System Evolution',
            lead_time_uncertainty: 'Lead-Time Uncertainty',
            run_to_run_instability: 'Run-to-Run Instability',
            forecast_reference_error: 'Forecast vs Reference Error'
        };
        const fContainer = document.getElementById('factorBars');
        fContainer.innerHTML = '';
        if (detail.factors) {
            Object.entries(detail.factors).forEach(([k, v]) => {
                const numVal = Number(v) || 0;
                fContainer.innerHTML += `
                    <div class="factor-row">
                        <div class="factor-label-row"><span>${factorNames[k] || k}</span><span>${numVal.toFixed(1)}</span></div>
                        <div class="factor-track"><div class="factor-fill" style="width:${numVal}%; background:${getScoreColor(numVal)}"></div></div>
                    </div>
                `;
            });
        }

        // Explanation
        document.getElementById('detExplanation').textContent = explanation.explanation;

        // Data Provenance Card
        if (detail.source) document.getElementById('provSource').textContent = detail.source;
        if (detail.forecast) document.getElementById('provForecast').textContent = `${detail.forecast.value} ${detail.forecast.unit}`;
        if (detail.reference) document.getElementById('provReference').textContent = `${detail.reference.value} ${detail.reference.unit}`;
        if (detail.last_updated) document.getElementById('provInit').textContent = detail.last_updated.replace('T', ' ').replace('Z', ' UTC');
        if (detail.error) document.getElementById('provAbs').textContent = `${detail.error.absolute} ${detail.forecast?.unit || ''}`;

        // Fingerprints
        const fpContainer = document.getElementById('fpList');
        if (fingerprint.cases && fingerprint.cases.length > 0) {
            fpContainer.innerHTML = fingerprint.cases.map(c => `
                <div class="fingerprint-item">
                    <div>
                        <div class="fp-date">${c.event_date}</div>
                        <div style="font-size:0.7rem; color:#64748B;">Lead: Day ${c.forecast_lead_time} · ${fingerprint.method || 'Historical Match'}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="fp-sim">${c.similarity}% Match</div>
                        <div style="font-size:0.7rem; color:#EF4444;">${c.observed_error}</div>
                    </div>
                </div>
            `).join('');
        } else {
            fpContainer.innerHTML = `<div style="padding: 16px; color: #64748B; font-size: 0.8rem; text-align: center;">${fingerprint.message || 'insufficient historical data'}</div>`;
        }

        // Charts
        renderDivergenceChart(divergence.divergence, divergence.models_evaluated);
        renderTimelineChart(timeline);
        
    } catch (e) {
        console.error(e);
    } finally {
        toggleLoading(false);
    }
}

function renderDivergenceChart(data, modelsInfo = {}) {
    const ctx = document.getElementById('chartDivergence');
    if (state.charts.div) state.charts.div.destroy();

    const labelA = modelsInfo.model_a || 'Model A (ECMWF IFS)';
    const labelB = modelsInfo.model_b || 'Model B (GFS Seamless)';
    const labelC = modelsInfo.model_c || 'Model C (ICON Seamless)';
    
    state.charts.div = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => `Day ${d.lead_day}`),
            datasets: [
                { label: labelA, data: data.map(d => d.model_a), borderColor: '#EF4444', borderWidth: 1.5, tension: 0.3 },
                { label: labelB, data: data.map(d => d.model_b), borderColor: '#3B82F6', borderWidth: 1.5, tension: 0.3 },
                { label: labelC, data: data.map(d => d.model_c), borderColor: '#10B981', borderWidth: 1.5, tension: 0.3 },
                { label: 'Ensemble Mean', data: data.map(d => d.ensemble_mean), borderColor: '#0F172A', borderWidth: 2, borderDash: [5,5], tension: 0.3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
    });
}

function renderTimelineChart(data) {
    const ctx = document.getElementById('chartTimeline');
    if (state.charts.tl) state.charts.tl.destroy();
    
    const colors = data.timeline.map(d => getScoreColor(d.score));
    
    state.charts.tl = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.timeline.map(d => `Day ${d.lead_day}`),
            datasets: [{
                label: 'Error-Prone Score',
                data: data.timeline.map(d => d.score),
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }
    });

    const alertEl = document.getElementById('cliffAlert');
    if (data.cliff_detected_at) {
        alertEl.style.display = 'block';
        alertEl.textContent = `Predictability Cliff detected at Day ${data.cliff_detected_at} (Sudden Degradation)`;
    } else {
        alertEl.style.display = 'none';
    }
}

async function refreshRanking() {
    const res = await apiGet('/ranking', {
        lead_day: state.leadDay,
        weather_event: state.weatherEvent,
        forecast_variable: state.forecastVariable
    });
    
    const ctx = document.getElementById('chartRanking');
    if (state.charts.rank) state.charts.rank.destroy();
    
    const top = res.regions.slice(0, 10);
    state.charts.rank = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top.map(r => r.region_name),
            datasets: [{
                data: top.map(r => r.score),
                backgroundColor: top.map(r => getScoreColor(r.score)),
                borderRadius: 4
            }]
        },
        options: { 
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { display: false } },
            scales: { x: { min: 0, max: 100 } }
        }
    });
}

function toggleLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'flex' : 'none';
}
