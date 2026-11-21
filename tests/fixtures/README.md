# Pliki testowe

| Plik | Pochodzenie | Licencja | Co testuje |
|---|---|---|---|
| `krosno_dgp3624.csv` | Urząd Miasta Krosna, „Defibrylatory zlokalizowane w Mieście Krosno”, https://dane.gov.pl/pl/dataset/3624 (pobrano 2026-11-21) | CC0 1.0 | adres w jednym polu, spacje w nagłówkach |
| `marki_dgp4955.csv` | Urząd Miasta Marki, „Defibrylatory zlokalizowane na terenie Miasta Marki”, https://dane.gov.pl/pl/dataset/4955 (pobrano 2026-11-21) | CC BY 4.0 | każdy wiersz ujęty w cudzysłów; współrzędne w odwrotnej kolejności niż nagłówki |
| `marki_dgp4955.xlsx` | jw. | CC BY 4.0 | wczytywanie XLSX |
| `przemysl_dgp4581.csv` | Urząd Miejski w Przemyślu, „Lokalizacje AED…”, https://dane.gov.pl/pl/dataset/4581 (pobrano 2026-11-21) | CC0 1.0 | separator średnik, współrzędne jako GeoJSON w kolumnie |
| `gmina_przyklad_cp1250.csv` | dane fikcyjne przygotowane przez zespół | — | kodowanie Windows-1250, wiersz tytułu nad tabelą, przecinek dziesiętny |
| `przyklad_wzorzec.csv`, `przyklad_wzorzec.xlsx` | wygenerowane przez `wzorzec/generuj_wzorzec.py` (dane fikcyjne) | — | plik w pełni zgodny ze wzorcem |
