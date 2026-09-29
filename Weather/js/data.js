/**
 * data.js — Mock historical forecast error dataset
 * Simulates real API data from Open-Meteo, ECMWF, IMD
 * Will be replaced with live API calls once keys are provided
 */

// ============================================================
// HISTORICAL WEATHER EVENTS (2018–2023, India)
// ============================================================
const HISTORICAL_EVENTS = [
  {
    id: "e001",
    name: "Cyclone Biparjoy",
    type: "cyclone",
    date: "2023-06-06",
    endDate: "2023-06-19",
    region: "Arabian Sea → Gujarat",
    lat: 23.2, lon: 68.5,
    bustSeverity: "high",
    peakLeadTime: 5,
    rmseByDay: [0.8, 1.2, 1.8, 2.6, 3.4, 4.1, 4.8, 5.2, 5.6, 5.9],
    rmseTemp: [0.6, 1.0, 1.6, 2.3, 3.1, 3.8, 4.3, 4.7, 5.1, 5.5],
    rmsePrec: [2.1, 3.4, 5.1, 7.8, 10.2, 12.8, 14.1, 15.6, 16.9, 18.2],
    rmseWind: [1.2, 2.3, 3.8, 5.9, 7.4, 8.6, 9.2, 9.8, 10.1, 10.5],
    modelPerf: { IMD: 48, ECMWF: 91, GFS: 67, NCMRWF: 55 },
    bustDay: 5,
    trackError: 340,
    intensityError: 18,
    causes: [
      "Rapid intensification phase not captured by IMD model",
      "Sea surface temperature underestimated in pre-analysis",
      "Upper-level ridge weakening onset was 36h delayed"
    ],
    factors: ["Rapid Intensification", "SST Bias", "Steering Flow Error"]
  },
  {
    id: "e002",
    name: "Monsoon Depression – Odisha",
    type: "monsoon_depression",
    date: "2023-08-12",
    endDate: "2023-08-16",
    region: "Bay of Bengal → Odisha-Jharkhand",
    lat: 20.5, lon: 85.8,
    bustSeverity: "high",
    peakLeadTime: 3,
    rmseByDay: [1.1, 1.9, 3.2, 4.8, 5.9, 6.8, 7.5, 7.9, 8.2, 8.5],
    rmseTemp: [0.9, 1.5, 2.6, 3.9, 4.8, 5.6, 6.1, 6.5, 6.8, 7.0],
    rmsePrec: [4.2, 7.8, 13.5, 20.1, 24.8, 28.3, 30.1, 31.8, 32.9, 33.5],
    rmseWind: [1.5, 2.8, 4.6, 6.8, 8.4, 9.7, 10.3, 10.8, 11.0, 11.2],
    modelPerf: { IMD: 38, ECMWF: 72, GFS: 61, NCMRWF: 44 },
    bustDay: 3,
    trackError: 180,
    intensityError: 24,
    causes: [
      "Monsoon trough position forecast 250 km south of actual",
      "Low-level jet stream interaction underestimated",
      "Orographic enhancement over Eastern Ghats not modelled"
    ],
    factors: ["Trough Misplacement", "LLJ Interaction", "Orographic Effect"]
  },
  {
    id: "e003",
    name: "Western Disturbance – Himachal",
    type: "western_disturbance",
    date: "2023-01-28",
    endDate: "2023-02-02",
    region: "Himachal Pradesh & Uttarakhand",
    lat: 31.5, lon: 77.1,
    bustSeverity: "medium",
    peakLeadTime: 4,
    rmseByDay: [0.5, 0.9, 1.5, 2.4, 3.0, 3.5, 3.9, 4.2, 4.4, 4.6],
    rmseTemp: [0.7, 1.3, 2.0, 2.9, 3.5, 3.9, 4.2, 4.5, 4.7, 4.9],
    rmsePrec: [1.8, 3.2, 5.6, 8.4, 10.1, 11.8, 12.9, 13.7, 14.3, 14.8],
    rmseWind: [0.8, 1.4, 2.3, 3.5, 4.2, 4.9, 5.3, 5.6, 5.8, 6.0],
    modelPerf: { IMD: 62, ECMWF: 88, GFS: 79, NCMRWF: 71 },
    bustDay: 4,
    trackError: 120,
    intensityError: 12,
    causes: [
      "Jet stream amplitude underestimated at 250hPa",
      "Moisture influx from Arabian Sea underpredicted",
      "Snowfall extent underestimated by 60% in Lahaul-Spiti"
    ],
    factors: ["Jet Stream Bias", "Moisture Transport", "Snowfall Scheme Error"]
  },
  {
    id: "e004",
    name: "Heat Wave – Northwest India",
    type: "heat_wave",
    date: "2023-05-15",
    endDate: "2023-05-25",
    region: "Rajasthan, Delhi, Haryana",
    lat: 27.0, lon: 75.8,
    bustSeverity: "medium",
    peakLeadTime: 6,
    rmseByDay: [0.4, 0.7, 1.1, 1.6, 2.0, 2.8, 3.4, 3.8, 4.1, 4.3],
    rmseTemp: [0.5, 0.9, 1.4, 2.0, 2.6, 3.4, 4.0, 4.5, 4.8, 5.0],
    rmsePrec: [0.2, 0.4, 0.6, 0.9, 1.2, 1.6, 1.9, 2.1, 2.3, 2.4],
    rmseWind: [0.6, 1.0, 1.6, 2.3, 2.9, 3.7, 4.2, 4.6, 4.9, 5.1],
    modelPerf: { IMD: 74, ECMWF: 86, GFS: 82, NCMRWF: 78 },
    bustDay: 6,
    trackError: 0,
    intensityError: 4,
    causes: [
      "Anticyclonic circulation persistence overestimated beyond Day 5",
      "Soil moisture feedback underrepresented in land-surface scheme",
      "Nighttime minimum temperature 2.5°C colder than observed"
    ],
    factors: ["Anticyclone Persistence", "Soil Moisture Bias", "Nocturnal Cooling Error"]
  },
  {
    id: "e005",
    name: "Active Monsoon – Kerala Onset",
    type: "break_monsoon",
    date: "2023-06-01",
    endDate: "2023-06-10",
    region: "Kerala, Tamil Nadu",
    lat: 10.5, lon: 76.2,
    bustSeverity: "low",
    peakLeadTime: 2,
    rmseByDay: [0.6, 1.0, 1.4, 1.8, 2.1, 2.4, 2.7, 3.0, 3.2, 3.4],
    rmseTemp: [0.4, 0.7, 1.0, 1.3, 1.6, 1.9, 2.1, 2.3, 2.5, 2.7],
    rmsePrec: [3.2, 5.8, 8.4, 11.2, 13.6, 15.8, 17.4, 18.9, 20.1, 21.2],
    rmseWind: [0.9, 1.5, 2.1, 2.8, 3.4, 3.9, 4.3, 4.6, 4.9, 5.1],
    modelPerf: { IMD: 81, ECMWF: 89, GFS: 84, NCMRWF: 83 },
    bustDay: 2,
    trackError: 0,
    intensityError: 2,
    causes: [
      "Monsoon onset date predicted correctly but rainfall intensity 40% under",
      "Cross-equatorial flow underestimated in early June",
      "MJO phase 3 signal not fully exploited in medium range"
    ],
    factors: ["Onset Intensity Error", "Cross-Equatorial Flow", "MJO Signal"]
  },
  {
    id: "e006",
    name: "Cyclone Michaung",
    type: "cyclone",
    date: "2023-12-01",
    endDate: "2023-12-06",
    region: "Bay of Bengal → Andhra Pradesh",
    lat: 14.5, lon: 80.2,
    bustSeverity: "high",
    peakLeadTime: 4,
    rmseByDay: [0.9, 1.6, 2.5, 3.7, 5.1, 5.8, 6.4, 6.9, 7.2, 7.5],
    rmseTemp: [0.7, 1.2, 1.9, 2.8, 3.9, 4.5, 4.9, 5.3, 5.6, 5.8],
    rmsePrec: [3.8, 6.9, 11.2, 16.8, 23.4, 27.1, 29.8, 32.1, 33.8, 35.1],
    rmseWind: [1.4, 2.5, 4.1, 6.2, 8.5, 9.8, 10.6, 11.2, 11.6, 11.9],
    modelPerf: { IMD: 55, ECMWF: 85, GFS: 70, NCMRWF: 61 },
    bustDay: 4,
    trackError: 210,
    intensityError: 22,
    causes: [
      "ITCZ interaction caused unexpected northward recurvature",
      "Landfall location underestimated by 170 km southward",
      "Extreme rainfall over Chennai underestimated by 35%"
    ],
    factors: ["ITCZ Interaction", "Track Error", "Extreme Rainfall Bias"]
  },
  {
    id: "e007",
    name: "Break Monsoon – Aug 2022",
    type: "break_monsoon",
    date: "2022-08-20",
    endDate: "2022-09-01",
    region: "Central India (Break Phase)",
    lat: 22.0, lon: 80.5,
    bustSeverity: "medium",
    peakLeadTime: 5,
    rmseByDay: [0.7, 1.2, 1.8, 2.5, 3.2, 3.8, 4.3, 4.7, 5.0, 5.3],
    rmseTemp: [0.6, 1.0, 1.5, 2.1, 2.8, 3.3, 3.7, 4.0, 4.3, 4.5],
    rmsePrec: [2.5, 4.5, 7.2, 10.1, 13.2, 15.8, 17.6, 19.1, 20.3, 21.3],
    rmseWind: [0.7, 1.2, 1.9, 2.8, 3.6, 4.3, 4.8, 5.2, 5.5, 5.8],
    modelPerf: { IMD: 66, ECMWF: 80, GFS: 74, NCMRWF: 69 },
    bustDay: 5,
    trackError: 0,
    intensityError: 6,
    causes: [
      "Break monsoon onset predicted 4 days late",
      "Somali jet speed overestimated leading to false rainfall signal",
      "Heat trough over NW India underestimated"
    ],
    factors: ["Break Onset Timing", "Somali Jet Bias", "Heat Trough Error"]
  },
  {
    id: "e008",
    name: "Heavy Rainfall – Mumbai",
    type: "heavy_rain",
    date: "2022-07-19",
    endDate: "2022-07-20",
    region: "Konkan, Mumbai Metropolitan",
    lat: 19.1, lon: 72.9,
    bustSeverity: "high",
    peakLeadTime: 2,
    rmseByDay: [1.4, 3.6, 6.2, 8.8, 10.5, 11.8, 12.6, 13.2, 13.7, 14.1],
    rmseTemp: [0.8, 1.6, 2.5, 3.4, 4.1, 4.7, 5.1, 5.4, 5.7, 5.9],
    rmsePrec: [8.5, 22.4, 38.6, 55.2, 66.8, 75.4, 80.6, 84.8, 88.2, 91.0],
    rmseWind: [1.8, 3.6, 5.9, 8.4, 10.1, 11.4, 12.2, 12.8, 13.2, 13.6],
    modelPerf: { IMD: 29, ECMWF: 58, GFS: 44, NCMRWF: 35 },
    bustDay: 2,
    trackError: 0,
    intensityError: 45,
    causes: [
      "Extreme convective event not represented in coarse grid",
      "Offshore vortex coupling with land thermal low not captured",
      "Day-2 QPF underestimated by 65% — bust threshold exceeded"
    ],
    factors: ["Convective Scale Mismatch", "Offshore Vortex", "QPF Under-prediction"]
  }
];

