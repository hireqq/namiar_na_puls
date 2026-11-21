# Misja AED – wspólny zbiór danych o defibrylatorach (prototyp)

Prototyp na HackNation 2026 (zadanie „Misja AED – Dane na ratunek”). Łączy dane o defibrylatorach AED
z wielu źródeł (pliki dysponentów, zbiory z dane.gov.pl, formularz dysponenta) w jeden zbiór zgodny z wzorcowym
zakresem danych dla portalu dane.gov.pl. **Działa w całości w przeglądarce** – bez serwera, bazy danych i kluczy API.

Usługi zewnętrzne (publiczne, bez kluczy):
- **API dane.gov.pl** – wyszukiwanie i pobieranie opublikowanych zbiorów o AED (krok 1),
- **GUGiK / Geoportal.gov.pl** – podkłady mapy w EPSG:3857: mapa topograficzna (WMS `img/guest/TOPO`),
  ortofotomapa (WMTS `PZGIK/ORTO/WMTS/StandardResolution`, macierz `EPSG:3857`) i nakładka punktów adresowych
  i ulic (WMS Krajowej Integracji Numeracji Adresowej); atrybucja „© Główny Urząd Geodezji i Kartografii”,
- **GUGiK UUG** (Usługa Geokodowania, `services.gugik.gov.pl/uug`) – wyszukiwanie adresu i adres najbliższy punktowi
  w formularzu dysponenta, **GUGiK ULDK** (`uldk.gugik.gov.pl`) – gmina i kod TERC dla punktu.

Mapa nigdy nie jest jedynym sposobem: wszystko, co pokazuje, jest też dostępne jako tekst (listy, legenda z liczbami,
pola współrzędnych, wyszukiwanie adresu).

## Uruchomienie

- **Najprościej:** otwórz `index.html` w przeglądarce (dwuklik).
- **Przez lokalny serwer** (zalecane – tak samo jak na GitHub Pages):

  ```
  python -m http.server 8765
  ```
  i wejdź na http://localhost:8765
- **GitHub Pages:** patrz sekcja [Wdrożenie](#wdrożenie).

## Struktura

```
index.html            ekrany aplikacji (sekcje przełączane #hashem)
css/style.css         style (tokeny kolorów w :root, WCAG 2.2 AA)
js/core/              przestrzeń nazw, stan (źródła, rekordy, duplikaty, wynik), router,
                      normalizacja, mapowanie, walidacja, duplikaty.js (wykrywanie i scalanie),
                      eksport.js (CSV, XLSX, JSON, GeoJSON, rejestr źródeł, datapackage, metadane XML)
js/schema/schema.js   schemat wzorca – GENEROWANY przez wzorzec/generuj_wzorzec.py
js/core/formularz.js  logika formularza dysponenta (pola, normalizacja, walidacja, CSV, szkic)
js/sources/file.js    wczytywanie CSV/XLSX/XLS/ODS/JSON/GeoJSON
js/sources/dgp.js     API dane.gov.pl
js/sources/geokoder.js  geokodowanie GUGiK (UUG, ULDK)
js/ui/                ekrany i pomocnicze funkcje DOM: zdalne.js (dane.gov.pl, krok 1), duplikaty.js (krok 3),
                      wynik.js (krok 4), mapa.js (Leaflet + podkłady GUGiK), formularz.js (formularz dysponenta)
wzorzec/              wzorcowy zakres danych (xlsx, csv, schema.json) + generator
tests/*.test.js       testy logiki w Node (bez przeglądarki), uruchamiane przez tests/uruchom.js
tests/e2e/            testy end-to-end w headless Edge/Chrome (CDP, bez zależności npm)
tests/fixtures/       pliki testowe (prawdziwe zbiory z dane.gov.pl, odpowiedzi API GUGiK + dane fikcyjne)
tests/mock-*.js       atrapy modułów do testów interfejsu (nie dołączać do index.html)
tests/waliduj_xml.py  sprawdzenie pliku metadanych XML ze schematem harvestera (wymaga lxml)
otwarte_dane_latest.xsd  schemat XML harvestera dane.gov.pl
vendor/               biblioteki (kopie lokalne z licencjami) – patrz LICENSES.md
```

## Wzorzec danych – jedno źródło prawdy

```
pip install openpyxl
python wzorzec/generuj_wzorzec.py
```
Generuje: `wzorzec/wzorcowy_zakres_danych_AED.xlsx`, `szablon_aed.csv`, `przyklad_aed.csv`,
`schema.json` (Frictionless Table Schema) oraz `js/schema/schema.js` używany przez aplikację.

## Testy

- **Logika (Node 18+):** `node tests/uruchom.js` – wszystkie pliki `tests/*.test.js` (np. `node tests/uruchom.js czesc5`).
- **End-to-end (przeglądarka, Node 22+ – potrzebny wbudowany `WebSocket` do sterowania przeglądarką):** `node tests/e2e/uruchom.js`
  - wymaga **Microsoft Edge albo Google Chrome / Chromium** (wykrywane automatycznie; inną ścieżkę wskaż zmienną
    `AED_PRZEGLADARKA`) oraz **Pythona 3** w PATH – skrypt sam uruchamia `python -m http.server` na wolnym porcie
    i zamyka go na końcu; bez zależności npm,
  - domyślnie **bez internetu**: kafle mapy GUGiK zastępuje lokalny obrazek, geokoder – atrapa (`tests/mock-czesc5.js`);
    `--siec` wyłącza blokadę, `--zrzuty` zapisuje zrzuty ekranu, nazwa testu uruchamia tylko jego
    (np. `node tests/e2e/uruchom.js formularz`),
  - sprawdza: przepływ kroków 1→4 na plikach z `tests/fixtures`, formularz dysponenta (wyszukanie adresu, mapa,
    walidacja, szkic, CSV, „Dodaj do scalania”), inicjalizację map, szerokość 320 px bez poziomego przewijania,
    brak błędów w konsoli i podstawową obsługę klawiaturą.

## Wdrożenie

`.github/workflows/testy.yml` uruchamia testy przy każdym pushu i pull requeście, a `.github/workflows/pages.yml`
publikuje stronę na GitHub Pages (po zaliczonych testach). Jednorazowo w repozytorium:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Stan prac

- [x] Część 1: szkielet, router, źródło „Plik”, rejestr źródeł
- [x] Część 2: zbiory z dane.gov.pl (API)
- [x] Część 3: mapowanie kolumn, normalizacja, walidacja
- [x] Część 4: duplikaty i punkty odstające, wynik, eksport (CSV, XLSX, JSON, GeoJSON, rejestr źródeł,
  datapackage.json, metadane XML), instrukcja publikacji w dane.gov.pl
- [x] Część 5: formularz dysponenta (z wyszukiwaniem adresu GUGiK i szkicem w przeglądarce), mapa (Leaflet,
  podkłady GUGiK) w krokach 3 i 4 oraz w formularzu, testy e2e, wdrożenie na GitHub Pages
