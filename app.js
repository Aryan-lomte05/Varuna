/**
 * VARUNA Master Frontend Web Application Logic
 * Integrates all 8 VARUNA platform modules:
 * 1. Dramatic Landing Page
 * 2. Command Center 3D Globe Tactical HUD
 * 3. Multi-Agent AI Task DAG Execution Engine
 * 4. CMLRE Cross-Domain Biodiversity Explorer
 * 5. ARGO Vertical Telemetry Profile Deep-Dive
 * 6. Proactive Early-Warning Anomaly Room
 * 7. Underwater Submersible Deep Dive Hydrostatic Mode
 * 8. Datasets & Exports Inventory Engine
 */

// Generate Global ARGO Dataset (80 Indian Ocean Floats)
const argoDataset = generateArgoDataset();

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize View Routing & Navigation Tabs
  setupViewRouting();

  // 2. Initialize 3D Globe for Command Center
  if (window.initVarunaGlobe) {
    window.initVarunaGlobe(argoDataset, openFloatModal);
  }

  // 3. Initialize Datasets Table
  renderDatasetsTable(argoDataset);

  // 4. Setup Global Search
  setupGlobalSearch();

  // 5. Setup Multi-Agent AI DAG Simulator
  setupAgentSimulator();

  // 6. Setup CMLRE Biodiversity Explorer
  setupBiodiversityExplorer();

  // 7. Setup Early Warning Anomaly Room Timeline
  renderEarlyWarningTimelineChart();

  // 8. Initialize Underwater Deep Dive Scene
  if (window.initUnderwaterScene) {
    window.initUnderwaterScene();
  }

  // 9. Setup Modal Listeners
  setupModalListeners();
});

// View Navigation & Tab Switcher Logic
function setupViewRouting() {
  const navTabs = document.querySelectorAll('[data-view-target]');
  const viewSections = document.querySelectorAll('.varuna-view-section');

  navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = tab.dataset.viewTarget;

      navTabs.forEach(t => t.classList.remove('text-[#83ffe3]', 'border-b-2', 'border-[#2ee6c6]', 'bg-[#2ee6c6]/10'));
      tab.classList.add('text-[#83ffe3]', 'border-b-2', 'border-[#2ee6c6]', 'bg-[#2ee6c6]/10');

      viewSections.forEach(sec => {
        if (sec.id === targetId) {
          sec.classList.remove('hidden');
          sec.classList.add('block');
        } else {
          sec.classList.remove('block');
          sec.classList.add('hidden');
        }
      });

      // Re-trigger Canvas resizes if needed
      if (targetId === 'view-deep-dive' && window.initUnderwaterScene) {
        window.initUnderwaterScene();
      }
    });
  });
}

// Generate Realistic ARGO Float Dataset
function generateArgoDataset() {
  const regions = [
    { name: 'Arabian Sea', latMin: 10, latMax: 24, lonMin: 60, lonMax: 76 },
    { name: 'Bay of Bengal', latMin: 8, latMax: 22, lonMin: 80, lonMax: 94 },
    { name: 'Equatorial Indian Ocean', latMin: -5, latMax: 5, lonMin: 55, lonMax: 95 },
    { name: 'Lakshadweep Sea', latMin: 8, latMax: 14, lonMin: 70, lonMax: 76 },
    { name: 'Andaman Sea', latMin: 6, latMax: 14, lonMin: 92, lonMax: 98 }
  ];

  const speciesList = [
    'Sardinella longiceps (Indian Oil Sardine)',
    'Thunnus albacares (Yellowfin Tuna)',
    'Epinephelus tauvina (Greasy Grouper)',
    'Rastrelliger kanagurta (Indian Mackerel)',
    'Katsuwonus pelamis (Skipjack Tuna)',
    'Tenualosa ilisha (Hilsa Shad)'
  ];

  const dataset = [];
  const floatBaseIds = [1902303, 5906478, 2903567, 6903112, 4902188, 3901944, 7904221, 8905332];

  for (let i = 0; i < 80; i++) {
    const reg = regions[i % regions.length];
    const lat = reg.latMin + Math.random() * (reg.latMax - reg.latMin);
    const lon = reg.lonMin + Math.random() * (reg.lonMax - reg.lonMin);
    const baseId = floatBaseIds[i % floatBaseIds.length] + i * 17;

    const isHeatwave = (reg.name === 'Arabian Sea' && i % 4 === 0);
    const isHypoxia = (reg.name === 'Bay of Bengal' && i % 3 === 0);

    let status = 'NORMAL';
    let temp = 26.5 + Math.random() * 3.5;
    let tempAnomaly = (Math.random() * 0.8) - 0.4;
    let doxy = 120 + Math.random() * 80;
    let salinity = 34.2 + Math.random() * 1.8;

    if (isHeatwave) {
      status = 'CRITICAL';
      temp = 31.8;
      tempAnomaly = 3.4;
    } else if (isHypoxia) {
      status = 'WARNING';
      doxy = 42.5;
    }

    dataset.push({
      idNumber: baseId,
      id: `ARGO-${baseId}`,
      region: reg.name,
      lat: lat,
      lon: lon,
      temp: temp,
      tempAnomaly: tempAnomaly,
      salinity: salinity,
      doxy: doxy,
      chla: 0.25 + Math.random() * 0.65,
      depth: 2000,
      status: status,
      isAnomaly: (status !== 'NORMAL'),
      species: speciesList[i % speciesList.length],
      updated: `${Math.floor(Math.random() * 45) + 2} mins ago`,
      qcAccuracy: '99.8%'
    });
  }

  return dataset;
}