// ============================================================
// BUST FREQUENCY BY MONTH (2018–2023)
// ============================================================
const BUST_BY_MONTH = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  cyclone:     [0, 0, 0, 1, 2, 4, 2, 3, 5, 6, 4, 2],
  monsoon_dep: [0, 0, 0, 0, 0, 3, 8, 9, 7, 2, 0, 0],
  heat_wave:   [0, 1, 2, 4, 6, 2, 0, 0, 0, 0, 0, 0],
  western_dist:[3, 4, 5, 2, 0, 0, 0, 0, 0, 1, 2, 4],
  heavy_rain:  [0, 0, 0, 0, 1, 3, 6, 5, 4, 2, 1, 0],
  break_monsoon:[0, 0, 0, 0, 0, 1, 3, 4, 2, 0, 0, 0]
};

// ============================================================
// RADAR CHART — Event Type Error Profile
// ============================================================
const EVENT_RADAR_DATA = {
  labels: ['T2m RMSE', 'Precip RMSE', 'Wind Error', 'Track Error', 'Intensity Error', 'Bust Rate'],
  cyclone:     [4.2, 14.8, 9.6, 8.5, 7.2, 78],
  monsoon_dep: [5.1, 22.4, 7.8, 6.2, 8.9, 72],
  heat_wave:   [3.4, 1.2, 3.8, 1.0, 3.5, 45],
  western_dist:[2.8, 8.6, 4.2, 2.0, 4.1, 38],
  heavy_rain:  [3.8, 48.2, 8.4, 1.5, 12.6, 85],
  break_monsoon:[3.2, 12.4, 4.6, 1.0, 5.4, 42]
};

