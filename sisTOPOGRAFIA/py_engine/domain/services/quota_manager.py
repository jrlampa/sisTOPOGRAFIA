import sqlite3
import datetime
import os
from dateutil.relativedelta import relativedelta
from utils.logger import Logger

class QuotaExceededException(Exception):
    pass

class QuotaManager:
    """
    Manages rate limiting and quotas using a local SQLite database.
    Designed to prevent accidental billing overruns on external APIs.
    """
    
    DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'local_data', 'requests_quota.db')
    MAX_STATIC_MAPS_PER_MONTH = 90000 # 100k free tier limit minus 10% safety margin
    
    @classmethod
    def _init_db(cls):
        os.makedirs(os.path.dirname(cls.DB_PATH), exist_ok=True)
        with sqlite3.connect(cls.DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS api_quotas (
                    service_name TEXT,
                    year_month TEXT,
                    request_count INTEGER DEFAULT 0,
                    PRIMARY KEY (service_name, year_month)
                )
            ''')
            conn.commit()
            
    @classmethod
    def _get_current_month_key(cls) -> str:
        return datetime.datetime.now().strftime('%Y-%m')

    @classmethod
    def check_and_increment(cls, service_name: str, limit: int) -> bool:
        """
        Checks if the quota for the current month is pristine, and increments it by 1.
        Raises QuotaExceededException if the limit is reached.
        """
        cls._init_db()
        month_key = cls._get_current_month_key()
        
        with sqlite3.connect(cls.DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Upsert the row for current month
            cursor.execute('''
                INSERT OR IGNORE INTO api_quotas (service_name, year_month, request_count) 
                VALUES (?, ?, 0)
            ''', (service_name, month_key))
            
            # Fetch current count
            cursor.execute('''
                SELECT request_count FROM api_quotas 
                WHERE service_name = ? AND year_month = ?
            ''', (service_name, month_key))
            
            current_count = cursor.fetchone()[0]
            
            if current_count >= limit:
                Logger.error(f"QUOTA EXCEEDED for {service_name}. Limit {limit} reached this month.", "critical")
                raise QuotaExceededException(f"Quota exceeded for {service_name}")
                
            # Increment
            cursor.execute('''
                UPDATE api_quotas 
                SET request_count = request_count + 1 
                WHERE service_name = ? AND year_month = ?
            ''', (service_name, month_key))
            
            conn.commit()
            
            Logger.info(f"Quota updated - {service_name}: {current_count + 1}/{limit} used this month.")
            return True
            
    @classmethod
    def consume_static_map(cls):
        """Helper to specifically consume one Google Maps Static API request"""
        return cls.check_and_increment('google_maps_static', cls.MAX_STATIC_MAPS_PER_MONTH)
