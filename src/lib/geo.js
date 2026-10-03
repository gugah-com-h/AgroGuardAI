// Teste de ponto-em-polígono sobre o contorno GeoJSON do estado.
//
// Por que existe: a tela de confirmação deixava o usuário cravar o pino em
// qualquer lugar do Brasil, mesmo fora do estado escolhido. O backend então
// respondia 404 em /score ("Coordenadas fora do estado"), e a tela de
// resultado quebrava. Validar aqui evita a viagem inútil e explica o erro
// no momento em que ele acontece.

/** Algoritmo de lançamento de raio para um anel de coordenadas [lon, lat]. */
function dentroDoAnel(lon, lat, anel) {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    const cruza = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Um polígono é [anelExterno, ...buracos]. */
function dentroDoPoligono(lon, lat, poligono) {
  if (!poligono?.length || !dentroDoAnel(lon, lat, poligono[0])) return false;
  // Se cair em um buraco (enclave), está fora.
  for (let i = 1; i < poligono.length; i++) {
    if (dentroDoAnel(lon, lat, poligono[i])) return false;
  }
  return true;
}

function dentroDaGeometria(lon, lat, geom) {
  if (!geom) return false;
  if (geom.type === 'Polygon') return dentroDoPoligono(lon, lat, geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.some((p) => dentroDoPoligono(lon, lat, p));
  if (geom.type === 'GeometryCollection') return (geom.geometries || []).some((g) => dentroDaGeometria(lon, lat, g));
  return false;
}

/**
 * O ponto está dentro do contorno?
 * @param {number} lat
 * @param {number} lon
 * @param {object} geojson  FeatureCollection, Feature ou geometria
 * @returns {boolean|null}  null quando não há contorno carregado (não dá para afirmar)
 */
export function pontoNoContorno(lat, lon, geojson) {
  if (!geojson) return null;
  if (geojson.type === 'FeatureCollection') {
    if (!geojson.features?.length) return null;
    return geojson.features.some((f) => dentroDaGeometria(lon, lat, f.geometry));
  }
  if (geojson.type === 'Feature') return dentroDaGeometria(lon, lat, geojson.geometry);
  return dentroDaGeometria(lon, lat, geojson);
}

/** Caixa envolvente aproximada do território brasileiro. */
export function dentroDoBrasil(lat, lon) {
  return lat >= -33.75 && lat <= 5.3 && lon >= -73.99 && lon <= -34.79;
}

/** Converte um contorno GeoJSON nos limites [[latMin,lonMin],[latMax,lonMax]]. */
export function limitesDoContorno(geojson) {
  let latMin = Infinity, latMax = -Infinity, lonMin = Infinity, lonMax = -Infinity;

  const visitar = (c) => {
    if (typeof c[0] === 'number') {
      const [lon, lat] = c;
      if (lon < lonMin) lonMin = lon;
      if (lon > lonMax) lonMax = lon;
      if (lat < latMin) latMin = lat;
      if (lat > latMax) latMax = lat;
      return;
    }
    c.forEach(visitar);
  };

  const geoms = geojson?.type === 'FeatureCollection'
    ? (geojson.features || []).map((f) => f.geometry)
    : [geojson?.type === 'Feature' ? geojson.geometry : geojson];

  geoms.forEach((g) => g?.coordinates && visitar(g.coordinates));

  return Number.isFinite(latMin) ? [[latMin, lonMin], [latMax, lonMax]] : null;
}