// ============================================================
// HEATMAP — Model × Event Type Error (normalized 0–100)
// ============================================================
const HEATMAP_DATA = {
  models: ['IMD', 'ECMWF', 'GFS', 'NCMRWF'],
  events: ['Cyclone', 'Monsoon Dep', 'Heat Wave', 'W. Disturb', 'Heavy Rain', 'Break Mon.'],
  scores: [
    [52, 38, 74, 62, 29, 66],  // IMD
    [91, 72, 86, 88, 58, 80],  // ECMWF
    [67, 61, 82, 79, 44, 74],  // GFS
    [55, 44, 78, 71, 35, 69],  // NCMRWF
  ]
};

// ============================================================
// GEOSPATIAL ERROR POINTS — India regions
// ============================================================
const GEO_ERROR_POINTS = [
  // [lat, lon, errorLevel 0-1, label]
  [23.2, 68.5, 0.88, "Arabian Sea / Gujarat", "Cyclone Track Error"],
  [20.5, 85.8, 0.82, "Odisha Coast", "Monsoon Depression Error"],
  [19.1, 72.9, 0.95, "Mumbai / Konkan", "Extreme Rainfall Bust"],
  [14.5, 80.2, 0.79, "Andhra Pradesh", "Cyclone Michaung Error"],
  [27.0, 75.8, 0.55, "Rajasthan / Delhi", "Heat Wave Error"],
  [31.5, 77.1, 0.46, "Himachal Pradesh", "W. Disturbance Error"],
  [10.5, 76.2, 0.28, "Kerala", "Monsoon Onset Error"],
  [22.0, 80.5, 0.51, "Central India", "Break Monsoon Error"],
  [26.5, 93.0, 0.70, "Northeast India", "Seasonal Bias"],
  [8.5,  77.5, 0.62, "Southern Peninsula", "Pre-monsoon Error"],
  [32.0, 74.0, 0.42, "Punjab / J&K", "Winter Disturbance Error"],
  [25.5, 91.9, 0.68, "Meghalaya", "Orographic Rain Error"]
];

