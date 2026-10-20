/**
 * WebGIS: Fluxos Migratórios para São Paulo
 * Censo 7º Ano do Ensino Fundamental - Escola de Aplicação FEUSP
 * 
 * Main Application Logic - V2 with Generational Color Differentiation,
 * Political Map with IBGE State Boundaries, and Watermark-Free Tile Layers.
 */

(function () {
  'use strict';

  // Check if data is available
  if (!window.CENSO_DATA) {
    console.error('CENSO_DATA not loaded!');
    return;
  }

  const DATA = window.CENSO_DATA;
  const DEST_FEUSP = DATA.metadata.destino; // Escola de Aplicação FEUSP (-23.559388, -46.726584)

  // Color Definitions by Generation
  const GEN_COLORS = {
    bisavos: '#d946ef', // Fuchsia / Magenta vibrante
    avos: '#f59e0b',    // Âmbar / Dourado solar
    pais: '#06b6d4',    // Ciano / Turquesa elétrico
    estudantes: '#10b981' // Verde Esmeralda (Destino SP)
  };

  const GEN_LABELS = {
    bisavos: 'Bisavós (3ª Geração)',
    avos: 'Avós (2ª Geração)',
    pais: 'Pais (1ª Geração)',
    estudantes: 'Estudantes (7º ano)'
  };

  // Application State
  const state = {
    generation: 'todas',         // 'todas', 'bisavos', 'avos', 'pais', 'estudantes'
    turma: '7ºEF',               // '7ºEF', '7ºI', '7ºII'
    scope: 'todos',              // 'todos', 'nacional', 'internacional'
    minVolume: 1,
    searchQuery: '',
    animationEnabled: true,
    showDivisas: true,           // Toggle state boundaries overlay
    activeBasemap: 'political',  // 'political', 'satellite', 'hybrid', 'street', 'dark'
    selectedFlowId: null
  };

  // Map and Layer References
  let map;
  let baseLayers = {};
  let flowLayerGroup;
  let arrowLayerGroup;
  let originLayerGroup;
  let destinationLayerGroup;
  let boundariesLayerGroup;
  let currentFlowObjects = [];

  // =========================================================================
  // Initialization
  // =========================================================================
  function init() {
    initMap();
    initBoundariesLayers();
    initControls();
    initEventListeners();
    updateView();
  }

  // =========================================================================
  // Leaflet Map Setup (Watermark-Free Basemaps)
  // =========================================================================
  function initMap() {
    // Initial view focused on Brazil
    map = L.map('map', {
      center: [-14.5, -51.5],
      zoom: 4,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false
    });

    // Zoom control at top right (below basemap switcher)
    L.control.zoom({ position: 'topright' }).addTo(map);

    // 1. Mapa Político (Base cinza clara neutra perfeita para destacar divisas de estados)
    baseLayers.political = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ &copy; IBGE',
        maxZoom: 16
      })
    ]);

    // 2. Satélite de Alta Resolução (Esri World Imagery - 100% livre de marca d'água)
    baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
      maxZoom: 18
    });

    // 3. Satélite Híbrido (Satélite + Ruas e Fronteiras)
    baseLayers.hybrid = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 })
    ]);

    // 4. Modo Noturno (Esri Dark Canvas)
    baseLayers.dark = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 16
      }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16
      })
    ]);

    // Default active basemap: Mapa Político (Divisas)
    baseLayers.political.addTo(map);

    // Layer groups for GIS overlays
    boundariesLayerGroup = L.layerGroup().addTo(map);
    flowLayerGroup = L.layerGroup().addTo(map);
    arrowLayerGroup = L.layerGroup().addTo(map);
    originLayerGroup = L.layerGroup().addTo(map);
    destinationLayerGroup = L.layerGroup().addTo(map);

    // Update arrow rotations on zoom/pan
    map.on('zoomend', updateArrowheadRotations);
  }

  // =========================================================================
  // Political Map Layers (IBGE Brazilian States & World Countries)
  // =========================================================================
  function initBoundariesLayers() {
    boundariesLayerGroup.clearLayers();

    // 1. World Countries GeoJSON
    if (window.GEOJSON_PAISES_MUNDO) {
      const worldLayer = L.geoJSON(window.GEOJSON_PAISES_MUNDO, {
        style: function (feat) {
          const cname = feat.properties.name;
          const isOrigin = isCountryOrigin(cname);
          return {
            color: isOrigin ? '#f97316' : '#94a3b8',
            weight: isOrigin ? 1.5 : 0.8,
            opacity: 0.8,
            fillColor: isOrigin ? '#ffedd5' : '#f8fafc',
            fillOpacity: isOrigin ? 0.35 : 0.05
          };
        },
        onEachFeature: function (feat, layer) {
          const cname = feat.properties.name;
          layer.bindTooltip(`<strong>${cname}</strong>`, {
            direction: 'center',
            className: 'country-border-tooltip'
          });
          layer.on('click', () => {
            focusPlaceByName(cname);
          });
        }
      });
      boundariesLayerGroup.addLayer(worldLayer);
    }

    // 2. IBGE Brazilian States GeoJSON (Official State Boundaries)
    if (window.GEOJSON_ESTADOS_BRASIL) {
      const statesLayer = L.geoJSON(window.GEOJSON_ESTADOS_BRASIL, {
        style: function (feat) {
          const name = feat.properties.name;
          const uf = feat.properties.uf;
          const isDest = (name === 'São Paulo');
          const isOrigin = isStateOrigin(name);

          return {
            color: isDest ? '#f59e0b' : (isOrigin ? '#0284c7' : '#64748b'),
            weight: isDest ? 2.5 : (isOrigin ? 1.8 : 1.0),
            opacity: 0.95,
            fillColor: isDest ? '#fef3c7' : (isOrigin ? '#e0f2fe' : '#ffffff'),
            fillOpacity: isDest ? 0.4 : (isOrigin ? 0.25 : 0.04),
            dashArray: isOrigin || isDest ? null : '3, 3'
          };
        },
        onEachFeature: function (feat, layer) {
          const name = feat.properties.name;
          const uf = feat.properties.uf;
          const isDest = (name === 'São Paulo');

          const tooltipHtml = isDest
            ? `<strong>📍 São Paulo (${uf})</strong><br/><span style="color: #f59e0b; font-size: 10px;">Escola de Aplicação FEUSP (Destino)</span>`
            : `<strong>${name} (${uf})</strong>`;

          layer.bindTooltip(tooltipHtml, {
            direction: 'center',
            className: 'state-border-tooltip'
          });

          // State hover highlight
          layer.on('mouseover', function () {
            layer.setStyle({ weight: 3, opacity: 1, fillOpacity: 0.5 });
          });
          layer.on('mouseout', function () {
            statesLayer.resetStyle(layer);
          });

          layer.on('click', () => {
            focusPlaceByName(name);
          });
        }
      });
      boundariesLayerGroup.addLayer(statesLayer);
    }
  }

  function isStateOrigin(name) {
    if (name === 'São Paulo') return false;
    const turmaKey = state.turma;
    const p = DATA.dados_brutos.estados.pais?.[turmaKey]?.[name] || 0;
    const a = DATA.dados_brutos.estados.avos?.[turmaKey]?.[name] || 0;
    const b = DATA.dados_brutos.estados.bisavos?.[turmaKey]?.[name] || 0;
    return (p + a + b) > 0;
  }

  function isCountryOrigin(name) {
    if (name === 'Brasil' || name === 'Brazil') return false;
    const turmaKey = state.turma;
    // Normalize country search
    for (const [coName, meta] of Object.entries(DATA.paises_meta)) {
      if (coName === 'Brasil') continue;
      if (name.toLowerCase().includes(coName.toLowerCase()) || coName.toLowerCase().includes(name.toLowerCase())) {
        const p = DATA.dados_brutos.paises.pais?.[turmaKey]?.[coName] || 0;
        const a = DATA.dados_brutos.paises.avos?.[turmaKey]?.[coName] || 0;
        const b = DATA.dados_brutos.paises.bisavos?.[turmaKey]?.[coName] || 0;
        return (p + a + b) > 0;
      }
    }
    return false;
  }

  // =========================================================================
  // Data Filtering & Generational Flow Construction
  // =========================================================================
  function getFilteredFlows() {
    const flows = [];
    const turmaKey = state.turma; // '7ºEF', '7ºI', '7ºII'

    // Determine generations to include
    const genList = state.generation === 'todas'
      ? ['bisavos', 'avos', 'pais']
      : (state.generation === 'estudantes' ? ['estudantes'] : [state.generation]);

    // Curvature offsets so multiple generations for the same location do not overlap
    const GEN_OFFSETS = {
      bisavos: 0.05,
      avos: 0.0,
      pais: -0.05
    };

    // 1. Process Brazilian States
    if (state.scope === 'todos' || state.scope === 'nacional') {
      for (const [name, meta] of Object.entries(DATA.estados_meta)) {
        if (name === 'São Paulo') continue; // Destination
        if (state.searchQuery && !name.toLowerCase().includes(state.searchQuery.toLowerCase())) continue;

        // Breakdown counts
        const countBisavos = DATA.dados_brutos.estados.bisavos?.[turmaKey]?.[name] || 0;
        const countAvos = DATA.dados_brutos.estados.avos?.[turmaKey]?.[name] || 0;
        const countPais = DATA.dados_brutos.estados.pais?.[turmaKey]?.[name] || 0;
        const totalPlace = countBisavos + countAvos + countPais;

        if (totalPlace < state.minVolume) continue;

        genList.forEach(g => {
          const qty = g === 'bisavos' ? countBisavos : (g === 'avos' ? countAvos : (g === 'pais' ? countPais : 0));
          if (qty > 0) {
            flows.push({
              id: `flow_st_${name}_${g}`,
              placeKey: name,
              nome: name,
              tipo: 'estado',
              geracao: g,
              geracaoLabel: GEN_LABELS[g],
              uf: meta.uf,
              capital: meta.capital,
              regiao: meta.regiao,
              cor: GEN_COLORS[g],
              curvOffset: GEN_OFFSETS[g] || 0,
              quantidade: qty,
              totalLugar: totalPlace,
              lat: meta.lat,
              lng: meta.lng,
              destLat: DEST_FEUSP.lat,
              destLng: DEST_FEUSP.lng,
              distKm: meta.dist_km,
              breakdown: {
                bisavos: countBisavos,
                avos: countAvos,
                pais: countPais
              }
            });
          }
        });
      }
    }

    // 2. Process Foreign Countries
    if (state.scope === 'todos' || state.scope === 'internacional') {
      for (const [name, meta] of Object.entries(DATA.paises_meta)) {
        if (name === 'Brasil') continue; // National
        if (state.searchQuery && !name.toLowerCase().includes(state.searchQuery.toLowerCase())) continue;

        // Breakdown counts
        const countBisavos = DATA.dados_brutos.paises.bisavos?.[turmaKey]?.[name] || 0;
        const countAvos = DATA.dados_brutos.paises.avos?.[turmaKey]?.[name] || 0;
        const countPais = DATA.dados_brutos.paises.pais?.[turmaKey]?.[name] || 0;
        const totalPlace = countBisavos + countAvos + countPais;

        if (totalPlace < state.minVolume) continue;

        genList.forEach(g => {
          const qty = g === 'bisavos' ? countBisavos : (g === 'avos' ? countAvos : (g === 'pais' ? countPais : 0));
          if (qty > 0) {
            flows.push({
              id: `flow_co_${name}_${g}`,
              placeKey: name,
              nome: name,
              tipo: 'pais',
              geracao: g,
              geracaoLabel: GEN_LABELS[g],
              iso: meta.iso,
              continente: meta.continente,
              emoji: meta.emoji,
              capital: meta.capital,
              cor: GEN_COLORS[g],
              curvOffset: GEN_OFFSETS[g] || 0,
              quantidade: qty,
              totalLugar: totalPlace,
              lat: meta.lat,
              lng: meta.lng,
              destLat: DEST_FEUSP.lat,
              destLng: DEST_FEUSP.lng,
              distKm: meta.dist_km,
              breakdown: {
                bisavos: countBisavos,
                avos: countAvos,
                pais: countPais
              }
            });
          }
        });
      }
    }

    // Calculate percentage based on total in current view
    const totalMigrantsInView = flows.reduce((sum, f) => sum + f.quantidade, 0);
    flows.forEach(f => {
      f.porcentagem = totalMigrantsInView > 0 ? ((f.quantidade / totalMigrantsInView) * 100).toFixed(1) : '0';
    });

    // Sort descending by volume
    flows.sort((a, b) => b.quantidade - a.quantidade);
    return flows;
  }

  // =========================================================================
  // Curved Bezier Geometry Generator
  // =========================================================================
  function generateCurvePoints(p0, p1, baseCurvature, offsetCurvature, numPoints) {
    const lat0 = p0[0], lng0 = p0[1];
    const lat1 = p1[0], lng1 = p1[1];
    numPoints = numPoints || 36;

    // Midpoint
    const midLat = (lat0 + lat1) / 2.0;
    const midLng = (lng0 + lng1) / 2.0;

    // Delta vector
    const dLat = lat1 - lat0;
    const dLng = lng1 - lng0;
    const dist = Math.hypot(dLat, dLng);

    // Normal vector perpendicular to chord
    const normLat = dist > 0 ? -dLng / dist : 0;
    const normLng = dist > 0 ? dLat / dist : 0;

    // Net curvature with generation separation offset
    const curvature = (baseCurvature || 0.16) + (offsetCurvature || 0);
    const ctrlLat = midLat + normLat * dist * curvature;
    const ctrlLng = midLng + normLng * dist * curvature;

    // Interpolate points along Quadratic Bezier curve
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const lat = (1 - t) * (1 - t) * lat0 + 2 * (1 - t) * t * ctrlLat + t * t * lat1;
      const lng = (1 - t) * (1 - t) * lng0 + 2 * (1 - t) * t * ctrlLng + t * t * lng1;
      points.push([lat, lng]);
    }
    return points;
  }

  // Compute tangent rotation angle for arrowhead in degrees
  function computeTangentAngle(pt1, pt2) {
    const pA = map.latLngToLayerPoint(pt1);
    const pB = map.latLngToLayerPoint(pt2);
    const rad = Math.atan2(pB.y - pA.y, pB.x - pA.x);
    return (rad * 180 / Math.PI) + 90;
  }

  // =========================================================================
  // Render Map Overlays (Flows, Colored Arrows & Markers)
  // =========================================================================
  function renderMapLayers(flows) {
    flowLayerGroup.clearLayers();
    arrowLayerGroup.clearLayers();
    originLayerGroup.clearLayers();
    destinationLayerGroup.clearLayers();

    currentFlowObjects = flows;

    // Render Destination (Escola de Aplicação FEUSP / SP)
    renderDestinationMarker();

    if (flows.length === 0) return;

    // Curvature variations per place
    const curvatureMap = {
      'Bahia': 0.16,
      'Minas Gerais': -0.18,
      'Pernambuco': 0.22,
      'Ceará': 0.25,
      'Alagoas': 0.14,
      'Rio Grande do Sul': -0.16,
      'Paraná': -0.14,
      'Santa Catarina': -0.20,
      'Piauí': 0.20,
      'Paraíba': 0.24,
      'Rio de Janeiro': -0.22,
      'Sergipe': 0.12,
      'Espírito Santo': -0.12,
      'Portugal': 0.15,
      'Alemanha': 0.18,
      'Itália': 0.12,
      'França': 0.16,
      'Polônia': 0.20,
      'Armênia': 0.22,
      'China': -0.15,
      'Japão': -0.20,
      'El Salvador': 0.15,
      'Inglaterra - RU': 0.19,
      'Áustria': 0.14,
      'Rússia': 0.25,
      'Ucrânia': 0.21
    };

    // Render each generational flow line with its distinct color and arrow
    flows.forEach((flow, idx) => {
      const pOrigin = [flow.lat, flow.lng];
      const pDest = [flow.destLat, flow.destLng];
      const baseCurv = curvatureMap[flow.nome] !== undefined ? curvatureMap[flow.nome] : ((idx % 2 === 0 ? 1 : -1) * 0.16);

      // Generate curved points with generation separation offset
      const curvePts = generateCurvePoints(pOrigin, pDest, baseCurv, flow.curvOffset, 42);

      // Line thickness based on volume
      const baseWeight = Math.min(9, Math.max(2.5, 1.8 + Math.sqrt(flow.quantidade) * 1.3));

      // Glow casing line
      const glowLine = L.polyline(curvePts, {
        color: flow.cor,
        weight: baseWeight + 4,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false
      });
      flowLayerGroup.addLayer(glowLine);

      // Main flow line in the exact generation color
      const mainLine = L.polyline(curvePts, {
        color: flow.cor,
        weight: baseWeight,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        className: 'flow-main-line'
      });

      // Animated dash line (flowing particles)
      const dashLine = L.polyline(curvePts, {
        color: '#ffffff',
        weight: Math.max(1.8, baseWeight * 0.55),
        opacity: 0.9,
        lineCap: 'round',
        className: 'flow-dash-layer'
      });
      flowLayerGroup.addLayer(dashLine);
      flowLayerGroup.addLayer(mainLine);

      // Directional Arrowhead in the exact generation color pointing to SP
      const arrowIdx = Math.floor(curvePts.length * 0.78);
      const arrowPt = curvePts[arrowIdx];
      const arrowNextPt = curvePts[arrowIdx + 1];

      const arrowMarker = L.marker(arrowPt, {
        icon: createArrowIcon(arrowPt, arrowNextPt, flow.cor, baseWeight),
        interactive: false
      });
      arrowMarker._flowPtA = arrowPt;
      arrowMarker._flowPtB = arrowNextPt;
      arrowMarker._flowColor = flow.cor;
      arrowMarker._flowWeight = baseWeight;
      arrowLayerGroup.addLayer(arrowMarker);

      // Hover Tooltip
      const genBadge = flow.geracao === 'bisavos' ? '🟣 Bisavós' : (flow.geracao === 'avos' ? '🟡 Avós' : '🔵 Pais');
      const tooltipContent = `
        <div style="font-size: 12px; font-weight: 600; text-align: center;">
          <span style="color: ${flow.cor}; font-size: 11px; text-transform: uppercase;">${genBadge}</span><br/>
          <strong>${flow.nome}</strong> ➔ São Paulo<br/>
          <span style="color: ${flow.cor}; font-size: 13px; font-weight: 700;">${flow.quantidade} ${flow.quantidade === 1 ? 'migrante' : 'migrantes'}</span>
        </div>
      `;
      mainLine.bindTooltip(tooltipContent, { className: 'custom-flow-tooltip', sticky: true });

      // Click Popup with complete analysis
      const popupContent = buildFlowPopup(flow);
      mainLine.bindPopup(popupContent, { maxWidth: 320 });

      // Interaction
      mainLine.on('mouseover', () => {
        glowLine.setStyle({ weight: baseWeight + 8, opacity: 0.8, color: '#ffffff' });
        mainLine.setStyle({ weight: baseWeight + 2, opacity: 1 });
      });
      mainLine.on('mouseout', () => {
        if (state.selectedFlowId !== flow.id) {
          glowLine.setStyle({ weight: baseWeight + 4, opacity: 0.35, color: flow.cor });
          mainLine.setStyle({ weight: baseWeight, opacity: 0.9 });
        }
      });
      mainLine.on('click', () => selectFlow(flow));

      // Keep references
      flow._mainLine = mainLine;
      flow._glowLine = glowLine;
      flow._curvePts = curvePts;
    });

    // Render Origin Markers (Aggregated per place)
    renderOriginMarkers(flows);

    // Toggle animation class on map container
    updateAnimationState();
  }

  // Render Origin Pin/Circle Markers
  function renderOriginMarkers(flows) {
    // Group flows by placeKey
    const places = {};
    flows.forEach(f => {
      if (!places[f.placeKey]) {
        places[f.placeKey] = {
          nome: f.nome,
          tipo: f.tipo,
          lat: f.lat,
          lng: f.lng,
          total: f.totalLugar,
          breakdown: f.breakdown,
          flows: []
        };
      }
      places[f.placeKey].flows.push(f);
    });

    Object.values(places).forEach(p => {
      const radius = Math.max(9, Math.min(24, 7 + Math.sqrt(p.total) * 2.4));

      // Border or background color
      const dominantGen = p.breakdown.bisavos >= p.breakdown.avos && p.breakdown.bisavos >= p.breakdown.pais
        ? 'bisavos'
        : (p.breakdown.avos >= p.breakdown.pais ? 'avos' : 'pais');
      const markerColor = state.generation !== 'todas' ? GEN_COLORS[state.generation] : GEN_COLORS[dominantGen];

      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: 'origin-marker-wrapper',
          html: `
            <div class="origin-div-marker" style="
              width: ${radius * 2}px; 
              height: ${radius * 2}px; 
              background-color: ${markerColor};
              border: 2.5px solid #ffffff;
            ">
              ${p.total}
            </div>
          `,
          iconSize: [radius * 2, radius * 2],
          iconAnchor: [radius, radius]
        })
      });

      marker.bindTooltip(`
        <div style="font-weight: 700; text-align: center;">
          ${p.nome} ➔ São Paulo<br/>
          <span style="font-size: 11px; color: ${markerColor};">${p.total} migrantes totais</span>
        </div>
      `, { className: 'custom-flow-tooltip', direction: 'top', offset: [0, -radius] });

      marker.on('click', () => {
        if (p.flows.length > 0) selectFlow(p.flows[0]);
      });

      originLayerGroup.addLayer(marker);
    });
  }

  // Destination Marker (Escola de Aplicação FEUSP)
  function renderDestinationMarker() {
    const pDest = [DEST_FEUSP.lat, DEST_FEUSP.lng];

    const destMarker = L.marker(pDest, {
      icon: L.divIcon({
        className: 'pulse-target-wrapper',
        html: `
          <div class="pulse-target">
            <div class="pulse-target-ring"></div>
            <div class="pulse-target-core" title="Escola de Aplicação FEUSP (USP)">
              🎓
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      }),
      zIndexOffset: 1000
    });

    destMarker.bindTooltip(`
      <div style="font-weight: 700; text-align: center;">
        📍 ${DEST_FEUSP.nome}<br/>
        <span style="font-size: 11px; color: #f59e0b;">Ponto de Convergência (São Paulo)</span>
      </div>
    `, { className: 'custom-flow-tooltip', direction: 'top', offset: [0, -16] });

    destMarker.bindPopup(buildDestinationPopup(), { maxWidth: 340 });
    destinationLayerGroup.addLayer(destMarker);
  }

  // Build arrow icon in the exact generation color
  function createArrowIcon(pt1, pt2, color, weight) {
    const angle = computeTangentAngle(pt1, pt2);
    const size = Math.min(26, Math.max(18, 14 + weight * 1.2));

    return L.divIcon({
      className: 'flow-arrow-marker',
      html: `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" style="transform: rotate(${angle}deg); filter: drop-shadow(0 0 3px rgba(0,0,0,0.7));">
          <path d="M12 2 L22 22 L12 17 L2 22 Z" fill="${color}" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  function updateArrowheadRotations() {
    arrowLayerGroup.eachLayer(layer => {
      if (layer._flowPtA && layer._flowPtB) {
        layer.setIcon(createArrowIcon(layer._flowPtA, layer._flowPtB, layer._flowColor, layer._flowWeight));
      }
    });
  }

  function updateAnimationState() {
    const mapEl = document.getElementById('map');
    if (state.animationEnabled) {
      mapEl.classList.add('flow-anim-active');
    } else {
      mapEl.classList.remove('flow-anim-active');
    }
  }

  // =========================================================================
  // Popups HTML Builders
  // =========================================================================
  function buildFlowPopup(flow) {
    const isState = flow.tipo === 'estado';
    const flagOrEmoji = isState
      ? `<span class="uf-badge">${flow.uf}</span>`
      : `<span style="font-size: 18px;">${flow.emoji}</span>`;

    const categoryText = isState
      ? `Estado do Brasil • Região ${flow.regiao}`
      : `País • Continente: ${flow.continente}`;

    const genBadge = flow.geracao === 'bisavos'
      ? `<span class="gen-pill-mini bisavos">🟣 Bisavós (3ª G.)</span>`
      : (flow.geracao === 'avos' ? `<span class="gen-pill-mini avos">🟡 Avós (2ª G.)</span>` : `<span class="gen-pill-mini pais">🔵 Pais (1ª G.)</span>`);

    return `
      <div class="popup-header">
        <div class="popup-title">
          ${flagOrEmoji}
          <span>${flow.nome} ➔ São Paulo</span>
        </div>
        <div class="popup-category">${categoryText}</div>
        <div style="margin-top: 5px;">${genBadge}</div>
      </div>

      <div class="popup-stat-grid">
        <div class="popup-stat-box">
          <div class="popup-stat-val" style="color: ${flow.cor};">${flow.quantidade}</div>
          <div class="popup-stat-lbl">Nesta Geração</div>
        </div>
        <div class="popup-stat-box">
          <div class="popup-stat-val">${flow.totalLugar}</div>
          <div class="popup-stat-lbl">Total do Local</div>
        </div>
      </div>

      <div style="font-size: 11.5px; color: var(--text-secondary); margin: 6px 0;">
        📍 <strong>Distância até SP:</strong> ~${flow.distKm.toLocaleString('pt-BR')} km em linha reta
      </div>

      <div class="popup-breakdown-list">
        <div style="font-weight: 700; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; color: var(--text-muted);">
          Balanço por Geração:
        </div>
        <div class="popup-breakdown-row">
          <span>🟣 Bisavós:</span>
          <strong style="color: ${GEN_COLORS.bisavos};">${flow.breakdown.bisavos}</strong>
        </div>
        <div class="popup-breakdown-row">
          <span>🟡 Avós:</span>
          <strong style="color: ${GEN_COLORS.avos};">${flow.breakdown.avos}</strong>
        </div>
        <div class="popup-breakdown-row">
          <span>🔵 Pais:</span>
          <strong style="color: ${GEN_COLORS.pais};">${flow.breakdown.pais}</strong>
        </div>
      </div>
    `;
  }

  function buildDestinationPopup() {
    const turmaKey = state.turma;
    const spEstudantes = DATA.dados_brutos.estados.estudantes[turmaKey]?.['São Paulo'] || 0;
    const spPais = DATA.dados_brutos.estados.pais[turmaKey]?.['São Paulo'] || 0;
    const spAvos = DATA.dados_brutos.estados.avos[turmaKey]?.['São Paulo'] || 0;
    const spBisavos = DATA.dados_brutos.estados.bisavos[turmaKey]?.['São Paulo'] || 0;

    return `
      <div class="popup-header">
        <div class="popup-title" style="color: #f59e0b;">
          🎓 ${DEST_FEUSP.nome}
        </div>
        <div class="popup-category">Universidade de São Paulo (USP) • Butantã</div>
      </div>

      <div style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 8px;">
        ${DEST_FEUSP.endereco}
      </div>

      <div style="background: rgba(245, 158, 11, 0.12); border-left: 3px solid #f59e0b; padding: 8px 10px; border-radius: 0 4px 4px 0; font-size: 11.5px; margin-bottom: 10px;">
        <strong>Ponto de Convergência Demográfica:</strong> Todas as rotas migratórias investigadas convergem para a escola onde os estudantes do 7º ano pesquisaram suas árvores genealógicas.
      </div>

      <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">
        Nascidos em São Paulo (Autóctones):
      </div>

      <div class="popup-breakdown-row">
        <span>🎒 Estudantes (7º ano):</span>
        <strong style="color: #10b981;">${spEstudantes} (100%)</strong>
      </div>
      <div class="popup-breakdown-row">
        <span>🔵 Pais:</span>
        <strong style="color: ${GEN_COLORS.pais};">${spPais}</strong>
      </div>
      <div class="popup-breakdown-row">
        <span>🟡 Avós:</span>
        <strong style="color: ${GEN_COLORS.avos};">${spAvos}</strong>
      </div>
      <div class="popup-breakdown-row">
        <span>🟣 Bisavós:</span>
        <strong style="color: ${GEN_COLORS.bisavos};">${spBisavos}</strong>
      </div>
    `;
  }

  // =========================================================================
  // Select Flow Action (Focus & Highlight)
  // =========================================================================
  function selectFlow(flow) {
    state.selectedFlowId = flow.id;

    // Highlight selected flow and dim others
    currentFlowObjects.forEach(f => {
      if (f._glowLine && f._mainLine) {
        if (f.id === flow.id || f.placeKey === flow.placeKey) {
          f._glowLine.setStyle({ weight: 14, opacity: 0.9, color: '#ffffff' });
          f._mainLine.setStyle({ weight: 7, opacity: 1 });
        } else {
          f._glowLine.setStyle({ opacity: 0.1 });
          f._mainLine.setStyle({ opacity: 0.25 });
        }
      }
    });

    // Zoom to fit bounds of the selected curve
    if (flow._curvePts && flow._curvePts.length > 0) {
      const bounds = L.latLngBounds(flow._curvePts);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8, animate: true });
    }

    if (flow._mainLine) {
      flow._mainLine.openPopup();
    }

    // Highlight row in ranking list
    document.querySelectorAll('.ranking-item').forEach(el => {
      if (el.dataset.placeKey === flow.placeKey) {
        el.classList.add('selected');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        el.classList.remove('selected');
      }
    });
  }

  function focusPlaceByName(name) {
    const flow = currentFlowObjects.find(f => f.nome.toLowerCase() === name.toLowerCase());
    if (flow) {
      selectFlow(flow);
    }
  }

  // =========================================================================
  // Update Analytics, Sidebar, KPIs, & Ranking
  // =========================================================================
  function updateSidebar(flows) {
    // 1. KPI Calculations
    const totalMigrantes = flows.reduce((sum, f) => sum + f.quantidade, 0);
    const uniquePlaces = new Set(flows.map(f => f.placeKey));
    const totalOrigens = uniquePlaces.size;

    const nationalFlows = flows.filter(f => f.tipo === 'estado');
    const internationalFlows = flows.filter(f => f.tipo === 'pais');

    // Aggregate by place for top ranking
    const placeAgg = {};
    flows.forEach(f => {
      placeAgg[f.placeKey] = (placeAgg[f.placeKey] || 0) + f.quantidade;
    });

    let topNatName = '-', topNatQty = 0;
    nationalFlows.forEach(f => {
      if (placeAgg[f.placeKey] > topNatQty) {
        topNatQty = placeAgg[f.placeKey];
        topNatName = `${f.nome} (${topNatQty})`;
      }
    });

    let topIntlName = '-', topIntlQty = 0;
    internationalFlows.forEach(f => {
      if (placeAgg[f.placeKey] > topIntlQty) {
        topIntlQty = placeAgg[f.placeKey];
        topIntlName = `${f.nome} (${topIntlQty})`;
      }
    });

    // Nascidos em SP
    const turmaKey = state.turma;
    let nascidosSP = 0;
    if (state.generation === 'todas') {
      const spPais = DATA.dados_brutos.estados.pais[turmaKey]?.['São Paulo'] || 0;
      const spAvos = DATA.dados_brutos.estados.avos[turmaKey]?.['São Paulo'] || 0;
      const spBisavos = DATA.dados_brutos.estados.bisavos[turmaKey]?.['São Paulo'] || 0;
      nascidosSP = spPais + spAvos + spBisavos;
    } else if (state.generation === 'estudantes') {
      nascidosSP = DATA.dados_brutos.estados.estudantes[turmaKey]?.['São Paulo'] || 0;
    } else {
      nascidosSP = DATA.dados_brutos.estados[state.generation]?.[turmaKey]?.['São Paulo'] || 0;
    }

    // Update KPI DOM elements
    document.getElementById('kpi-total-migrantes').textContent = totalMigrantes;
    document.getElementById('kpi-total-origens').textContent = totalOrigens;
    document.getElementById('kpi-top-national').textContent = topNatName;
    document.getElementById('kpi-top-international').textContent = topIntlName;
    document.getElementById('kpi-nascidos-sp').textContent = nascidosSP;

    // Render High-Contrast Ranking List
    renderRankingList(flows);

    // Render Generational Breakdown Tab
    renderGenerationalBreakdown();
  }

  function renderRankingList(flows) {
    const listEl = document.getElementById('ranking-list');
    listEl.innerHTML = '';

    if (flows.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 24px 0; color: var(--text-muted); font-size: 12px;">
          Nenhum fluxo encontrado com os filtros atuais.
        </div>
      `;
      return;
    }

    // Group flows by placeKey
    const grouped = {};
    flows.forEach(f => {
      if (!grouped[f.placeKey]) {
        grouped[f.placeKey] = {
          nome: f.nome,
          tipo: f.tipo,
          uf: f.uf,
          emoji: f.emoji,
          distKm: f.distKm,
          total: 0,
          bisavos: f.breakdown.bisavos,
          avos: f.breakdown.avos,
          pais: f.breakdown.pais,
          primaryFlow: f
        };
      }
      grouped[f.placeKey].total += f.quantidade;
    });

    const rankedPlaces = Object.values(grouped).sort((a, b) => b.total - a.total);
    const maxTotal = rankedPlaces[0].total;

    rankedPlaces.forEach((item, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'ranking-item';
      itemEl.dataset.placeKey = item.nome;
      if (state.selectedFlowId && state.selectedFlowId.includes(item.nome)) {
        itemEl.classList.add('selected');
      }

      const isIntl = item.tipo === 'pais';

      // Bar scaling
      const barScale = maxTotal > 0 ? Math.max(14, (item.total / maxTotal) * 100) : 100;

      // Badges and Bar HTML based on active generation filter
      let badgesHtml = '';
      let barHtml = '';

      if (state.generation === 'todas') {
        const pBisavos = item.total > 0 ? (item.bisavos / item.total) * 100 : 0;
        const pAvos = item.total > 0 ? (item.avos / item.total) * 100 : 0;
        const pPais = item.total > 0 ? (item.pais / item.total) * 100 : 0;

        barHtml = `
          <div class="ranking-bar-track">
            <div class="ranking-bar-multi" style="width: ${barScale}%;">
              ${item.bisavos > 0 ? `<div class="bar-seg bisavos" style="width: ${pBisavos}%;" title="Bisavós: ${item.bisavos}"></div>` : ''}
              ${item.avos > 0 ? `<div class="bar-seg avos" style="width: ${pAvos}%;" title="Avós: ${item.avos}"></div>` : ''}
              ${item.pais > 0 ? `<div class="bar-seg pais" style="width: ${pPais}%;" title="Pais: ${item.pais}"></div>` : ''}
            </div>
          </div>
        `;

        badgesHtml = `
          <div class="ranking-gen-badges">
            ${item.bisavos > 0 ? `<span class="gen-pill-mini bisavos">🟣 ${item.bisavos} Bisavós</span>` : ''}
            ${item.avos > 0 ? `<span class="gen-pill-mini avos">🟡 ${item.avos} Avós</span>` : ''}
            ${item.pais > 0 ? `<span class="gen-pill-mini pais">🔵 ${item.pais} Pais</span>` : ''}
          </div>
        `;
      } else {
        const genKey = state.generation; // 'bisavos', 'avos', 'pais'
        const genLabel = genKey === 'bisavos' ? 'Bisavós' : (genKey === 'avos' ? 'Avós' : 'Pais');
        const icon = genKey === 'bisavos' ? '🟣' : (genKey === 'avos' ? '🟡' : '🔵');
        const totalHistorico = item.bisavos + item.avos + item.pais;

        barHtml = `
          <div class="ranking-bar-track">
            <div class="ranking-bar-multi" style="width: ${barScale}%;">
              <div class="bar-seg ${genKey}" style="width: 100%;"></div>
            </div>
          </div>
        `;

        badgesHtml = `
          <div class="ranking-gen-badges">
            <span class="gen-pill-mini ${genKey}">${icon} ${item.total} ${genLabel}</span>
            ${totalHistorico > item.total ? `<span style="font-size: 10.5px; color: var(--text-muted); align-self: center;">(Total: ${totalHistorico})</span>` : ''}
          </div>
        `;
      }

      itemEl.innerHTML = `
        <div class="ranking-header">
          <div class="ranking-name">
            <span class="ranking-rank">#${idx + 1}</span>
            ${isIntl ? `<span style="font-size: 14px;">${item.emoji}</span>` : `<span class="uf-badge">${item.uf}</span>`}
            <span>${item.nome}</span>
          </div>
          <div class="ranking-total-val">
            ${item.total} <span style="font-size: 10.5px; font-weight: 600; color: var(--text-muted);">migrantes</span>
          </div>
        </div>

        ${barHtml}
        ${badgesHtml}

        <div class="ranking-sub-info">
          <span>${item.tipo === 'estado' ? 'Nacional (Brasil)' : 'Internacional'}</span>
          <span>~${item.distKm.toLocaleString('pt-BR')} km até SP</span>
        </div>
      `;

      itemEl.addEventListener('click', () => {
        selectFlow(item.primaryFlow);
      });

      listEl.appendChild(itemEl);
    });
  }

  function renderGenerationalBreakdown() {
    const container = document.getElementById('gen-breakdown-container');
    if (!container) return;

    const turmaKey = state.turma;

    const generations = [
      { key: 'estudantes', label: 'Estudantes (7º ano)', desc: 'Geração atual', cor: GEN_COLORS.estudantes },
      { key: 'pais', label: 'Pais (1ª Geração)', desc: '1ª geração ascendente', cor: GEN_COLORS.pais },
      { key: 'avos', label: 'Avós (2ª Geração)', desc: '2ª geração ascendente', cor: GEN_COLORS.avos },
      { key: 'bisavos', label: 'Bisavós (3ª Geração)', desc: '3ª geração ascendente', cor: GEN_COLORS.bisavos }
    ];

    let html = '';
    generations.forEach(g => {
      const stObj = DATA.dados_brutos.estados[g.key]?.[turmaKey] || {};
      const coObj = DATA.dados_brutos.paises[g.key]?.[turmaKey] || {};

      const spCount = stObj['São Paulo'] || 0;

      let outStatesCount = 0;
      for (const [s, c] of Object.entries(stObj)) {
        if (s !== 'São Paulo') outStatesCount += c;
      }

      let outCountriesCount = 0;
      for (const [p, c] of Object.entries(coObj)) {
        if (p !== 'Brasil') outCountriesCount += c;
      }

      const totalExternal = outStatesCount + outCountriesCount;
      const totalAll = spCount + totalExternal;
      const spRatio = totalAll > 0 ? ((spCount / totalAll) * 100).toFixed(0) : 0;
      const extRatio = totalAll > 0 ? ((totalExternal / totalAll) * 100).toFixed(0) : 0;

      html += `
        <div class="gen-breakdown-row" style="border-left-color: ${g.cor};">
          <div>
            <div class="gen-name" style="color: ${g.cor};">${g.label}</div>
            <div style="font-size: 10px; color: var(--text-muted);">${g.desc}</div>
          </div>
          <div class="gen-stats">
            <div><span class="gen-migrantes" style="color: ${g.cor};">${totalExternal}</span> migrantes (${extRatio}%)</div>
            <div style="color: var(--text-muted); font-size: 10px;">${spCount} nascidos em SP (${spRatio}%)</div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // =========================================================================
  // Master View Update Trigger
  // =========================================================================
  function updateView() {
    state.selectedFlowId = null;
    const flows = getFilteredFlows();
    renderMapLayers(flows);
    updateSidebar(flows);
  }

  // =========================================================================
  // Controls & Event Listeners
  // =========================================================================
  function initControls() {
    // Populate Turma dropdown
    const turmaSelect = document.getElementById('select-turma');
    turmaSelect.innerHTML = `
      <option value="7ºEF" selected>Todas as Turmas (7º EF - 43 alunos)</option>
      <option value="7ºI">Turma 7º I (23 alunos)</option>
      <option value="7ºII">Turma 7º II (20 alunos)</option>
    `;

    // Populate Volume Filter
    const volInput = document.getElementById('filter-min-volume');
    const volVal = document.getElementById('val-min-volume');
    if (volInput && volVal) {
      volInput.addEventListener('input', (e) => {
        state.minVolume = parseInt(e.target.value, 10);
        volVal.textContent = `>= ${state.minVolume}`;
        updateView();
      });
    }

    // Search Filter
    const searchInput = document.getElementById('input-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        updateView();
      });
    }
  }

  function initEventListeners() {
    // Sidebar Collapse Toggle
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      toggleBtn.innerHTML = sidebar.classList.contains('collapsed')
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>`;
      setTimeout(() => map.invalidateSize(), 350);
    });

    // Basemap Switcher Buttons (Watermark-Free Layers)
    const basemapButtons = document.querySelectorAll('.basemap-btn');
    basemapButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.basemap;
        if (type && baseLayers[type]) {
          // Remove all active basemaps
          Object.values(baseLayers).forEach(layer => map.removeLayer(layer));
          // Add selected basemap
          baseLayers[type].addTo(map);
          state.activeBasemap = type;

          basemapButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          // Ensure boundaries are visible if checked
          if (state.showDivisas && !map.hasLayer(boundariesLayerGroup)) {
            boundariesLayerGroup.addTo(map);
          }

          // Adjust theme styling
          if (type === 'dark') {
            document.body.classList.remove('theme-light');
          } else if (type === 'political') {
            document.body.classList.add('theme-light');
          } else {
            document.body.classList.remove('theme-light');
          }
        }
      });
    });

    // Divisas dos Estados Toggle Checkbox
    const divisasToggle = document.getElementById('toggle-divisas');
    if (divisasToggle) {
      divisasToggle.addEventListener('change', (e) => {
        state.showDivisas = e.target.checked;
        if (state.showDivisas) {
          boundariesLayerGroup.addTo(map);
        } else {
          map.removeLayer(boundariesLayerGroup);
        }
      });
    }

    // Generation Filter Pills (Distinguishing Bisavós, Avós, Pais)
    const genPills = document.querySelectorAll('.pill-btn[data-gen]');
    genPills.forEach(pill => {
      pill.addEventListener('click', () => {
        genPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.generation = pill.dataset.gen;
        updateView();
      });
    });

    // Scope Filter Pills
    const scopePills = document.querySelectorAll('.pill-btn[data-scope]');
    scopePills.forEach(pill => {
      pill.addEventListener('click', () => {
        scopePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.scope = pill.dataset.scope;
        updateView();
      });
    });

    // Turma Dropdown
    const turmaSelect = document.getElementById('select-turma');
    turmaSelect.addEventListener('change', (e) => {
      state.turma = e.target.value;
      initBoundariesLayers(); // Update state colors
      updateView();
    });

    // Flow Animation Switch
    const animToggle = document.getElementById('toggle-flow-animation');
    animToggle.addEventListener('change', (e) => {
      state.animationEnabled = e.target.checked;
      updateAnimationState();
    });

    // Quick Zoom Buttons
    document.getElementById('btn-zoom-brasil').addEventListener('click', () => {
      map.flyTo([-14.235, -51.925], 4, { duration: 1.2 });
    });

    document.getElementById('btn-zoom-world').addEventListener('click', () => {
      map.flyTo([20.0, 0.0], 2, { duration: 1.5 });
    });

    document.getElementById('btn-zoom-sp').addEventListener('click', () => {
      map.flyTo([DEST_FEUSP.lat, DEST_FEUSP.lng], 13, { duration: 1.2 });
      setTimeout(() => {
        destinationLayerGroup.eachLayer(l => l.openPopup());
      }, 1300);
    });

    // Sidebar Tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPane = document.getElementById(btn.dataset.tab);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // Modal Table Toggle
    const modal = document.getElementById('table-modal');
    document.getElementById('btn-open-modal').addEventListener('click', () => {
      populateDataTable();
      modal.classList.add('active');
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => {
      modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });

    // CSV Download Button
    document.getElementById('btn-download-csv').addEventListener('click', downloadCSV);
  }

  // =========================================================================
  // Data Table Modal Logic
  // =========================================================================
  function populateDataTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    const flows = getFilteredFlows();
    flows.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${f.nome}</strong></td>
        <td><span style="color: ${f.cor}; font-weight: 700;">${f.geracaoLabel}</span></td>
        <td>${f.tipo === 'estado' ? f.regiao : f.continente}</td>
        <td><strong style="color: ${f.cor}; font-size: 13px;">${f.quantidade}</strong></td>
        <td>${f.totalLugar}</td>
        <td>~${f.distKm.toLocaleString('pt-BR')} km</td>
        <td>Bisavós: ${f.breakdown.bisavos} | Avós: ${f.breakdown.avos} | Pais: ${f.breakdown.pais}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function downloadCSV() {
    const flows = getFilteredFlows();
    let csv = 'Lugar,Tipo,Geracao,Regiao_Continente,Quantidade_Geracao,Total_Lugar,Distancia_km,Bisavos,Avos,Pais\n';

    flows.forEach(f => {
      const reg = f.tipo === 'estado' ? f.regiao : f.continente;
      csv += `"${f.nome}","${f.tipo}","${f.geracaoLabel}","${reg}",${f.quantidade},${f.totalLugar},${f.distKm},${f.breakdown.bisavos},${f.breakdown.avos},${f.breakdown.pais}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Censo_Migracao_SP_EA_${state.turma}_${state.generation}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
