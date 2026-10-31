"""
Модуль парсеров для агрегатора хакатонов.
"""

from .kvantorium import KvantoriumParser
from .itcube import ItCubeParser
from .universities import UniversityParser
from .aggregators import AggregatorsParser

__all__ = [
    'KvantoriumParser',
    'ItCubeParser', 
    'UniversityParser',
    'AggregatorsParser',
]

# Список всех парсеров для запуска
ALL_PARSERS = [
    KvantoriumParser,
    ItCubeParser,
    UniversityParser,
    AggregatorsParser,
]
