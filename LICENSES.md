# Licencje elementów zewnętrznych

Kod aplikacji, grafiki i wzorzec danych są autorską pracą zespołu. Poniższe elementy zewnętrzne
pozostają na swoich licencjach (nie podlegają przeniesieniu praw na Ministra Cyfryzacji – można je
dalej swobodnie używać na warunkach tych licencji).

| Element | Wersja | Licencja | Plik licencji | Źródło |
|---|---|---|---|---|
| PapaParse | 5.4.1 | MIT | `vendor/papaparse/LICENSE` | https://www.papaparse.com |
| SheetJS Community Edition | 0.20.3 | Apache-2.0 | `vendor/sheetjs/LICENSE` | https://cdn.sheetjs.com (nie używamy wersji z npm 0.18.5 – znane podatności) |
| Leaflet (js, css, ikony, mapa źródeł) | 1.9.4 | BSD-2-Clause | `vendor/leaflet/LICENSE` | https://leafletjs.com (kopia z cdnjs, suma SHA-256 leaflet.js zgodna z unpkg) |
| openpyxl (tylko generator wzorca, Python) | 3.1.x | MIT | — | https://openpyxl.readthedocs.io |
| lxml (tylko test `tests/waliduj_xml.py`, Python; nie jest częścią aplikacji) | 6.x | BSD-3-Clause | — | https://lxml.de |

## Dane

| Dane | Licencja | Wymóg |
|---|---|---|
| Zbiory z dane.gov.pl w `tests/fixtures` | CC0 1.0 / CC BY 4.0 | szczegóły w `tests/fixtures/README.md` |

## Usługi zewnętrzne (wywoływane z przeglądarki użytkownika, bez kluczy)

| Usługa | Do czego | Warunki |
|---|---|---|
| GUGiK – WMS mapy topograficznej, WMTS ortofotomapy, WMS KIN (punkty adresowe i ulice), mapy.geoportal.gov.pl | podkłady mapy | bez opłat; wykorzystanie bez ograniczeń z wyłączeniem automatycznego pobierania obrazów (harvesting); atrybucja na mapie: „© Główny Urząd Geodezji i Kartografii (Geoportal.gov.pl)”; regulamin Geoportalu |
| GUGiK – Usługa Geokodowania UUG (services.gugik.gov.pl/uug) i ULDK (uldk.gugik.gov.pl) | wyszukiwanie adresu, adres i gmina dla punktu (formularz dysponenta) | publiczne usługi GUGiK; zapytania tylko na żądanie użytkownika, z odstępem między zapytaniami |
| API dane.gov.pl | wyszukiwanie i pobieranie zbiorów (krok 1) | dane na licencjach zbiorów (CC0 1.0 / CC BY 4.0) |

## Fonty i ikony

Fonty systemowe (bez plików fontów). Ikony SVG narysowane przez zespół.
