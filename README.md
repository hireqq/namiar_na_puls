# Misja AED – wspólny zbiór danych o defibrylatorach (prototyp)

Prototyp na HackNation 2026 (zadanie „Misja AED – Dane na ratunek”). Łączy dane o defibrylatorach AED
z wielu źródeł w jeden zbiór zgodny z wzorcowym zakresem danych dla portalu dane.gov.pl.
**Działa w całości w przeglądarce** – bez serwera, bazy danych i kluczy API.

## Uruchomienie

- **Najprościej:** otwórz `index.html` w przeglądarce (dwuklik).
- **Przez lokalny serwer** (zalecane – tak samo jak na GitHub Pages):

  ```
  python -m http.server 8765
  ```
  i wejdź na http://localhost:8765
- **GitHub Pages:** opublikuj katalog repozytorium (index.html jest w katalogu głównym).

## Struktura

```
index.html            ekrany aplikacji (sekcje przełączane #hashem)
css/style.css         style (tokeny kolorów w :root, WCAG 2.2 AA)
js/core/              przestrzeń nazw, stan (rejestr źródeł), router
js/schema/schema.js   schemat wzorca – GENEROWANY przez wzorzec/generuj_wzorzec.py
js/sources/file.js    wczytywanie CSV/XLSX/XLS/ODS/JSON/GeoJSON
js/ui/                ekrany i pomocnicze funkcje DOM
wzorzec/              wzorcowy zakres danych (xlsx, csv, schema.json) + generator
tests/fixtures/       pliki testowe (prawdziwe zbiory z dane.gov.pl + dane fikcyjne)
vendor/               biblioteki (kopie lokalne z licencjami) – patrz LICENSES.md
```

## Wzorzec danych – jedno źródło prawdy

```
pip install openpyxl
python wzorzec/generuj_wzorzec.py
```
Generuje: `wzorzec/wzorcowy_zakres_danych_AED.xlsx`, `szablon_aed.csv`, `przyklad_aed.csv`,
`schema.json` (Frictionless Table Schema) oraz `js/schema/schema.js` używany przez aplikację.

## Stan prac

- [x] Część 1: szkielet, router, źródło „Plik”, rejestr źródeł
- [x] Część 2: OpenStreetMap (Overpass) i dane.gov.pl (API) – testy: `node tests/zdalne.test.js`
- [ ] Część 3: mapowanie kolumn, normalizacja, walidacja
- [ ] Część 4: deduplikacja, eksport, instrukcja publikacji
- [ ] Część 5: formularz dysponenta, mapa, testy, wdrożenie
