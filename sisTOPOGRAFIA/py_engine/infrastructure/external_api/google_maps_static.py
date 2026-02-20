import os
import requests
from io import BytesIO
from PIL import Image
from utils.logger import Logger
from domain.services.quota_manager import QuotaManager, QuotaExceededException

class GoogleMapsStaticAPI:
    """
    Client for fetching high-resolution satellite imagery from Google Maps Static API.
    Guarded by QuotaManager to prevent unexpected billing.
    """
    
    BASE_URL = "https://maps.googleapis.com/maps/api/staticmap"
    CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'local_data', '.static_cache')
    
    @classmethod
    def get_api_key(cls):
        # We try modern explicit keys first, then fallback to any available GOOGLE_API_KEY
        return os.environ.get('GOOGLE_MAPS_API_KEY') or os.environ.get('GOOGLE_API_KEY')
        
    @classmethod
    def fetch_satellite_image(cls, lat: float, lon: float, zoom: int = 18, width: int = 640, height: int = 640, scale: int = 2) -> str:
        """
        Fetches a satellite image, saves it to local cache, and returns the path.
        Default scale=2 is for high-res retina grabs (results in 1280x1280 image).
        Returns None if quota exceeded or error occurs.
        """
        api_key = cls.get_api_key()
        if not api_key:
            Logger.warn("Google Maps API Key not configured. Skipping static map fetch.")
            return None
            
        file_hash = f"lat{lat:.4f}_lon{lon:.4f}_z{zoom}_s{scale}.jpg"
        cached_path = os.path.join(cls.CACHE_DIR, file_hash)
        
        # 1. Return cached if available
        os.makedirs(cls.CACHE_DIR, exist_ok=True)
        if os.path.exists(cached_path):
            Logger.info(f"Using cached satellite image for {lat}, {lon}")
            return cached_path
            
        # 2. Check Quota BEFORE fetching
        try:
            QuotaManager.consume_static_map()
        except QuotaExceededException as qe:
            Logger.warn(f"Satellite overlay skipped: {qe}")
            return None
            
        # 3. Fire the request
        Logger.info(f"Downloading Google Maps Static Satellite Image (zoom={zoom})...")
        params = {
            "center": f"{lat},{lon}",
            "zoom": zoom,
            "size": f"{width}x{height}",
            "maptype": "satellite",
            "scale": scale,
            "key": api_key,
            # hide labels/features if we just want clean terrain
            "style": "feature:all|element:labels|visibility:off"
        }
        
        try:
            response = requests.get(cls.BASE_URL, params=params, timeout=15)
            response.raise_for_status()
            
            img = Image.open(BytesIO(response.content))
            img.save(cached_path, format="JPEG", quality=90)
            Logger.success(f"Satellite image downloaded: {cached_path}")
            return cached_path
            
        except requests.exceptions.RequestException as e:
            Logger.error(f"Failed to fetch Google Maps Static API: {e}")
            return None
        except Exception as e:
            Logger.error(f"Image processing error for Static Map: {e}")
            return None