// Render Datasets Table
function renderDatasetsTable(data) {
  const tbody = document.getElementById('datasets-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  data.slice(0, 12).forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'cursor-pointer hover:bg-[#12212e]/80 transition-colors border-b border-white/5';

    let statusBadge = `<span class="px-2 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400 font-data-mono">NORMAL</span>`;
    if (item.status === 'CRITICAL') {
      statusBadge = `<span class="px-2 py-0.5 text-xs rounded bg-rose-500/20 text-rose-400 font-data-mono animate-pulse">CRITICAL MHW</span>`;
    } else if (item.status === 'WARNING') {
      statusBadge = `<span class="px-2 py-0.5 text-xs rounded bg-amber-500/20 text-amber-400 font-data-mono">HYPOXIA</span>`;
    }

    tr.innerHTML = `
      <td class="font-data-mono text-[#83ffe3] font-semibold">${item.id}</td>
      <td class="text-slate-300 font-jakarta">${item.region}</td>
      <td class="font-data-mono text-slate-300">${item.lat.toFixed(2)}°N, ${item.lon.toFixed(2)}°E</td>
      <td class="font-data-mono">${item.temp.toFixed(1)}°C <span class="${item.tempAnomaly > 1 ? 'text-rose-400 font-bold' : 'text-slate-400'}">(${item.tempAnomaly > 0 ? '+' : ''}${item.tempAnomaly.toFixed(1)}°C)</span></td>
      <td class="font-data-mono text-slate-300">${item.salinity.toFixed(1)} PSU</td>
      <td class="font-data-mono ${item.doxy < 60 ? 'text-amber-400 font-bold' : 'text-slate-300'}">${item.doxy.toFixed(1)} µmol/kg</td>
      <td>${statusBadge}</td>
      <td>
        <button class="px-3 py-1 bg-[#12212e] border border-[#2ee6c6]/40 hover:bg-[#2ee6c6]/20 text-[#83ffe3] text-xs font-jakarta rounded transition-colors" onclick="openFloatModalById('${item.id}')">
          Inspect Profile
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Global Search
function setupGlobalSearch() {
  const input = document.getElementById('global-search-input');
  if (!input) return;

  input.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim();
    if (!val) {
      renderDatasetsTable(argoDataset);
      return;
    }

    const filtered = argoDataset.filter(item =>
      item.id.toLowerCase().includes(val) ||
      item.region.toLowerCase().includes(val) ||
      item.species.toLowerCase().includes(val) ||
      item.status.toLowerCase().includes(val)
    );

    renderDatasetsTable(filtered);
  });
}

// Open Float Detail Telemetry Modal
window.openFloatModalById = function(id) {
  const item = argoDataset.find(f => f.id === id);
  if (item) openFloatModal(item);
};

function openFloatModal(floatData) {
  const modal = document.getElementById('float-modal-backdrop');
  if (!modal) return;

  document.getElementById('modal-float-id').textContent = floatData.id;
  document.getElementById('modal-float-region').textContent = `${floatData.region} (${floatData.lat.toFixed(2)}°N, ${floatData.lon.toFixed(2)}°E)`;
  document.getElementById('modal-temp').textContent = `${floatData.temp.toFixed(1)} °C`;
  document.getElementById('modal-salinity').textContent = `${floatData.salinity.toFixed(1)} PSU`;
  document.getElementById('modal-doxy').textContent = `${floatData.doxy.toFixed(1)} µmol/kg`;
  document.getElementById('modal-chla').textContent = `${floatData.chla.toFixed(2)} mg/m³`;
  document.getElementById('modal-species').textContent = floatData.species;

  drawDepthProfileChart(floatData);
  modal.classList.add('open');
}

function setupModalListeners() {
  const modal = document.getElementById('float-modal-backdrop');
  const closeBtn = document.getElementById('modal-close-btn');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }
}

// Draw Vertical 0m-2000m Depth Profile Graph
function drawDepthProfileChart(floatData) {
  const canvas = document.getElementById('depth-profile-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width = canvas.parentElement.clientWidth || 800;
  canvas.height = 360;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Background Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;

  for (let y = 40; y < h - 40; y += 50) {
    ctx.beginPath();
    ctx.moveTo(50, y);
    ctx.lineTo(w - 20, y);
    ctx.stroke();

    const depthVal = Math.round(((y - 40) / (h - 80)) * 2000);
    ctx.fillStyle = '#84948f';
    ctx.font = '11px "JetBrains Mono"';
    ctx.fillText(`${depthVal}m`, 10, y + 4);
  }

  // Draw Temperature Profile Line
  ctx.beginPath();
  ctx.strokeStyle = '#2ee6c6';
  ctx.lineWidth = 2.5;

  for (let depth = 0; depth <= 2000; depth += 50) {
    const y = 40 + (depth / 2000) * (h - 80);
    const tempAtDepth = 4 + (floatData.temp - 4) * Math.exp(-depth / 400);
    const x = 50 + (tempAtDepth / 35) * (w - 70);
    if (depth === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw DOXY Profile Line (Orange)
  ctx.beginPath();
  ctx.strokeStyle = '#ffa500';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);

  for (let depth = 0; depth <= 2000; depth += 50) {
    const y = 40 + (depth / 2000) * (h - 80);
    const doxyAtDepth = Math.max(10, floatData.doxy * (0.3 + 0.7 * Math.sin(depth / 300)));
    const x = 50 + (doxyAtDepth / 250) * (w - 70);
    if (depth === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Legend
  ctx.fillStyle = '#2ee6c6';
  ctx.fillRect(w - 220, 15, 12, 12);
  ctx.fillStyle = '#d5e4f7';
  ctx.font = '12px "Plus Jakarta Sans"';
  ctx.fillText('Temperature Profile (°C)', w - 200, 25);

  ctx.fillStyle = '#ffa500';
  ctx.fillRect(w - 220, 32, 12, 2);
  ctx.fillText('DOXY Profile (µmol/kg)', w - 200, 37);
}

// Multi-Agent AI Task DAG Execution Simulator
function setupAgentSimulator() {
  const btn = document.getElementById('run-agent-dag-btn');
  const queryInput = document.getElementById('agent-query-input');
  if (!btn || !queryInput) return;

  btn.addEventListener('click', () => {
    const query = queryInput.value.trim();
    if (!query) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">sync</span> Executing DAG...`;

    // Step 1: Planner
    highlightDagStep('dag-step-planner');

    setTimeout(() => {
      // Step 2: SQL, Bio, Vector Parallel
      highlightDagStep('dag-step-sql');
      highlightDagStep('dag-step-bio');
      highlightDagStep('dag-step-vector');
    }, 600);

    setTimeout(() => {
      // Step 3: Synthesizer
      highlightDagStep('dag-step-synthesizer');
      const outCard = document.getElementById('dag-output-card');
      if (outCard) outCard.classList.remove('hidden');

      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-sm">play_arrow</span> Run Multi-Agent DAG`;
    }, 1300);
  });
}

