import { jsonSeguro } from '@/lib/mapaDeCalor';

// Página HTML do mapa de calor 3D, que corre dentro de uma WebView (src/components/MapaDeCalor.js).
// Usa o MapLibre GL (biblioteca livre de mapas) e os mosaicos do OpenFreeMap (dados do OpenStreetMap,
// sem chave nem conta). Só pede à internet os mosaicos da zona que mostra: a localização do cliente
// fica no telemóvel (RNF04) e não é guardada em lado nenhum.
//
// Conversa com a app por mensagens: manda "pronto" quando o mapa aparece e "falhou" se não conseguir;
// a app chama window.atualizar(dados) quando os pratos ou o sítio mudam.

const MAPLIBRE = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl';

export function htmlDoMapaDeCalor(dados) {
  const c = dados.cores;
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="${MAPLIBRE}.css" rel="stylesheet" />
<style>
  html, body, #mapa { margin: 0; height: 100%; background: ${c.fundo}; overflow: hidden; }
  .maplibregl-ctrl-attrib, .maplibregl-ctrl-logo { display: none !important; }
  .rotulo { font: 600 10px ui-monospace, Menlo, monospace; color: ${c.texto}; background: ${c.superficie}E6; border: 1px solid ${c.linha};
    padding: 3px 6px; border-radius: 7px; white-space: nowrap; }
  .rotulo b { color: ${c.acento}; }
  .tu { width: 12px; height: 12px; border-radius: 50%; background: ${c.texto}; box-shadow: 0 0 0 4px ${c.texto}40; }
</style>
<script src="${MAPLIBRE}.js"></script>
</head><body><div id="mapa"></div>
<script>
  var dados = ${jsonSeguro(dados)};
  function avisar(m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m); }
  if (!window.maplibregl) avisar('falhou');

  function circulo(lng, lat, raio) {
    var pontos = [];
    for (var i = 0; i <= 24; i++) {
      var a = (i / 24) * Math.PI * 2;
      pontos.push([lng + (raio * Math.cos(a)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (raio * Math.sin(a)) / 110540]);
    }
    return pontos;
  }
  function focos(d) {
    return { type: 'FeatureCollection', features: d.restaurantes.map(function (r) {
      return { type: 'Feature', properties: { calor: r.calor }, geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] } };
    }) };
  }
  function colunas(d) {
    return { type: 'FeatureCollection', features: d.restaurantes.map(function (r) {
      return { type: 'Feature', properties: { calor: r.calor, altura: 30 + r.calor * 110 }, geometry: { type: 'Polygon', coordinates: [circulo(r.longitude, r.latitude, 9)] } };
    }) };
  }
  function rampa(paragens, transparenteAte) {
    var e = ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)'];
    paragens.forEach(function (p, i) { e.push(transparenteAte + (1 - transparenteAte) * (i / (paragens.length - 1)), p[1]); });
    return e;
  }

  try {
    var mapa = new maplibregl.Map({
      container: 'mapa', center: dados.camara.centro, zoom: dados.camara.zoom, pitch: 60, bearing: dados.camara.rumo,
      interactive: false, attributionControl: false, fadeDuration: 0,
      style: {
        version: 8,
        sources: {
          omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
          focos: { type: 'geojson', data: focos(dados) },
          colunas: { type: 'geojson', data: colunas(dados) }
        },
        layers: [
          { id: 'fundo', type: 'background', paint: { 'background-color': c.fundo } },
          { id: 'verde', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': c.verde } },
          { id: 'agua', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': c.agua } },
          { id: 'ruas', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['!in', 'class', 'rail', 'transit', 'ferry'],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': ['match', ['get', 'class'], ['primary', 'secondary', 'trunk', 'motorway'], c.ruaGrande, c.rua],
              'line-width': ['interpolate', ['exponential', 1.7], ['zoom'], 13, 0.8, 18, 12] } },
          { id: 'calor', type: 'heatmap', source: 'focos', paint: {
            'heatmap-weight': ['get', 'calor'],
            'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 13, 30, 15, 95, 17, 300],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 13, 1.2, 17, 2],
            'heatmap-color': rampa(c.calor, 0.1),
            'heatmap-opacity': 0.92 } },
          { id: 'predios', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13, paint: {
            'fill-extrusion-color': c.predio,
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 7],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.92 } },
          { id: 'colunas', type: 'fill-extrusion', source: 'colunas', paint: {
            'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'calor'], 0.3, c.calor[1][1], 0.6, c.calor[3][1], 0.8, c.calor[4][1], 1, c.calor[5][1]],
            'fill-extrusion-height': ['get', 'altura'],
            'fill-extrusion-opacity': 0.95 } }
        ]
      }
    });
    var marcadores = [];
    function porMarcadores(d) {
      marcadores.forEach(function (m) { m.remove(); });
      marcadores = [];
      d.restaurantes.filter(function (r) { return r.comEtiqueta; }).forEach(function (r) {
        var el = document.createElement('div');
        el.className = 'rotulo';
        el.textContent = r.nome + ' · ';
        var b = document.createElement('b');
        b.textContent = r.minutos + ' min';
        el.appendChild(b);
        marcadores.push(new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -34] }).setLngLat([r.longitude, r.latitude]).addTo(mapa));
      });
      var tu = document.createElement('div');
      tu.className = 'tu';
      marcadores.push(new maplibregl.Marker({ element: tu }).setLngLat(d.tu).addTo(mapa));
    }
    porMarcadores(dados);
    // a câmara balança devagar de um lado para o outro, à volta da direção dos restaurantes
    function balancar(agora) {
      if (!mapa.isMoving()) mapa.setBearing(dados.camara.rumo + Math.sin(agora / 6500) * 14);
      requestAnimationFrame(balancar);
    }
    mapa.once('load', function () { avisar('pronto'); requestAnimationFrame(balancar); });
    mapa.on('error', function (e) { if (!mapa.loaded()) avisar('falhou'); });
    window.atualizar = function (novos) {
      dados = novos;
      mapa.getSource('focos').setData(focos(novos));
      mapa.getSource('colunas').setData(colunas(novos));
      porMarcadores(novos);
      mapa.jumpTo({ center: novos.camara.centro, zoom: novos.camara.zoom });
    };
  } catch (erro) {
    avisar('falhou');
  }
</script>
</body></html>`;
}
