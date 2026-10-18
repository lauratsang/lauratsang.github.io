(async () => {
  const status = document.querySelector('#map-status');
  if (!window.L) {
    status.textContent = 'The map couldn’t load. Please refresh to try again.';
    return;
  }
  const config = window.TRAVEL_MAP_CONFIG || {};
  // Cached limits keep the map bounded even if the metadata request fails.
  let limits = { minzoom: 0, maxzoom: 22, bounds: [-180, -85.0511, 180, 85.0511] };
  if (config.basemapProvider === 'maptiler' && config.basemapKey) {
    try {
      const response = await fetch(`https://api.maptiler.com/maps/${encodeURIComponent(config.basemapStyle)}/tiles.json?key=${encodeURIComponent(config.basemapKey)}`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Metadata unavailable');
      const metadata = await response.json();
      if (Number.isFinite(metadata.minzoom) && Number.isFinite(metadata.maxzoom) && metadata.minzoom <= metadata.maxzoom) {
        limits.minzoom = metadata.minzoom;
        limits.maxzoom = metadata.maxzoom;
      }
      if (Array.isArray(metadata.bounds) && metadata.bounds.length === 4 && metadata.bounds.every(Number.isFinite)) limits.bounds = metadata.bounds;
    } catch { /* Use the last verified Dataviz metadata limits. */ }
  }
  const mapBounds = [[limits.bounds[1], limits.bounds[0]], [limits.bounds[3], limits.bounds[2]]];
  const places = (window.TRAVEL_PLACES || []).filter(place =>
    typeof place.name === 'string' && Array.isArray(place.coordinates) &&
    place.coordinates.length === 2 && place.coordinates.every(Number.isFinite) &&
    Math.abs(place.coordinates[0]) <= 85 && Math.abs(place.coordinates[1]) <= 180);
  const map = L.map('travel-map', {
    scrollWheelZoom: true, worldCopyJump: false, zoomSnap: 0.25,
    maxBounds: mapBounds, maxBoundsViscosity: 1,
    minZoom: limits.minzoom, maxZoom: limits.maxzoom, attributionControl: true
  });
  // Cover the viewport with the projected world; never reveal space outside its edges.
  const worldZoom = () => {
    const size = map.getSize();
    return Math.min(limits.maxzoom, Math.max(limits.minzoom, Math.ceil(Math.log2(Math.max(size.x, size.y) / 256) * 4) / 4));
  };
  const world = () => {
    const zoom = worldZoom();
    map.setMinZoom(zoom);
    map.setView([20, 0], zoom, { animate: false });
  };
  world();
  L.control.scale({ imperial: false }).addTo(map);
  const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const osm = () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, maxNativeZoom: 19, noWrap: true, attribution: osmAttribution
  });
  const basemap = config.basemapKey ? L.tileLayer(
    config.basemapProvider === 'maptiler'
      ? `https://api.maptiler.com/maps/${encodeURIComponent(config.basemapStyle || 'positron')}/{z}/{x}/{y}.png?key=${encodeURIComponent(config.basemapKey)}`
      : `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(config.basemapKey)}`,
    { minZoom: limits.minzoom, maxZoom: limits.maxzoom, minNativeZoom: limits.minzoom, maxNativeZoom: limits.maxzoom, noWrap: true, bounds: mapBounds, attribution: osmAttribution + (config.basemapProvider === 'maptiler'
      ? ' · &copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a>'
      : ' · &copy; <a href="https://carto.com/attributions">CARTO</a>') }
  ) : null;
  let layer = basemap || osm();
  let fallback = !basemap;
  function trackTiles(tiles) {
    tiles.on('load', () => { status.hidden = true; });
    tiles.on('tileerror', () => {
      if (!fallback) {
        fallback = true;
        map.removeLayer(layer);
        map.setMaxZoom(19);
        layer = osm();
        trackTiles(layer);
        layer.addTo(map);
        status.hidden = false;
        status.textContent = 'The selected basemap is unavailable; showing OpenStreetMap.';
      } else {
        status.hidden = false;
        status.textContent = 'Some map tiles couldn’t load. Check your connection and zoom to retry.';
      }
    });
  }
  trackTiles(layer);
  layer.addTo(map);
  // Multiply only the relief layer over the basemap; keep routes, pins, and popups above it.
  const reliefPane = map.createPane('hillshade');
  reliefPane.style.zIndex = 250;
  const relief = L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', {
    pane: 'hillshade', opacity: 0.22, minZoom: 3, maxZoom: limits.maxzoom, maxNativeZoom: 16, noWrap: true,
    attribution: 'Hillshade: <a href="https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer">Esri and contributors</a>'
  });
  const terrainToggle = document.querySelector('#map-hillshade');
  const updateRelief = () => {
    const show = terrainToggle.checked && map.getZoom() >= 3;
    if (show && !map.hasLayer(relief)) relief.addTo(map);
    if (!show && map.hasLayer(relief)) map.removeLayer(relief);
  };
  terrainToggle.addEventListener('change', updateRelief);
  map.on('zoomend', updateRelief);
  updateRelief();
  const pin = L.divIcon({ className: 'travel-pin', html: '<span class="location-pin-svg" aria-hidden="true"></span>', iconSize: [30, 36], iconAnchor: [15, 33], popupAnchor: [0, -30] });
  const homePin = L.divIcon({
    className: 'travel-home-pin',
    html: '<span><i class="home-pin-svg" aria-hidden="true"></i></span>',
    iconSize: [30, 34], iconAnchor: [15, 33], popupAnchor: [0, -30]
  });
  const list = document.querySelector('#travel-places');
  const groups = new Map();
  function addPlaceButton(continent, button) {
    if (!groups.has(continent)) {
      const section = document.createElement('section');
      const heading = document.createElement('h2');
      heading.textContent = continent;
      section.append(heading);
      groups.set(continent, section);
      [...groups.keys()].sort().forEach(name => list.append(groups.get(name)));
    }
    groups.get(continent).append(button);
  }
  places.forEach(place => {
    const popup = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = place.name;
    popup.append(title);
    if (place.photo) {
      const photo = document.createElement('img');
      photo.className = 'travel-popup-photo';
      photo.src = place.photo;
      photo.alt = place.photoAlt || place.name;
      photo.width = 2160;
      photo.height = 1620;
      popup.append(photo);
    }
    [place.date, place.note].filter(Boolean).forEach(text => {
      const p = document.createElement('p');
      p.textContent = text;
      popup.append(p);
    });
    const marker = L.marker(place.coordinates, { icon: place.type === 'home' ? homePin : pin, title: place.name, alt: place.name }).addTo(map).bindPopup(popup, {
      maxWidth: 340, minWidth: 200, autoPanPadding: [16, 16], className: 'travel-story-popup'
    });
    if (place.type === 'home') marker.on('click', () => {
      map.setView(place.coordinates, 14);
      panel.open = false;
      reflection.hidden = true;
      marker.openPopup();
    });
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = place.name;
    button.addEventListener('click', () => { panel.open = false; reflection.hidden = true; map.setView(place.coordinates, place.type === 'home' ? 14 : 7); marker.openPopup(); });
    addPlaceButton(place.continent || 'Other places', button);
  });
  const reflection = document.createElement('section');
  reflection.className = 'route-reflection';
  reflection.hidden = true;
  reflection.setAttribute('role', 'dialog');
  reflection.setAttribute('aria-modal', 'false');
  reflection.setAttribute('aria-labelledby', 'reflection-title');
  document.querySelector('.travel-map-frame').append(reflection);
  L.DomEvent.disableClickPropagation(reflection);
  L.DomEvent.disableScrollPropagation(reflection);
  let reflectionSource;
  function closeReflection() {
    reflection.hidden = true;
    reflectionSource?.focus();
  }
  function openReflection(item, marker) {
    reflectionSource = marker;
    reflection.replaceChildren();
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'reflection-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close reflection');
    close.addEventListener('click', closeReflection);
    const gallery = document.createElement('div');
    gallery.className = 'reflection-gallery';
    (item.photos || []).forEach(photo => {
      const image = document.createElement('img');
      image.src = photo.photo;
      image.alt = photo.alt;
      image.width = 88;
      image.height = 88;
      gallery.append(image);
    });
    const title = document.createElement('h2');
    title.id = 'reflection-title';
    title.textContent = item.title;
    const prose = document.createElement('div');
    prose.className = 'reflection-prose';
    const entry = (window.TRAVEL_REFLECTIONS || {})[item.gpx] || '';
    entry.split(/\n\s*\n/).filter(Boolean).forEach(text => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      prose.append(paragraph);
    });
    const date = document.createElement('time');
    date.className = 'journal-entry-date';
    date.dateTime = item.date;
    date.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(item.date + 'T12:00:00Z'));
    reflection.append(close, gallery, date, title, prose);
    reflection.hidden = false;
    close.focus({ preventScroll: true });
  }
  reflection.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); closeReflection(); }
  });
  const hikes = [
    { route: window.ARTHURS_SEAT_ROUTE, photos: window.ARTHURS_SEAT_PHOTOS, title: 'Arthur’s Seat hike · Edinburgh', date: '2026-10-06', dateSource: 'photo metadata', label: 'Edinburgh · Arthur’s Seat hike', location: [55.95, -3.19], gpx: 'ArthursSeat_Afternoon_Hike.gpx', note: 'The route we took, recorded on our afternoon hike.' },
    { route: window.BEEHIVE_ROUTE, photos: window.BEEHIVE_PHOTOS, title: 'The Beehive · Maine', date: '2026-07-13', dateSource: 'photo metadata', label: 'Maine · The Beehive', continent: 'North America', gpx: 'Acadia-Beehive.gpx' },
    { route: window.GLYMUR_ROUTE, photos: window.GLYMUR_PHOTOS, title: 'Glymur waterfall · Iceland', date: '2026-10-02', dateSource: 'GPX', label: 'Iceland · Glymur waterfall', gpx: 'Glymur_Morning_Hike.gpx', note: 'Our recorded route to Glymur waterfall, with photos matched to the hike by capture time.' }
  ].filter(item => item.route);
  let activePhoto;
  hikes.forEach(item => {
    const hike = item.route;
    const photoLayer = L.layerGroup();
    (item.photos || []).forEach(photo => {
      const image = document.createElement('img');
      image.src = photo.photo;
      image.alt = photo.alt;
      image.className = 'photo-hover-image';
      const dot = L.circleMarker(photo.coordinates, {
        radius: 6, color: '#fffdf7', weight: 2, fillColor: '#197c99', fillOpacity: 1, className: 'interactive-photo-dot'
      }).bindTooltip(image, { direction: 'top', permanent: true, opacity: 1, className: 'photo-hover-preview' }).addTo(photoLayer);
      dot.closeTooltip();
      dot.on('add', () => dot.closeTooltip());
      let heldForPan = false;
      let panningPhoto = false;
      dot.on('mouseover', () => {
        if (activePhoto && activePhoto !== dot) activePhoto.closeTooltip();
        activePhoto = dot;
        dot.openTooltip();
      });
      dot.on('mouseout', () => {
        if (!heldForPan) dot.closeTooltip();
      });
      // Only actual pointer movement dismisses a preview held open by auto-panning.
      map.getContainer().addEventListener('pointermove', event => {
        if (!heldForPan || panningPhoto || event.target === dot.getElement()) return;
        heldForPan = false;
        dot.closeTooltip();
      });
      dot.on('tooltipclose', () => { heldForPan = false; });
      const keepPhotoInFrame = () => {
        if (!dot.isTooltipOpen() || panningPhoto) return;
        const element = dot.getTooltip().getElement();
        if (!element) return;
        const frame = map.getContainer().getBoundingClientRect();
        const photoBox = element.getBoundingClientRect();
        const padding = 14;
        const dx = photoBox.left < frame.left + padding
          ? photoBox.left - frame.left - padding
          : Math.max(0, photoBox.right - frame.right + padding);
        const dy = photoBox.top < frame.top + padding
          ? photoBox.top - frame.top - padding
          : Math.max(0, photoBox.bottom - frame.bottom + padding);
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          heldForPan = true;
          panningPhoto = true;
          map.once('moveend', () => { panningPhoto = false; });
          map.panBy([dx, dy], { animate: true, duration: 0.45, easeLinearity: 0.25 });
        }
      };
      dot.on('tooltipopen', () => requestAnimationFrame(keepPhotoInFrame));
      image.addEventListener('load', () => {
        if (dot.isTooltipOpen()) {
          dot.getTooltip().update();
          requestAnimationFrame(keepPhotoInFrame);
        }
      });
      // Hover previews close on mouseout; tapping toggles them on touchscreens.
      dot.on('click', event => {
        L.DomEvent.stopPropagation(event.originalEvent);
        if (dot.isTooltipOpen()) dot.closeTooltip();
        else dot.openTooltip();
      });
      map.on('click', () => dot.closeTooltip());
    });
    const trail = L.geoJSON(hike, { style: { color: '#a64e3c', weight: 4, opacity: 0.95 } });
    const trailHalo = L.geoJSON(hike, { interactive: false, style: { color: '#fffdf7', weight: 7, opacity: 0.9 } });
    const noteButton = document.createElement('button');
    noteButton.type = 'button';
    noteButton.className = 'hike-note-button';
    noteButton.hidden = true;
    noteButton.textContent = 'Notes';
    noteButton.setAttribute('aria-label', 'Notes: ' + item.title);
    noteButton.addEventListener('click', () => { panel.open = false; openReflection(item, noteButton); });
    document.querySelector('.travel-map-frame').append(noteButton);
    L.DomEvent.disableClickPropagation(noteButton);
    const city = L.marker(item.location || trail.getBounds().getCenter(), { icon: pin, title: item.title, alt: item.title + ' — zoom in to explore' });
    const explore = () => {
      panel.open = false;
      map.closePopup();
      map.fitBounds(trail.getBounds(), { padding: [28, 28], maxZoom: 15 });
      openReflection(item, noteButton);
    };
    city.on('click', explore);
    const updateHike = () => {
      if (map.getZoom() >= 12) {
        if (map.hasLayer(city)) map.removeLayer(city);
        if (!map.hasLayer(trail)) { trailHalo.addTo(map); trail.addTo(map); photoLayer.addTo(map); }
      } else {
        if (map.hasLayer(trail)) { map.removeLayer(trail); map.removeLayer(trailHalo); map.removeLayer(photoLayer); }
        if (!map.hasLayer(city)) city.addTo(map);
      }
    };
    const updateNoteButton = () => {
      noteButton.hidden = map.getZoom() < 12 || !map.getBounds().intersects(trail.getBounds());
    };
    map.on('moveend zoomend', updateNoteButton);
    updateNoteButton();
    map.on('zoomend', updateHike);
    updateHike();
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.label;
    button.addEventListener('click', explore);
    addPlaceButton(item.continent || 'Europe', button);
  });
  const count = places.length + hikes.length;
  if (count) document.querySelector('#travel-count').textContent = `${count} ${count === 1 ? 'place' : 'places'} pinned`;
  const reset = document.querySelector('#map-reset');
  reset.disabled = false;
  reset.addEventListener('click', world);
  const panel = document.querySelector('.map-places-panel');
  if (window.matchMedia('(max-width: 560px)').matches) panel.open = false;
  map.getContainer().addEventListener('pointerdown', () => { panel.open = false; });
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);
  new ResizeObserver(() => {
    const wasWorld = map.getZoom() <= map.getMinZoom() + 0.01;
    map.invalidateSize({ pan: false });
    map.setMinZoom(worldZoom());
    if (wasWorld) world();
  }).observe(document.querySelector('#travel-map'));
})();
