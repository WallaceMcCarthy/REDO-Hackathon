// Hardcoded town centroids (approx. city center) for the 42 contract ids.
import { existsSync, readFileSync } from "node:fs";
export type Town = { id: string; name: string; county: string; lat: number; lng: number };
const T: Town[] = [
 ["salt-lake-city","Salt Lake City","Salt Lake",40.7608,-111.8910],["west-valley-city","West Valley City","Salt Lake",40.6916,-112.0011],
 ["west-jordan","West Jordan","Salt Lake",40.6097,-111.9391],["provo","Provo","Utah",40.2338,-111.6585],["orem","Orem","Utah",40.2969,-111.6946],
 ["sandy","Sandy","Salt Lake",40.5649,-111.8389],["st-george","St. George","Washington",37.0965,-113.5684],["ogden","Ogden","Weber",41.2230,-111.9738],
 ["layton","Layton","Davis",41.0602,-111.9711],["south-jordan","South Jordan","Salt Lake",40.5622,-111.9297],["lehi","Lehi","Utah",40.3916,-111.8508],
 ["millcreek","Millcreek","Salt Lake",40.6869,-111.8750],["taylorsville","Taylorsville","Salt Lake",40.6677,-111.9388],["herriman","Herriman","Salt Lake",40.5141,-112.0330],
 ["logan","Logan","Cache",41.7370,-111.8338],["murray","Murray","Salt Lake",40.6669,-111.8879],["draper","Draper","Salt Lake",40.5246,-111.8638],
 ["bountiful","Bountiful","Davis",40.8894,-111.8808],["riverton","Riverton","Salt Lake",40.5219,-111.9391],["spanish-fork","Spanish Fork","Utah",40.1150,-111.6549],
 ["roy","Roy","Weber",41.1616,-112.0263],["pleasant-grove","Pleasant Grove","Utah",40.3641,-111.7385],["cedar-city","Cedar City","Iron",37.6775,-113.0619],
 ["kaysville","Kaysville","Davis",41.0352,-111.9386],["cottonwood-heights","Cottonwood Heights","Salt Lake",40.6197,-111.8105],["holladay","Holladay","Salt Lake",40.6688,-111.8244],
 ["eagle-mountain","Eagle Mountain","Utah",40.3144,-112.0069],["saratoga-springs","Saratoga Springs","Utah",40.3491,-111.9047],["american-fork","American Fork","Utah",40.3769,-111.7958],
 ["park-city","Park City","Summit",40.6461,-111.4980],["heber-city","Heber City","Wasatch",40.5070,-111.4132],["midway","Midway","Wasatch",40.5122,-111.4741],
 ["moab","Moab","Grand",38.5733,-109.5498],["vernal","Vernal","Uintah",40.4555,-109.5287],["price","Price","Carbon",39.5994,-110.8107],
 ["tooele","Tooele","Tooele",40.5308,-112.2983],["brigham-city","Brigham City","Box Elder",41.5102,-112.0155],["richfield","Richfield","Sevier",38.7725,-112.0841],
 ["kanab","Kanab","Kane",37.0475,-112.5263],["hurricane","Hurricane","Washington",37.1753,-113.2899],["washington","Washington","Washington",37.1305,-113.5083],
 ["ephraim","Ephraim","Sanpete",39.3600,-111.5855],
].map(([id,name,county,lat,lng])=>({id,name,county,lat,lng}) as Town);
export function loadTowns(): Town[] {
  if (existsSync("data/cities.json")) {
    const c = JSON.parse(readFileSync("data/cities.json","utf8"));
    const m = new Map(T.map(t=>[t.id,t]));
    return c.map((x:any)=>({ id:x.id, name:x.name, county:x.county, lat:x.lat, lng:x.lng })).filter((x:Town)=>m.has(x.id));
  }
  return T;
}
export function haversineKm(a:number,b:number,c:number,d:number){const r=(x:number)=>x*Math.PI/180;const h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 12742*Math.asin(Math.sqrt(h));}
export async function cached(path:string,url:string,init?:RequestInit):Promise<Buffer>{
  const {existsSync,readFileSync,writeFileSync,mkdirSync}=await import("node:fs");
  mkdirSync("data/raw",{recursive:true});
  if(existsSync(path))return readFileSync(path);
  const r=await fetch(url,init); if(!r.ok)throw new Error(r.status+" "+url);
  const b=Buffer.from(await r.arrayBuffer()); writeFileSync(path,b); return b;
}
