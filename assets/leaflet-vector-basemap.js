// Keep Leaflet overlays and the MapLibre basemap on the same camera.
// Use public MapLibre APIs so version changes cannot break transform updates.
(() => {
  const VectorBasemap = L.Layer.extend({
    initialize(options) { L.setOptions(this, options); },
    onAdd(map) {
      this._container = L.DomUtil.create('div', 'travel-vector-basemap');
      this._container.style.pointerEvents = 'none';
      map.getPane('tilePane').append(this._container);
      const size = map.getSize();
      this._container.style.width = `${size.x}px`;
      this._container.style.height = `${size.y}px`;
      this._vector = new maplibregl.Map({
        ...this.options, container: this._container,
        center: [map.getCenter().lng, map.getCenter().lat],
        zoom: map.getZoom() - 1, interactive: false,
        attributionControl: false, renderWorldCopies: false,
        fadeDuration: 0
      });
      this._sync();
    },
    getEvents() { return { move: this._sync, zoom: this._sync, resize: this._resize }; },
    _sync() {
      if (!this._vector || !this._map) return;
      L.DomUtil.setPosition(this._container, this._map.containerPointToLayerPoint([0, 0]));
      const center = this._map.getCenter();
      this._vector.jumpTo({ center: [center.lng, center.lat], zoom: this._map.getZoom() - 1 });
    },
    _resize() {
      const size = this._map.getSize();
      this._container.style.width = `${size.x}px`;
      this._container.style.height = `${size.y}px`;
      this._vector.resize();
      this._sync();
    },
    getMaplibreMap() { return this._vector; },
    onRemove() {
      this._vector.remove();
      this._container.remove();
      this._vector = null;
    }
  });
  L.maplibreGL = options => new VectorBasemap(options);
})();
