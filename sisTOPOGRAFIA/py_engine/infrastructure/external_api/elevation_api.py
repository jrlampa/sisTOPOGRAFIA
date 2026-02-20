import time
import requests
import numpy as np
import concurrent.futures
from typing import List, Tuple, Dict, Any, Optional
import os

try:
    from ...utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

class ElevationApiAdapter:
    """
    Infrastructure adapter for Elevation APIs with auto-probing.
    Implements a 'ping' mechanism to select the provider with lowest latency.
    """

    def __init__(self):
        self.providers = [
            {
                "name": "OpenTopodata (SRTM30m)",
                "url": "https://api.opentopodata.org/v1/srtm30m",
                "type": "json_post",
                "payload_key": "locations"
            },
            {
                "name": "Open-Elevation (Public)",
                "url": "https://api.open-elevation.com/api/v1/lookup",
                "type": "json_post",
                "payload_key": "locations"
            }
        ]
        self._best_provider = None
        self._last_probe_time = 0
        self._probe_ttl = 3600  # 1 hour

    def _probe_latency(self, provider: Dict[str, Any]) -> Tuple[str, float]:
        """Pings an endpoint to measure latency."""
        try:
            # We use a very small payload for the probe
            # Coordinate near center of Brazil for neutral testing
            probe_coords = "-15.7801,-47.9292" 
            start = time.time()
            
            if provider["type"] == "json_post":
                res = requests.post(
                    provider["url"], 
                    json={provider["payload_key"]: probe_coords},
                    timeout=3
                )
            else:
                res = requests.get(
                    f"{provider['url']}?locations={probe_coords}",
                    timeout=3
                )
            
            if res.status_code == 200:
                latency = time.time() - start
                return provider["name"], latency
        except Exception:
            pass
        return provider["name"], float('inf')

    def select_best_provider(self) -> Dict[str, Any]:
        """Selects the provider with the lowest latency using parallel probing."""
        now = time.time()
        if self._best_provider and (now - self._last_probe_time) < self._probe_ttl:
            return self._best_provider

        Logger.info("Infrastructure: Probing elevation APIs for best latency...")
        results = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(self.providers)) as executor:
            future_to_provider = {executor.submit(self._probe_latency, p): p for p in self.providers}
            for future in concurrent.futures.as_completed(future_to_provider):
                name, latency = future.result()
                if latency != float('inf'):
                    results.append((name, latency))
                    Logger.debug(f"Infrastructure: Prober -> {name}: {latency:.3f}s")

        if not results:
            Logger.warn("Infrastructure: All elevation probes failed. Using fallback (Open-Elevation).")
            self._best_provider = self.providers[1]
        else:
            # Sort by latency
            results.sort(key=lambda x: x[1])
            best_name = results[0][0]
            self._best_provider = next(p for p in self.providers if p["name"] == best_name)
            Logger.info(f"Infrastructure: Selection -> {best_name} ({results[0][1]:.3f}s)")

        self._last_probe_time = now
        return self._best_provider

    def fetch_grid(self, lat: float, lon: float, radius: float, resolution: int = 20) -> List[List[Tuple[float, float, float]]]:
        """Fetches a grid of elevation points around a center using the best provider."""
        
        provider = self.select_best_provider()
        Logger.info(f"Infrastructure: Fetching Elevation Grid ({resolution}x{resolution}) from {provider['name']}")
        
        # Calculate grid bounds (approximate 1 degree ~ 111km)
        d_lat = radius / 111320.0
        d_lon = radius / (111320.0 * np.cos(np.radians(lat)))
        
        lats = np.linspace(lat + d_lat, lat - d_lat, resolution)
        lons = np.linspace(lon - d_lon, lon + d_lon, resolution)
        
        # Prepare coordinates for batch request
        coords = []
        for lt in lats:
            for ln in lons:
                coords.append({"latitude": float(lt), "longitude": float(ln)})

        # Request using selected provider
        try:
            if provider["type"] == "json_post":
                # Open-Elevation / OpenTopodata style
                resp = requests.post(provider["url"], json={provider["payload_key"]: coords}, timeout=15)
                resp.raise_for_status()
                data = resp.json()
                results = data.get("results", [])
            else:
                # Basic GET fallback if needed
                coord_str = "|".join([f"{c['latitude']},{c['longitude']}" for c in coords])
                resp = requests.get(f"{provider['url']}?locations={coord_str}", timeout=15)
                resp.raise_for_status()
                data = resp.json()
                results = data.get("results", [])

            # Reconstruct grid
            grid = []
            idx = 0
            for i in range(resolution):
                row = []
                for j in range(resolution):
                    if idx < len(results):
                        elev = results[idx].get("elevation", 0.0)
                        row.append((lats[i], lons[j], float(elev)))
                    else:
                        row.append((lats[i], lons[j], 0.0))
                    idx += 1
                grid.append(row)
            
            return grid

        except Exception as e:
            Logger.error(f"Infrastructure: Elevation fetch failed from {provider['name']}: {e}")
            return [[(lt, ln, 100.0) for ln in lons] for lt in lats]
