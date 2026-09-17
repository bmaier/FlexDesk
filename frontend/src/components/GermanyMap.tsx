/** Deutschland-Umriss, abgeleitet aus echten Geokoordinaten (Quelle: deutschlandGeoJSON /
 * GADM-Daten, Public-Domain-Verwendung "Unlicense", niedrigste Detailstufe, per
 * Douglas-Peucker auf ~140 Punkte vereinfacht) — kein Tile-Server nötig, nur eine statische
 * Punktliste. Punkte als [lat, lon], Festland im Uhrzeigersinn ab Sylt, plus Rügen separat. */
export const GERMANY_BOUNDS = { minLat: 47.2, maxLat: 55.1, minLon: 5.8, maxLon: 15.1 };

const OUTLINE: [number, number][] = [
  [55.044, 8.407], [54.878, 8.43], [54.78, 9.955], [54.55, 10.028], [54.467, 9.84],
  [54.456, 10.199], [54.311, 10.132], [54.436, 10.319], [54.305, 10.705], [54.391, 11.128],
  [54.198, 11.094], [54.055, 10.754], [53.956, 10.891], [54.016, 11.179], [53.9, 11.455],
  [53.997, 11.378], [54.153, 11.682], [54.15, 12.125], [54.484, 12.52], [54.438, 12.962],
  [54.406, 12.684], [54.345, 12.81], [54.439, 13.02], [54.091, 13.457], [54.172, 13.696],
  [53.922, 13.914], [53.866, 13.825], [53.99, 13.906], [53.942, 14.042], [54.037, 14.003],
  [53.93, 14.221], [53.858, 13.806], [53.739, 14.283], [53.262, 14.449], [52.84, 14.121],
  [52.58, 14.639], [52.396, 14.529], [52.073, 14.741], [51.824, 14.587], [51.559, 14.698],
  [51.482, 14.934], [51.31, 15.028], [50.991, 14.93], [50.827, 14.711], [51.052, 14.502],
  [51.054, 14.294], [50.889, 14.372], [50.713, 13.549], [50.414, 12.977], [50.4, 12.516],
  [50.18, 12.328], [50.323, 12.194], [50.255, 12.086], [49.927, 12.548], [49.755, 12.403],
  [49.432, 12.661], [48.775, 13.836], [48.517, 13.721], [48.597, 13.503], [48.378, 13.411],
  [48.117, 12.753], [47.852, 13.001], [47.731, 12.911], [47.639, 13.106], [47.466, 13.013],
  [47.676, 12.783], [47.629, 12.506], [47.74, 12.254], [47.601, 12.209], [47.598, 11.636],
  [47.391, 11.274], [47.586, 10.432], [47.379, 10.434], [47.27, 10.17], [47.393, 10.227],
  [47.355, 10.096], [47.55, 9.971], [47.544, 9.689], [47.824, 9.044], [47.668, 9.221],
  [47.748, 8.992], [47.655, 8.892], [47.814, 8.568], [47.68, 8.404], [47.6, 8.585],
  [47.537, 7.669], [47.696, 7.512], [48.121, 7.578], [48.634, 7.836], [48.971, 8.229],
  [49.184, 7.446], [49.165, 6.738], [49.434, 6.535], [49.465, 6.355], [49.809, 6.528],
  [49.835, 6.312], [50.06, 6.098], [50.236, 6.17], [50.333, 6.408], [50.551, 6.172],
  [50.616, 6.278], [50.795, 5.963], [50.922, 6.083], [51.043, 5.872], [51.153, 6.172],
  [51.245, 6.078], [51.366, 6.232], [51.824, 5.965], [51.899, 6.743], [51.996, 6.835],
  [52.074, 6.701], [52.239, 7.069], [52.47, 7.006], [52.556, 6.684], [52.636, 7.052],
  [52.998, 7.261], [53.33, 7.249], [53.361, 6.999], [53.628, 7.158], [53.711, 8.016],
  [53.555, 8.172], [53.465, 8.074], [53.399, 8.252], [53.61, 8.272], [53.518, 8.571],
  [53.694, 8.484], [53.879, 8.608], [53.863, 9.1], [54.022, 8.82], [54.047, 8.983],
  [54.173, 8.807], [54.313, 8.952], [54.304, 8.58], [54.519, 8.989], [54.47, 8.806],
  [54.593, 8.89], [54.885, 8.59], [54.874, 8.31], [54.752, 8.28], [55.044, 8.407],
];

/** Rügen (größte Ostsee-Insel) — separates Polygon, damit die charakteristische Bucht
 * zwischen Festland und Insel nicht als durchgezogene Landfläche erscheint. */
const RUEGEN_OUTLINE: [number, number][] = [
  [54.576, 13.446], [54.563, 13.68], [54.462, 13.57], [54.342, 13.767], [54.273, 13.725],
  [54.297, 13.646], [54.326, 13.704], [54.316, 13.611], [54.349, 13.683], [54.353, 13.581],
  [54.27, 13.352], [54.255, 13.418], [54.221, 13.394], [54.251, 13.29], [54.278, 13.335],
  [54.282, 13.139], [54.301, 13.185], [54.332, 13.115], [54.371, 13.127], [54.383, 13.262],
  [54.429, 13.15], [54.479, 13.268], [54.504, 13.159], [54.547, 13.144], [54.514, 13.305],
  [54.552, 13.297], [54.579, 13.369], [54.549, 13.338], [54.559, 13.377], [54.494, 13.413],
  [54.481, 13.506], [54.548, 13.502], [54.576, 13.446],
];

/** Projiziert lat/lon linear auf ein 0-100-Prozent-Raster (deckt sich mit der Marker-Projektion).
 * Bewusst keine Mercator-/Breitengrad-Korrektur: die SVG streckt ohnehin non-uniform auf die
 * Containerbox (siehe `GermanyMap`), eine "geometrisch korrekte" Vorprojektion würde durch diese
 * Streckung wieder verzerrt — für einen Kartenhintergrund in einem PoC-Widget ausreichend. */
export function projectLatLon(lat: number, lon: number): { x: number; y: number } {
  const { minLat, maxLat, minLon, maxLon } = GERMANY_BOUNDS;
  const x = ((lon - minLon) / (maxLon - minLon)) * 100;
  const y = 100 - ((lat - minLat) / (maxLat - minLat)) * 100;
  return { x, y };
}

function toPoints(outline: [number, number][]): string {
  return outline.map(([lat, lon]) => {
    const { x, y } = projectLatLon(lat, lon);
    return `${x},${y}`;
  }).join(" ");
}

export function GermanyMap() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" role="presentation">
      <polygon points={toPoints(OUTLINE)} className="fill-tertiary-fixed/15 stroke-on-surface-variant/40" strokeWidth={0.3} />
      <polygon points={toPoints(RUEGEN_OUTLINE)} className="fill-tertiary-fixed/15 stroke-on-surface-variant/40" strokeWidth={0.3} />
    </svg>
  );
}

