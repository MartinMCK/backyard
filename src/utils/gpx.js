import { gpx } from '@tmcw/togeojson'

export function parseGpxToGeoJson(gpxText) {
  const parser = new DOMParser()
  const document = parser.parseFromString(gpxText, 'application/xml')

  return gpx(document)
}
