import { withListingMetadata, type Listing } from "./listings";

export type AssessorRow = {
  id: string; cityId: string; county: string; address: string | null; lat: number; lng: number; value: number;
  sqft: number | null; yearBuilt: number | null; units: number | null; propertyType: string; asOf: string;
};

/** Keeps one upsert far under the 4,096 index-range limit per transaction. */
export const MAX_UPSERT_ROWS = 1000;
const SERVICES = "https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services";
export const assessorLayer = (county: string) => `${SERVICES}/Parcels_${county.replaceAll(" ", "")}_LIR/FeatureServer/0`;
const countySlug = (county: string) => county.toLowerCase().replaceAll(" ", "-");

/** Source text and link are derived here so each of the many stored rows stays small. */
export function assessorToListing(row: AssessorRow): Listing {
  const parcelId = row.id.slice(countySlug(row.county).length + 1);
  const query = new URLSearchParams({ where: `PARCEL_ID='${parcelId.replaceAll("'", "''")}'`, outFields: "PARCEL_ID,PARCEL_ADD,TOTAL_MKT_VALUE,BLDG_SQFT,BUILT_YR,CURRENT_ASOF", returnGeometry: "false", f: "pjson" });
  return withListingMetadata({
    id: row.id, cityId: row.cityId, kind: "home", name: null, address: row.address, lat: row.lat, lng: row.lng,
    value: row.value, rent: null, beds: null, sqft: row.sqft, yearBuilt: row.yearBuilt, units: row.units,
    propertyType: row.propertyType, source: `UGRC ${row.county} County assessor LIR; records as of ${row.asOf}`,
    sourceUrl: `${assessorLayer(row.county)}/query?${query}`, year: Number(row.asOf.slice(0, 4)),
  });
}