function highlightDagStep(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.classList.add('border-[#2ee6c6]', 'shadow-[0_0_20px_rgba(46,230,198,0.5)]');
  }
}

// Biodiversity Explorer Tool
function setupBiodiversityExplorer() {
  const speciesCards = document.querySelectorAll('.species-card');
  speciesCards.forEach(card => {
    card.addEventListener('click', () => {
      speciesCards.forEach(c => c.classList.remove('border-[#2ee6c6]', 'bg-[#2ee6c6]/10'));
      card.classList.add('border-[#2ee6c6]', 'bg-[#2ee6c6]/10');
    });
  });
}

// Early Warning Anomaly Timeline Canvas Chart
function renderEarlyWarningTimelineChart() {
  const canvas = document.getElementById('ew-timeline-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth || 600;
  const h = canvas.height = 140;

  ctx.clearRect(0, 0, w, h);

  // Draw SST Anomaly Timeline Curve
  ctx.beginPath();
  ctx.strokeStyle = '#ff4d4d';
  ctx.lineWidth = 3;

  const points = [
    { x: 20, y: 110 }, { x: 100, y: 95 }, { x: 180, y: 80 },
    { x: 260, y: 55 }, { x: 340, y: 30 }, { x: 420, y: 25 },
    { x: 500, y: 35 }, { x: w - 20, y: 40 }
  ];

  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  // Draw Gradient Fill under curve
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255, 77, 77, 0.4)');
  grad.addColorStop(1, 'rgba(255, 77, 77, 0.0)');

  ctx.lineTo(w - 20, h);
  ctx.lineTo(20, h);
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw Critical Anomaly Marker Pin
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(420, 25, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px "JetBrains Mono"';
  ctx.fillText('+3.4°C Peak', 430, 20);
}

// Instant CSV Export
window.exportArgoDataCSV = function() {
  let csvContent = "data:text/csv;charset=utf-8,Float_ID,Region,Latitude,Longitude,Temperature,Salinity,DOXY,CHLA,Status\n";
  argoDataset.forEach(row => {
    csvContent += `${row.id},${row.region},${row.lat},${row.lon},${row.temp},${row.salinity},${row.doxy},${row.chla},${row.status}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `VARUNA_ARGO_Floats_Export_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