// ============================================================
// METEOROLOGICAL EXPLANATION CARDS
// ============================================================
const EXPLAIN_CARDS = [
  {
    event: "Cyclone Events",
    icon: "🌀",
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.1)",
    text: "Rapid intensification phases within 24h of landfall are systematically underforecast by IMD GFS-T574 beyond Day 3. Primary cause: coarse ocean coupling and inability to represent convective bursts near eyewall.",
    factors: ["Rapid Intensification", "Ocean Coupling", "Eyewall Convection", "SST Feedback"]
  },
  {
    event: "Monsoon Depressions",
    icon: "⛈️",
    color: "#818cf8",
    bgColor: "rgba(129,140,248,0.1)",
    text: "Track errors exceed 200 km at Day 3+ due to misrepresentation of the monsoon trough axis. Heavy rainfall associated with steep orography (Eastern Ghats, NE hills) is underestimated by 30–60%.",
    factors: ["Trough Axis Error", "Orographic Enhancement", "Bay of Bengal SST", "LLJ Interaction"]
  },
  {
    event: "Heat Waves",
    icon: "🌡️",
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.1)",
    text: "Anticyclonic persistence beyond Day 5 is overestimated. Soil moisture memory in land-surface models creates warm bias. Nocturnal cooling is underestimated by 2–4°C leading to false 'cold night' signals.",
    factors: ["Anticyclone Persistence", "Soil Moisture Bias", "Nocturnal Error", "Albedo Feedback"]
  },
  {
    event: "Western Disturbances",
    icon: "❄️",
    color: "#26c6da",
    bgColor: "rgba(38,198,218,0.1)",
    text: "Upper-level jet stream amplitude errors at 250hPa cascade into timing errors of 12–36h for snowfall/rainfall onset over Himachal and Uttarakhand. Moisture transport from Arabian Sea is systematically underpredicted.",
    factors: ["Jet Stream Amplitude", "Moisture Transport", "Snowfall Scheme", "Terrain Shadowing"]
  },
  {
    event: "Heavy Rainfall Events",
    icon: "🌧️",
    color: "#22d3a0",
    bgColor: "rgba(34,211,160,0.1)",
    text: "High-impact, mesoscale convective systems are the most challenging to forecast. Grid resolution (12–25 km) is insufficient. Offshore vortex coupling and land-sea breeze interactions drive bust events over Konkan coast.",
    factors: ["Grid Resolution Limit", "Mesoscale Convection", "Offshore Vortex", "Land-Sea Breeze"]
  },
  {
    event: "Break/Active Monsoon",
    icon: "🌩️",
    color: "#4fc3f7",
    bgColor: "rgba(79,195,247,0.1)",
    text: "Transition between active and break monsoon phases is predicted 3–6 days late. MJO phase signal is underutilised in medium-range models. Somali jet intensity variations are a primary source of uncertainty.",
    factors: ["MJO Phase Error", "Somali Jet Bias", "Phase Transition Timing", "ITCZ Position"]
  }
];

// ============================================================
// FINGERPRINT SIGNATURES (radar-like profiles for similarity)
// ============================================================
const FP_SIGNATURES = [
  {
    name: "Cyclone Biparjoy",
    profile: [78, 65, 82, 90, 74, 85, 70, 60],
    color: "#ef4444"
  },
  {
    name: "Monsoon Dep. – Odisha",
    profile: [82, 70, 88, 75, 65, 80, 85, 72],
    color: "#818cf8"
  },
  {
    name: "Heat Wave – NW India",
    profile: [55, 40, 45, 30, 68, 50, 42, 38],
    color: "#f59e0b"
  }
];

// ============================================================
// Compute cosine similarity between two signature profiles
// ============================================================
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return (dot / (magA * magB) * 100).toFixed(1);
}
