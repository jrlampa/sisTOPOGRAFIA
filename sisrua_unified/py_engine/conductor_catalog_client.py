"""
conductor_catalog_client.py

Cliente Python para acessar conductor_catalog do Supabase.
Fornece funções para buscar, enriquecer e validar dados de condutores.

Usage:
    from py_engine.conductor_catalog_client import find_conductor, enrich_conductors
    
    # Buscar um condutor
    conductor = find_conductor("70 Al - MX")
    
    # Enriquecer múltiplos condutores
    enriched = enrich_conductors(raw_conductors, supabase_client)
"""

import logging
from typing import Any, Optional
from functools import lru_cache
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class ConductorCatalogClient:
    """Cliente para acessar conductor_catalog do Supabase."""

    def __init__(self, supabase_client):
        """
        Inicializa o cliente.
        
        Args:
            supabase_client: Cliente Supabase autenticado (pode ser anon, authenticated, ou service_role)
        """
        self.client = supabase_client
        self._cache: dict[str, tuple[dict, datetime]] = {}
        self._cache_ttl = timedelta(minutes=5)

    def _is_cache_valid(self, timestamp: datetime) -> bool:
        """Verifica se cache ainda é válido."""
        return datetime.now() - timestamp < self._cache_ttl

    def _get_cached(self, key: str) -> Optional[dict]:
        """Retorna valor em cache se válido."""
        if key in self._cache:
            data, timestamp = self._cache[key]
            if self._is_cache_valid(timestamp):
                return data
            del self._cache[key]
        return None

    def _set_cache(self, key: str, data: dict) -> None:
        """Armazena valor em cache."""
        self._cache[key] = (data, datetime.now())

    def find_conductor_by_id(self, conductor_id: str) -> Optional[dict]:
        """
        Busca um condutor pelo conductor_id.
        
        Args:
            conductor_id: ID do condutor (e.g., "70 Al - MX")
            
        Returns:
            Dict com dados do condutor ou None se não encontrado
        """
        # Verificar cache
        cached = self._get_cached(f"by_id:{conductor_id}")
        if cached is not None:
            return cached

        try:
            response = (
                self.client.table("conductor_catalog")
                .select("*")
                .eq("conductor_id", conductor_id)
                .eq("is_active", True)
                .single()
                .execute()
            )

            if response.data:
                self._set_cache(f"by_id:{conductor_id}", response.data)
                return response.data

            logger.warning(f"Condutor não encontrado: {conductor_id}")
            return None

        except Exception as err:
            logger.error(f"Erro ao buscar condutor {conductor_id}: {err}")
            return None

    def find_conductor_by_name(self, name: str) -> Optional[dict]:
        """
        Busca um condutor por nome com suporte a aliases.
        Chama RPC function find_conductor_by_name.
        
        Args:
            name: Nome ou alias do condutor
            
        Returns:
            Dict com dados do condutor ou None
        """
        # Verificar cache
        cached = self._get_cached(f"by_name:{name}")
        if cached is not None:
            return cached

        try:
            response = self.client.rpc(
                "find_conductor_by_name",
                {"p_name": name}
            ).execute()

            if response.data and len(response.data) > 0:
                data = response.data[0]
                self._set_cache(f"by_name:{name}", data)
                return data

            logger.warning(f"Condutor não encontrado por nome: {name}")
            return None

        except Exception as err:
            logger.error(f"Erro ao buscar condutor por nome {name}: {err}")
            return None

    def list_conductors_by_category(self, category: str) -> list[dict]:
        """
        Lista todos os condutores de uma categoria.
        
        Args:
            category: "BT", "MT", "HV", "EHV"
            
        Returns:
            Lista de condutores
        """
        cache_key = f"category:{category}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            response = (
                self.client.table("conductor_catalog")
                .select("*")
                .eq("category", category)
                .eq("is_active", True)
                .order("section_mm2")
                .execute()
            )

            data = response.data or []
            self._set_cache(cache_key, data)
            return data

        except Exception as err:
            logger.error(f"Erro ao listar categoria {category}: {err}")
            return []

    def list_conductors_by_material(self, material: str) -> list[dict]:
        """
        Lista todos os condutores de um material.
        
        Args:
            material: "Al", "Cu", "Al-CONC"
            
        Returns:
            Lista de condutores
        """
        cache_key = f"material:{material}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            response = (
                self.client.table("conductor_catalog")
                .select("*")
                .eq("material", material)
                .eq("is_active", True)
                .order("section_mm2")
                .execute()
            )

            data = response.data or []
            self._set_cache(cache_key, data)
            return data

        except Exception as err:
            logger.error(f"Erro ao listar material {material}: {err}")
            return []

    def list_all_conductors(self) -> list[dict]:
        """
        Lista todos os condutores ativos.
        
        Returns:
            Lista de condutores
        """
        cache_key = "all_conductors"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            response = (
                self.client.table("conductor_catalog")
                .select("*")
                .eq("is_active", True)
                .order("category")
                .order("section_mm2")
                .execute()
            )

            data = response.data or []
            self._set_cache(cache_key, data)
            return data

        except Exception as err:
            logger.error(f"Erro ao listar todos os condutores: {err}")
            return []

    def enrich_conductor(self, raw_conductor: dict) -> dict:
        """
        Enriquece um condutor com dados do catálogo.
        
        Args:
            raw_conductor: Dict com {id, conductorName, quantity}
            
        Returns:
            Dict enriquecido com propriedades técnicas
        """
        conductor_name = raw_conductor.get("conductorName")
        if not conductor_name:
            logger.warning(f"Condutor sem nome: {raw_conductor}")
            return raw_conductor

        # Buscar dados do catálogo
        catalog_data = self.find_conductor_by_name(conductor_name)

        if not catalog_data:
            logger.warning(f"Condutor não encontrado no catálogo: {conductor_name}")
            return raw_conductor

        # Enriquecer com dados técnicos
        enriched = raw_conductor.copy()
        enriched["catalog_data"] = {
            "conductor_id": catalog_data.get("conductor_id"),
            "display_name": catalog_data.get("display_name"),
            "material": catalog_data.get("material"),
            "section_mm2": catalog_data.get("section_mm2"),
            "diameter_mm": catalog_data.get("diameter_mm"),
            "resistance_ohm_per_km": catalog_data.get("resistance_ohm_per_km"),
            "reactance_mohm_per_km": catalog_data.get("reactance_mohm_per_km"),
            "weight_kg_per_km": catalog_data.get("weight_kg_per_km"),
            "tensile_strength_dan": catalog_data.get("tensile_strength_dan"),
            "max_temperature_celsius": catalog_data.get("max_temperature_celsius"),
        }

        return enriched

    def enrich_conductors(self, raw_conductors: list[dict]) -> list[dict]:
        """
        Enriquece múltiplos condutores.
        
        Args:
            raw_conductors: Lista de dicts brutos
            
        Returns:
            Lista enriquecida
        """
        return [self.enrich_conductor(c) for c in raw_conductors]

    def validate_conductor_name(self, name: str) -> bool:
        """
        Valida se um nome de condutor existe no catálogo.
        
        Args:
            name: Nome do condutor
            
        Returns:
            True se existe e está ativo
        """
        return self.find_conductor_by_name(name) is not None

    def validate_conductor_names(self, names: list[str]) -> tuple[list[str], list[str]]:
        """
        Valida múltiplos nomes de condutores.
        
        Args:
            names: Lista de nomes
            
        Returns:
            Tupla (valid_names, invalid_names)
        """
        valid = []
        invalid = []

        for name in names:
            if self.validate_conductor_name(name):
                valid.append(name)
            else:
                invalid.append(name)

        return valid, invalid

    def clear_cache(self) -> None:
        """Limpa o cache em memória."""
        self._cache.clear()
        logger.info("Cache do conductor_catalog limpo")

    def get_cache_stats(self) -> dict:
        """Retorna estatísticas do cache (debug)."""
        return {
            "cache_size": len(self._cache),
            "ttl_minutes": self._cache_ttl.total_seconds() / 60,
        }


