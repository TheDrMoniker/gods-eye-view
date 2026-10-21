# Phoenix City Hall — GEOID18 vertical datum research, 2026-10-21

NOAA NGS geoid web service (public, no paid API):
`https://geodesy.noaa.gov/api/geoid/ght?lat=33.44865&lon=-112.0773&model=14`

Live response at site research coordinate latitude **33.44865**, longitude **-112.0773**:

```json
{"geoidModel":"GEOID18","lat":33.44865,"lon":-112.0773,"geoidHeight":-29.928,"error":0.036,"units":"m"}
```

The preceding USGS EPT ground-class 2 returns (survey circa 2020) had **median orthometric Z=331.204 m** within a bounded pilot ROI. Under the assumption that EPT Z is preserved in NAVD88, the usual local conversion **h = H + N** yields **331.204 − 29.928 = 301.276 m** in the **NAD83 ellipsoid reference**, not a proven WGS84 Cesium placement. NOAA NGS GEOID18 docs explicitly associate GEOID18 CONUS with NAD83(2011)/NAVD88, and quote API interpolation error 0.036 m; this **is not total building placement error**.

Remaining uncertainties: the ground-class median represents a region, not a surveyed control monument or model origin; local terrain slope, city rooftop registration, LiDAR classification, 2014 geometry misalignment and NAD83/WGS84 frame differences have not been quantified. This sample is **research evidence** only. Do not hardwire 301.276 m as a certified point or claim that a screenshot using it is accurately registered.

Reference: https://www.ngs.noaa.gov/web_services/geoid.shtml

Decision: preliminary datum conversion mathematically supported, **SITE CONTROL / WGS84 ALIGNMENT HOLD**. The 112.2 m architectural building height is still not reconciled against its upper roof/possible spire. Photo license/texture clearance remains HOLD.
