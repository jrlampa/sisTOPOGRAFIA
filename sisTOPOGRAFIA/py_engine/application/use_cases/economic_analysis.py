from typing import Dict, Any
try:
    from ...utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

class EconomicAnalysisUseCase:
    """
    Application service for economic impact analysis.
    Calculates estimated costs for earthwork, drainage and solar potential.
    """

    def __init__(self, unit_prices: Dict[str, float] = None):
        # Default prices in BRL per m3/unit (simplified for BR market)
        self.unit_prices = unit_prices or {
            "cut_per_m3": 25.0,     # Excavação e carga
            "fill_per_m3": 45.0,    # Aterro compactado
            "drain_per_m": 120.0,   # Drenagem básica
            "solar_roi_factor": 0.15 # Estimate reduction in energy bill
        }

    def execute(self, analytics: Dict[str, Any]) -> Dict[str, Any]:
        """Performs financial estimation based on technical analytics."""
        Logger.info("UseCase: Calculating Economic Impact Analysis...")

        earthwork = analytics.get('earthwork', {})
        cut_vol = earthwork.get('cut_volume', 0)
        fill_vol = earthwork.get('fill_volume', 0)
        
        # Calculate Costs
        cut_cost = cut_vol * self.unit_prices["cut_per_m3"]
        fill_cost = fill_vol * self.unit_prices["fill_per_m3"]
        total_earthwork_cost = cut_cost + fill_cost
        
        # Estimate Drainage Needs (simplified: based on slope > 15%)
        # Here we mock length based on radius if high slope detected
        slope_avg = analytics.get('slope_avg', 0)
        drain_length = 0
        if slope_avg > 15.0:
            drain_length = 150 # Mock m
        drain_cost = drain_length * self.unit_prices["drain_per_m"]

        total_project_cost = total_earthwork_cost + drain_cost

        # Solar ROI (Simple payback estimate)
        solar_avg = analytics.get('solar_avg', 0)
        potential_savings = solar_avg * 1000 * self.unit_prices["solar_roi_factor"] # Mock logic

        return {
            "currency": "BRL",
            "breakdown": {
                "earthwork": {
                    "cut_cost": round(cut_cost, 2),
                    "fill_cost": round(fill_cost, 2),
                    "total": round(total_earthwork_cost, 2)
                },
                "drainage": {
                    "estimated_length_m": drain_length,
                    "cost": round(drain_cost, 2)
                },
                "summary": {
                    "total_capex": round(total_project_cost, 2),
                    "solar_annual_saving": round(potential_savings, 2)
                }
            },
            "unit_prices": self.unit_prices
        }