# ─────────────────────────────────────────────────────────────────────────────
# FUNÇÕES DE CONVENIÊNCIA (módulo-level)
# ─────────────────────────────────────────────────────────────────────────────

_global_client: Optional[ConductorCatalogClient] = None


def initialize_conductor_catalog_client(supabase_client) -> None:
    """Inicializa cliente global."""
    global _global_client
    _global_client = ConductorCatalogClient(supabase_client)


def get_conductor_catalog_client() -> Optional[ConductorCatalogClient]:
    """Retorna cliente global (deve ter sido inicializado antes)."""
    return _global_client


def find_conductor(conductor_id: str) -> Optional[dict]:
    """Função de conveniência para buscar condutor."""
    if not _global_client:
        logger.warning("ConductorCatalogClient não foi inicializado")
        return None
    return _global_client.find_conductor_by_id(conductor_id)


def enrich_conductors(raw_conductors: list[dict]) -> list[dict]:
    """Função de conveniência para enriquecer condutores."""
    if not _global_client:
        logger.warning("ConductorCatalogClient não foi inicializado")
        return raw_conductors
    return _global_client.enrich_conductors(raw_conductors)


def validate_conductor_names(names: list[str]) -> tuple[list[str], list[str]]:
    """Função de conveniência para validar nomes."""
    if not _global_client:
        logger.warning("ConductorCatalogClient não foi inicializado")
        return [], names
    return _global_client.validate_conductor_names(names)
