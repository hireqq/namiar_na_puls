/* PLIK GENEROWANY przez wzorzec/generuj_wzorzec.py – nie edytuj ręcznie. */
window.AED = window.AED || {};
window.AED.wzorzec = {
 "schema": {
  "name": "aed",
  "title": "Wzorcowy zakres danych o defibrylatorach AED",
  "version": "0.1 (szkic HackNation 2026)",
  "fields": [
   {
    "name": "id_aed",
    "title": "Identyfikator AED",
    "description": "Stały, globalnie unikalny identyfikator urządzenia w zbiorze ogólnopolskim. Nadaje go narzędzie przy pierwszym imporcie; potem się nie zmienia.",
    "type": "string",
    "constraints": {
     "unique": true,
     "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
     "required": true
    },
    "aed": {
     "grupa": "Identyfikacja",
     "obowiazkowosc": "O",
     "format": "UUID (RFC 9562), małe litery; nowe rekordy: wersja 4 (losowa)",
     "przyklad": "8f14e45f-ceea-467a-9a3b-2c1d0e5f6a7b",
     "uzasadnienie": "Pozwala aktualizować rekord zamiast tworzyć duplikat i łączyć go z innymi zbiorami. UUID nie wymaga centralnego rejestru, więc może go nadać dysponent lub aplikacja w przeglądarce.",
     "slownik": null,
     "osm": "ref:aed (propozycja, do weryfikacji)",
     "walidacja": "wzorzec UUID; unikalny w zbiorze"
    }
   },
   {
    "name": "id_lokalne",
    "title": "Identyfikator u dysponenta",
    "description": "Numer inwentarzowy lub ID w systemie dysponenta (np. „Numer Id” w Krośnie, „AED 9485” w Przemyślu).",
    "type": "string",
    "aed": {
     "grupa": "Identyfikacja",
     "obowiazkowosc": "Z",
     "format": "dowolny",
     "przyklad": "AED-9485",
     "uzasadnienie": "Dysponent szybko odnajduje swój rekord. Para dysponent + id_lokalne pewnie wykrywa duplikaty przy kolejnych importach.",
     "slownik": null,
     "osm": "ref=*",
     "walidacja": "unikalny w obrębie dysponenta"
    }
   },
   {
    "name": "nazwa",
    "title": "Nazwa miejsca",
    "description": "Krótka nazwa obiektu, w którym jest AED, rozpoznawalna dla przechodnia.",
    "type": "string",
    "constraints": {
     "maxLength": 150,
     "required": true
    },
    "aed": {
     "grupa": "Identyfikacja",
     "obowiazkowosc": "O",
     "format": "maks. 150 znaków",
     "przyklad": "Szkoła Podstawowa nr 1 – hol główny",
     "uzasadnienie": "Świadek zdarzenia szuka budynku, a nie współrzędnych. Nazwa jest też tytułem pinezki w aplikacjach.",
     "slownik": null,
     "osm": "name=* (obiektu) / description=*",
     "walidacja": "niepuste; maks. 150 znaków"
    }
   },
   {
    "name": "status",
    "title": "Status urządzenia",
    "description": "Czy urządzenie jest obecnie dostępne.",
    "type": "string",
    "constraints": {
     "required": true,
     "enum": [
      "aktywny",
      "tymczasowo_niedostepny",
      "wycofany",
      "do_weryfikacji"
     ]
    },
    "aed": {
     "grupa": "Identyfikacja",
     "obowiazkowosc": "O",
     "format": "kod ze słownika",
     "przyklad": "aktywny",
     "uzasadnienie": "Wycofanych rekordów nie kasujemy, tylko oznaczamy. Dzięki temu urządzenie, którego już nie ma, nie „wraca” z OSM przy kolejnym scaleniu.",
     "slownik": "status",
     "osm": "emergency=defibrillator / disused:*",
     "walidacja": "wartość ze słownika"
    }
   },
   {
    "name": "szerokosc_geograficzna",
    "title": "Szerokość geograficzna",
    "description": "Szerokość geograficzna miejsca zawieszenia AED (nie środka działki).",
    "type": "number",
    "constraints": {
     "minimum": 49.0,
     "maximum": 54.9,
     "required": true
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "O",
     "format": "WGS84 (EPSG:4326), stopnie dziesiętne, kropka, 6 miejsc po przecinku",
     "przyklad": "52.229676",
     "uzasadnienie": "Bez współrzędnych nie ma nawigacji ani mapy. WGS84 wymaga format GeoJSON (RFC 7946) i używa go GPS oraz OSM. Kropka dziesiętna zgodnie ze Standardem technicznym dane.gov.pl (2020).",
     "slownik": null,
     "osm": "lat węzła",
     "walidacja": "49.0–54.9 (granice PL); kontrola zamiany z długością"
    }
   },
   {
    "name": "dlugosc_geograficzna",
    "title": "Długość geograficzna",
    "description": "Długość geograficzna miejsca zawieszenia AED.",
    "type": "number",
    "constraints": {
     "minimum": 14.1,
     "maximum": 24.2,
     "required": true
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "O",
     "format": "WGS84 (EPSG:4326), stopnie dziesiętne, kropka, 6 miejsc po przecinku",
     "przyklad": "21.012229",
     "uzasadnienie": "Jw. W zbiorze z Marek na dane.gov.pl nagłówki mają odwrotną kolejność niż wartości. Walidator musi to wykrywać.",
     "slownik": null,
     "osm": "lon węzła",
     "walidacja": "14.1–24.2 (granice PL)"
    }
   },
   {
    "name": "lokalizacja_przyblizona",
    "title": "Lokalizacja przybliżona",
    "description": "true, gdy punkt wyznaczono z adresu lub „na oko”, a nie w miejscu zawieszenia urządzenia.",
    "type": "boolean",
    "trueValues": [
     "true"
    ],
    "falseValues": [
     "false"
    ],
    "constraints": {
     "required": true
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "O",
     "format": "true / false",
     "przyklad": "false",
     "uzasadnienie": "Ratownik wie, czy może ufać pinezce, czy musi szukać w budynku. Rekordy przybliżone wskazują też, gdzie potrzebna jest weryfikacja w terenie.",
     "slownik": null,
     "osm": "— (brak odpowiednika)",
     "walidacja": "true/false"
    }
   },
   {
    "name": "zrodlo_wspolrzednych",
    "title": "Źródło współrzędnych",
    "description": "Jak ustalono współrzędne.",
    "type": "string",
    "constraints": {
     "enum": [
      "pomiar_gps",
      "wskazanie_na_mapie",
      "geokodowanie_adresu",
      "osm",
      "nieznane"
     ]
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "Z",
     "format": "kod ze słownika",
     "przyklad": "pomiar_gps",
     "uzasadnienie": "Uzupełnia flagę przybliżenia. Pomaga rozstrzygać konflikty przy scalaniu (pomiar GPS > geokodowanie).",
     "slownik": "zrodlo_wspolrzednych",
     "osm": "—",
     "walidacja": "wartość ze słownika"
    }
   },
   {
    "name": "kod_terc_gminy",
    "title": "Kod TERC gminy",
    "description": "Kod terytorialny gminy z rejestru TERYT GUS (z cyfrą rodzaju gminy).",
    "type": "string",
    "constraints": {
     "pattern": "^\\d{7}$"
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "Z",
     "format": "7 cyfr WWPPGGR (TERYT)",
     "przyklad": "1465011",
     "uzasadnienie": "Pozwala agregować dane po gminach, powiatach i województwach oraz łączyć je z innymi zbiorami publicznymi. Standard techniczny dane.gov.pl wskazuje TERYT jako miejsce publikacji danych adresowych.",
     "slownik": null,
     "osm": "— (pochodna z granic administracyjnych)",
     "walidacja": "7 cyfr; tekst, z zerem wiodącym"
    }
   },
   {
    "name": "wojewodztwo",
    "title": "Województwo",
    "description": "Nazwa województwa.",
    "type": "string",
    "constraints": {
     "enum": [
      "dolnośląskie",
      "kujawsko-pomorskie",
      "lubelskie",
      "lubuskie",
      "łódzkie",
      "małopolskie",
      "mazowieckie",
      "opolskie",
      "podkarpackie",
      "podlaskie",
      "pomorskie",
      "śląskie",
      "świętokrzyskie",
      "warmińsko-mazurskie",
      "wielkopolskie",
      "zachodniopomorskie"
     ]
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "Z",
     "format": "nazwa małymi literami",
     "przyklad": "mazowieckie",
     "uzasadnienie": "Ułatwia filtrowanie bez znajomości kodów. Można ją wyliczyć z kod_terc_gminy (pierwsze 2 cyfry).",
     "slownik": "wojewodztwo",
     "osm": "—",
     "walidacja": "jedna z 16 nazw"
    }
   },
   {
    "name": "miejscowosc",
    "title": "Miejscowość",
    "description": "Nazwa miejscowości.",
    "type": "string",
    "constraints": {
     "required": true
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "O",
     "format": "jak w TERYT SIMC",
     "przyklad": "Warszawa",
     "uzasadnienie": "Standard techniczny dane.gov.pl wymaga adresu w odrębnych polach (ulica, numer, kod, miejscowość), a nie w jednym polu tekstowym.",
     "slownik": null,
     "osm": "addr:city / addr:place",
     "walidacja": "niepuste"
    }
   },
   {
    "name": "kod_simc",
    "title": "Identyfikator miejscowości SIMC",
    "description": "Identyfikator miejscowości z TERYT SIMC.",
    "type": "string",
    "constraints": {
     "pattern": "^\\d{7}$"
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "F",
     "format": "7 cyfr",
     "przyklad": "0918123",
     "uzasadnienie": "Jednoznaczny i niezmienny. Rozwiązuje problem powtarzalnych nazw miejscowości (np. wiele miejscowości „Zalesie”).",
     "slownik": null,
     "osm": "—",
     "walidacja": "7 cyfr"
    }
   },
   {
    "name": "cecha_ulicy",
    "title": "Cecha ulicy",
    "description": "Typ ulicy: ul., al., pl. itd. Obowiązkowe, jeśli wypełniono pole ulica.",
    "type": "string",
    "constraints": {
     "enum": [
      "ul.",
      "al.",
      "pl.",
      "os.",
      "rondo",
      "skwer",
      "bulw.",
      "inne"
     ]
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "W",
     "format": "kod ze słownika",
     "przyklad": "ul.",
     "uzasadnienie": "Rozdzielenie cechy od nazwy wzorujemy na tabeli 4 Standardu technicznego dane.gov.pl.",
     "slownik": "cecha_ulicy",
     "osm": "część addr:street",
     "walidacja": "wymagane gdy ulica niepusta",
     "wymaganeGdy": {
      "pole": "ulica",
      "niepuste": true
     }
    }
   },
   {
    "name": "ulica",
    "title": "Nazwa ulicy",
    "description": "Nazwa ulicy. Puste w miejscowościach bez nazw ulic.",
    "type": "string",
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "W",
     "format": "bez cechy, jak w TERYT ULIC",
     "przyklad": "Marszałkowska",
     "uzasadnienie": "Jw. Część małych miejscowości nie ma ulic, więc pole jest warunkowe.",
     "slownik": null,
     "osm": "addr:street",
     "walidacja": "—"
    }
   },
   {
    "name": "kod_ulic",
    "title": "Identyfikator ulicy ULIC",
    "description": "Identyfikator ulicy z TERYT ULIC.",
    "type": "string",
    "constraints": {
     "pattern": "^\\d{5}$"
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "F",
     "format": "5 cyfr",
     "przyklad": "12345",
     "uzasadnienie": "Jednoznaczny klucz do rejestru adresów; ułatwia geokodowanie i deduplikację.",
     "slownik": null,
     "osm": "—",
     "walidacja": "5 cyfr"
    }
   },
   {
    "name": "numer_budynku",
    "title": "Numer budynku",
    "description": "Numer porządkowy budynku. Obowiązkowe, jeśli budynek ma numer.",
    "type": "string",
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "W",
     "format": "np. 5A, 12/14",
     "przyklad": "100",
     "uzasadnienie": "Potrzebny do nawigacji i porównywania adresów przy deduplikacji. Typ tekstowy, bo numery zawierają litery.",
     "slownik": null,
     "osm": "addr:housenumber",
     "walidacja": "—"
    }
   },
   {
    "name": "kod_pocztowy",
    "title": "Kod pocztowy",
    "description": "Kod pocztowy (PNA).",
    "type": "string",
    "constraints": {
     "pattern": "^\\d{2}-\\d{3}$"
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "Z",
     "format": "NN-NNN",
     "przyklad": "00-001",
     "uzasadnienie": "Standardowy element adresu pocztowego (Standard techniczny, tabela 4).",
     "slownik": null,
     "osm": "addr:postcode",
     "walidacja": "wzorzec \\d{2}-\\d{3}"
    }
   },
   {
    "name": "opis_lokalizacji",
    "title": "Opis dojścia / miejsca",
    "description": "Gdzie dokładnie wisi AED w obiekcie lub na budynku.",
    "type": "string",
    "constraints": {
     "maxLength": 300,
     "required": true
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "O",
     "format": "maks. 300 znaków",
     "przyklad": "Hol główny, na lewo od wejścia, obok recepcji",
     "uzasadnienie": "Najważniejsza informacja w pierwszych minutach. Współrzędne nie powiedzą, za którymi drzwiami szukać.",
     "slownik": null,
     "osm": "defibrillator:location=*",
     "walidacja": "niepuste"
    }
   },
   {
    "name": "opis_lokalizacji_en",
    "title": "Opis dojścia (EN)",
    "description": "Opis dojścia po angielsku.",
    "type": "string",
    "constraints": {
     "maxLength": 300
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "F",
     "format": "maks. 300 znaków",
     "przyklad": "Main hall, left of the entrance, next to the reception",
     "uzasadnienie": "Turyści i obcokrajowcy. OSM ma odpowiednik defibrillator:location:en.",
     "slownik": null,
     "osm": "defibrillator:location:en=*",
     "walidacja": "—"
    }
   },
   {
    "name": "wewnatrz_budynku",
    "title": "Wewnątrz budynku",
    "description": "true: wewnątrz budynku; false: na zewnątrz (np. kapsuła na elewacji).",
    "type": "boolean",
    "trueValues": [
     "true"
    ],
    "falseValues": [
     "false"
    ],
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "Z",
     "format": "true / false",
     "przyklad": "true",
     "uzasadnienie": "AED na zewnątrz jest zwykle dostępny całą dobę; wewnątrz zależy od godzin otwarcia.",
     "slownik": null,
     "osm": "indoor=yes/no",
     "walidacja": "true/false"
    }
   },
   {
    "name": "kondygnacja",
    "title": "Kondygnacja",
    "description": "Numer piętra, na którym jest urządzenie.",
    "type": "integer",
    "constraints": {
     "minimum": -5,
     "maximum": 100
    },
    "aed": {
     "grupa": "Lokalizacja",
     "obowiazkowosc": "F",
     "format": "0 = parter, -1 = piwnica",
     "przyklad": "0",
     "uzasadnienie": "W wielopiętrowych budynkach (galerie, dworce) oszczędza czas.",
     "slownik": null,
     "osm": "level=*",
     "walidacja": "liczba całkowita od -5 do 100"
    }
   },
   {
    "name": "dostepnosc",
    "title": "Dostępność",
    "description": "Kto i kiedy może skorzystać z urządzenia.",
    "type": "string",
    "constraints": {
     "required": true,
     "enum": [
      "publiczna_24_7",
      "publiczna_w_godzinach",
      "dla_klientow",
      "tylko_personel",
      "mobilny"
     ]
    },
    "aed": {
     "grupa": "Dostępność",
     "obowiazkowosc": "O",
     "format": "kod ze słownika",
     "przyklad": "publiczna_w_godzinach",
     "uzasadnienie": "To sedno lekcji z opisu zadania: AED był w kilku miejscach, ale zamknięty. Ratownik musi wiedzieć to z góry.",
     "slownik": "dostepnosc",
     "osm": "access=*",
     "walidacja": "wartość ze słownika"
    }
   },
   {
    "name": "godziny_dostepnosci",
    "title": "Godziny dostępności",
    "description": "Godziny, w których urządzenie jest dostępne. Obowiązkowe, gdy dostepnosc = publiczna_w_godzinach lub dla_klientow.",
    "type": "string",
    "aed": {
     "grupa": "Dostępność",
     "obowiazkowosc": "W",
     "format": "składnia OSM opening_hours, np. Mo-Fr 07:00-17:00; Sa 08:00-14:00 lub 24/7",
     "przyklad": "Mo-Fr 07:00-17:00",
     "uzasadnienie": "Składnia OSM jest maszynowo czytelna (są do niej otwarte parsery). Aplikacja może więc pokazać „dostępny teraz”. Zwykły tekst („w godzinach pracy”) na to nie pozwala.",
     "slownik": null,
     "osm": "opening_hours=*",
     "walidacja": "poprawna składnia opening_hours",
     "wymaganeGdy": {
      "pole": "dostepnosc",
      "wartosci": [
       "publiczna_w_godzinach",
       "dla_klientow"
      ]
     }
    }
   },
   {
    "name": "sposob_dostepu",
    "title": "Sposób dostępu / zabezpieczenie",
    "description": "Czy urządzenie jest zamknięte i w jaki sposób.",
    "type": "string",
    "constraints": {
     "required": true,
     "enum": [
      "otwarta_szafka",
      "szafka_z_alarmem",
      "szafka_na_kod",
      "szafka_na_klucz",
      "u_personelu",
      "nieznany"
     ]
    },
    "aed": {
     "grupa": "Dostępność",
     "obowiazkowosc": "O",
     "format": "kod ze słownika",
     "przyklad": "szafka_z_alarmem",
     "uzasadnienie": "Szafka na klucz bez informacji, gdzie jest klucz, oznacza w praktyce brak AED.",
     "slownik": "sposob_dostepu",
     "osm": "locked=* + defibrillator:cabinet=*",
     "walidacja": "wartość ze słownika"
    }
   },
   {
    "name": "instrukcja_dostepu",
    "title": "Instrukcja dostępu",
    "description": "Gdzie jest klucz lub kto podaje kod. Obowiązkowe, gdy sposob_dostepu = szafka_na_kod lub szafka_na_klucz. NIE wpisujemy samego kodu.",
    "type": "string",
    "constraints": {
     "maxLength": 300
    },
    "aed": {
     "grupa": "Dostępność",
     "obowiazkowosc": "W",
     "format": "maks. 300 znaków",
     "przyklad": "Klucz w portierni (całodobowo)",
     "uzasadnienie": "Uzupełnia sposób dostępu. Publikowanie kodu w otwartych danych byłoby ryzykiem kradzieży (Standard bezpieczeństwa).",
     "slownik": null,
     "osm": "description=* (brak dedykowanego klucza)",
     "walidacja": "nie zawiera ciągu wyglądającego na kod (np. 4–8 cyfr)",
     "wymaganeGdy": {
      "pole": "sposob_dostepu",
      "wartosci": [
       "szafka_na_kod",
       "szafka_na_klucz"
      ]
     }
    }
   },
   {
    "name": "typ_urzadzenia",
    "title": "Typ urządzenia",
    "description": "AED półautomatyczny lub automatyczny.",
    "type": "string",
    "constraints": {
     "enum": [
      "polautomatyczny",
      "automatyczny",
      "nieznany"
     ]
    },
    "aed": {
     "grupa": "Urządzenie",
     "obowiazkowosc": "F",
     "format": "kod ze słownika",
     "przyklad": "polautomatyczny",
     "uzasadnienie": "Pomocne dla dyspozytora prowadzącego świadka przez telefon.",
     "slownik": "typ_urzadzenia",
     "osm": "—",
     "walidacja": "wartość ze słownika"
    }
   },
   {
    "name": "producent",
    "title": "Producent",
    "description": "Producent urządzenia.",
    "type": "string",
    "aed": {
     "grupa": "Urządzenie",
     "obowiazkowosc": "F",
     "format": "",
     "przyklad": "Producent X",
     "uzasadnienie": "Komunikaty bezpieczeństwa (wycofania z rynku) dotyczą konkretnych producentów i modeli.",
     "slownik": null,
     "osm": "manufacturer=*",
     "walidacja": "—"
    }
   },
   {
    "name": "model",
    "title": "Model",
    "description": "Model urządzenia.",
    "type": "string",
    "aed": {
     "grupa": "Urządzenie",
     "obowiazkowosc": "F",
     "format": "",
     "przyklad": "Model Y",
     "uzasadnienie": "Jw. Dyspozytor może też podać instrukcję obsługi dla danego modelu.",
     "slownik": null,
     "osm": "model=*",
     "walidacja": "—"
    }
   },
   {
    "name": "tryb_pediatryczny",
    "title": "Tryb / elektrody pediatryczne",
    "description": "Czy na miejscu są elektrody lub klucz pediatryczny.",
    "type": "boolean",
    "trueValues": [
     "true"
    ],
    "falseValues": [
     "false"
    ],
    "aed": {
     "grupa": "Urządzenie",
     "obowiazkowosc": "F",
     "format": "true / false",
     "przyklad": "true",
     "uzasadnienie": "Przy NZK u dziecka pozwala wybrać właściwe urządzenie (szkoły, przedszkola, baseny).",
     "slownik": null,
     "osm": "— (propozycja: defibrillator:pediatric, do weryfikacji)",
     "walidacja": "true/false"
    }
   },
   {
    "name": "data_waznosci_elektrod",
    "title": "Ważność elektrod",
    "description": "Data ważności założonych elektrod.",
    "type": "date",
    "aed": {
     "grupa": "Urządzenie",
     "obowiazkowosc": "Z",
     "format": "RRRR-MM-DD (ISO 8601)",
     "przyklad": "2027-06-30",
     "uzasadnienie": "Elektrody po terminie mogą nie działać. Pole odpowiada na pytanie z zadania „czy działa” i pozwala przypominać dysponentom o wymianie.",
     "slownik": null,
     "osm": "—",
     "walidacja": "data ISO; ostrzeżenie, gdy w przeszłości"
    }
   },
   {
    "name": "data_waznosci_baterii",
    "title": "Ważność baterii",
    "description": "Data ważności lub wymiany baterii.",
    "type": "date",
    "aed": {
     "grupa": "Urządzenie",
     "obowiazkowosc": "Z",
     "format": "RRRR-MM-DD (ISO 8601)",
     "przyklad": "2029-01-31",
     "uzasadnienie": "Jw.",
     "slownik": null,
     "osm": "—",
     "walidacja": "data ISO; ostrzeżenie, gdy w przeszłości"
    }
   },
   {
    "name": "data_przegladu",
    "title": "Data ostatniego przeglądu",
    "description": "Data ostatniego przeglądu technicznego (serwisu).",
    "type": "date",
    "aed": {
     "grupa": "Urządzenie",
     "obowiazkowosc": "Z",
     "format": "RRRR-MM-DD (ISO 8601)",
     "przyklad": "2026-09-15",
     "uzasadnienie": "Pokazuje, czy urządzenie jest utrzymywane.",
     "slownik": null,
     "osm": "—",
     "walidacja": "data ISO; nie w przyszłości"
    }
   },
   {
    "name": "dysponent_nazwa",
    "title": "Dysponent (nazwa)",
    "description": "Podmiot odpowiedzialny za urządzenie i aktualność danych.",
    "type": "string",
    "constraints": {
     "required": true
    },
    "aed": {
     "grupa": "Dysponent",
     "obowiazkowosc": "O",
     "format": "pełna nazwa instytucji",
     "przyklad": "Urząd Dzielnicy Śródmieście m.st. Warszawy",
     "uzasadnienie": "Wiadomo, kogo pytać o poprawki. Grupowanie po dysponencie służy do kampanii zachęcającej do publikacji.",
     "slownik": null,
     "osm": "operator=*",
     "walidacja": "niepuste"
    }
   },
   {
    "name": "dysponent_typ",
    "title": "Typ dysponenta",
    "description": "Kategoria podmiotu.",
    "type": "string",
    "constraints": {
     "enum": [
      "jst",
      "administracja_rzadowa",
      "podmiot_leczniczy",
      "placowka_oswiatowa",
      "sluzby",
      "transport",
      "firma",
      "organizacja_pozarzadowa",
      "inny"
     ]
    },
    "aed": {
     "grupa": "Dysponent",
     "obowiazkowosc": "Z",
     "format": "kod ze słownika",
     "przyklad": "jst",
     "uzasadnienie": "Analiza pokrycia (np. ile AED mają szkoły) i kierowanie kampanii do grup dysponentów.",
     "slownik": "dysponent_typ",
     "osm": "—",
     "walidacja": "wartość ze słownika"
    }
   },
   {
    "name": "dysponent_regon",
    "title": "REGON dysponenta",
    "description": "REGON instytucji. Nie podawać dla osób fizycznych prowadzących działalność.",
    "type": "string",
    "constraints": {
     "pattern": "^(\\d{9}|\\d{14})$"
    },
    "aed": {
     "grupa": "Dysponent",
     "obowiazkowosc": "F",
     "format": "9 lub 14 cyfr, bez spacji",
     "przyklad": "012345678",
     "uzasadnienie": "Jednoznacznie identyfikuje podmiot (format wg Standardu technicznego dane.gov.pl). Wyłączenie osób fizycznych ogranicza ryzyko RODO.",
     "slownik": null,
     "osm": "—",
     "walidacja": "9 lub 14 cyfr"
    }
   },
   {
    "name": "telefon_kontaktowy",
    "title": "Telefon kontaktowy",
    "description": "Telefon instytucji (portiernia, recepcja). Nie numer prywatny.",
    "type": "string",
    "constraints": {
     "pattern": "^(\\+48)?\\d{9}$"
    },
    "aed": {
     "grupa": "Dysponent",
     "obowiazkowosc": "F",
     "format": "9 cyfr bez spacji lub +48 i 9 cyfr",
     "przyklad": "225970927",
     "uzasadnienie": "Pozwala zadzwonić po klucz lub zgłosić usterkę. Format wg Standardu technicznego dane.gov.pl.",
     "slownik": null,
     "osm": "phone=*",
     "walidacja": "wzorzec (\\+48)?\\d{9}"
    }
   },
   {
    "name": "email_kontaktowy",
    "title": "E-mail kontaktowy",
    "description": "Funkcyjny adres e-mail instytucji do zgłaszania zmian. Nie adres imienny.",
    "type": "string",
    "constraints": {
     "pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"
    },
    "aed": {
     "grupa": "Dysponent",
     "obowiazkowosc": "F",
     "format": "adres funkcyjny",
     "przyklad": "sekretariat@przyklad.gov.pl",
     "uzasadnienie": "Kanał na zgłoszenia błędów w danych. Adres funkcyjny ogranicza ryzyko RODO.",
     "slownik": null,
     "osm": "email=*",
     "walidacja": "poprawny e-mail"
    }
   },
   {
    "name": "data_weryfikacji",
    "title": "Data weryfikacji",
    "description": "Kiedy ostatnio potwierdzono, że urządzenie jest na miejscu i działa.",
    "type": "date",
    "constraints": {
     "required": true
    },
    "aed": {
     "grupa": "Jakość i pochodzenie",
     "obowiazkowosc": "O",
     "format": "RRRR-MM-DD (ISO 8601)",
     "przyklad": "2026-11-20",
     "uzasadnienie": "Najważniejsza miara aktualności. Pozwala odróżnić dane świeże od zalegających od lat i ustalić, który rekord wygrywa przy scalaniu.",
     "slownik": null,
     "osm": "check_date=*",
     "walidacja": "data ISO; nie w przyszłości; ostrzeżenie, gdy > 12 mies."
    }
   },
   {
    "name": "sposob_weryfikacji",
    "title": "Sposób weryfikacji",
    "description": "Jak potwierdzono dane.",
    "type": "string",
    "constraints": {
     "enum": [
      "wizja_lokalna",
      "potwierdzenie_dysponenta",
      "zdjecie",
      "import_bez_weryfikacji"
     ]
    },
    "aed": {
     "grupa": "Jakość i pochodzenie",
     "obowiazkowosc": "Z",
     "format": "kod ze słownika",
     "przyklad": "wizja_lokalna",
     "uzasadnienie": "Wizja lokalna jest pewniejsza niż import. Pole wspiera ocenę jakości.",
     "slownik": "sposob_weryfikacji",
     "osm": "—",
     "walidacja": "wartość ze słownika"
    }
   },
   {
    "name": "zrodlo_danych",
    "title": "Źródło danych (kod)",
    "description": "Kod źródła, z którego pochodzi rekord. Rekordy scalone z wielu źródeł mają tu źródło nadrzędne, a pełną listę w tabeli zrodla_rekordu.",
    "type": "string",
    "constraints": {
     "required": true
    },
    "aed": {
     "grupa": "Jakość i pochodzenie",
     "obowiazkowosc": "O",
     "format": "kod z arkusza zakres_referencyjny_zrodel",
     "przyklad": "DGP-4581",
     "uzasadnienie": "Wymóg zadania: oznaczenie źródła każdego rekordu i wskazanie zakresu referencyjnego źródeł.",
     "slownik": null,
     "osm": "— (stała „OSM”)",
     "walidacja": "kod istnieje w rejestrze źródeł"
    }
   },
   {
    "name": "zrodlo_id_rekordu",
    "title": "ID rekordu w źródle",
    "description": "Identyfikator rekordu w systemie źródłowym.",
    "type": "string",
    "aed": {
     "grupa": "Jakość i pochodzenie",
     "obowiazkowosc": "Z",
     "format": "np. node/123456789",
     "przyklad": "node/123456789",
     "uzasadnienie": "Pozwala wrócić do źródła i zsynchronizować zmiany (np. edycje w OSM).",
     "slownik": null,
     "osm": "typ/id obiektu OSM",
     "walidacja": "—"
    }
   },
   {
    "name": "licencja_rekordu",
    "title": "Licencja rekordu",
    "description": "Licencja, na której udostępniono rekord.",
    "type": "string",
    "constraints": {
     "required": true,
     "enum": [
      "CC0-1.0",
      "CC-BY-4.0",
      "ODbL-1.0"
     ]
    },
    "aed": {
     "grupa": "Jakość i pochodzenie",
     "obowiazkowosc": "O",
     "format": "identyfikator SPDX",
     "przyklad": "CC0-1.0",
     "uzasadnienie": "Zbiór łączy dane na różnych licencjach (CC0, CC BY, ODbL). Licencja na poziomie rekordu pozwala wydzielić część bez share-alike i ogranicza ryzyko z ODbL.",
     "slownik": "licencja_rekordu",
     "osm": "ODbL-1.0",
     "walidacja": "wartość ze słownika"
    }
   },
   {
    "name": "data_aktualizacji_rekordu",
    "title": "Data aktualizacji rekordu",
    "description": "Kiedy rekord ostatnio zmieniono w zbiorze.",
    "type": "datetime",
    "format": "%Y-%m-%dT%H:%M:%S",
    "constraints": {
     "required": true
    },
    "aed": {
     "grupa": "Jakość i pochodzenie",
     "obowiazkowosc": "O",
     "format": "RRRR-MM-DDThh:mm:ss (ISO 8601)",
     "przyklad": "2026-11-21T10:15:00",
     "uzasadnienie": "Pozwala pobierać przyrostowo tylko zmiany. To co innego niż data weryfikacji: zmiana w zbiorze nie oznacza sprawdzenia urządzenia.",
     "slownik": null,
     "osm": "timestamp węzła",
     "walidacja": "data i czas ISO"
    }
   },
   {
    "name": "uwagi",
    "title": "Uwagi",
    "description": "Dodatkowe informacje.",
    "type": "string",
    "constraints": {
     "maxLength": 500
    },
    "aed": {
     "grupa": "Jakość i pochodzenie",
     "obowiazkowosc": "F",
     "format": "maks. 500 znaków",
     "przyklad": "Urządzenie w serwisie do 2026-12-15",
     "uzasadnienie": "Miejsce na wyjątki, których nie da się zapisać w słownikach.",
     "slownik": null,
     "osm": "note=* / description=*",
     "walidacja": "—"
    }
   }
  ],
  "missingValues": [
   ""
  ],
  "primaryKey": "id_aed"
 },
 "slowniki": {
  "status": [
   {
    "kod": "aktywny",
    "etykieta": "Aktywny",
    "opis": "Urządzenie jest na miejscu i sprawne wg dysponenta.",
    "osm": "emergency=defibrillator"
   },
   {
    "kod": "tymczasowo_niedostepny",
    "etykieta": "Tymczasowo niedostępny",
    "opis": "Serwis, kradzież, remont budynku. Wpisz przyczynę w polu uwagi.",
    "osm": "disused:emergency=defibrillator (do weryfikacji)"
   },
   {
    "kod": "wycofany",
    "etykieta": "Wycofany",
    "opis": "Urządzenie usunięte. Rekord zostaje w zbiorze (historia), aby nie wracał z innych źródeł.",
    "osm": "rekord usunięty w OSM"
   },
   {
    "kod": "do_weryfikacji",
    "etykieta": "Do weryfikacji",
    "opis": "Rekord z importu (np. OSM), niepotwierdzony przez dysponenta.",
    "osm": "—"
   }
  ],
  "dostepnosc": [
   {
    "kod": "publiczna_24_7",
    "etykieta": "Publiczna 24/7",
    "opis": "Każdy, o każdej porze, bez pytania kogokolwiek (zwykle kapsuła zewnętrzna).",
    "osm": "access=yes + opening_hours=24/7"
   },
   {
    "kod": "publiczna_w_godzinach",
    "etykieta": "Publiczna w godzinach",
    "opis": "Każdy, ale tylko gdy obiekt jest otwarty. Wymaga pola godziny_dostepnosci.",
    "osm": "access=yes + opening_hours=*"
   },
   {
    "kod": "dla_klientow",
    "etykieta": "Dla klientów / użytkowników obiektu",
    "opis": "Np. za bramkami biletowymi, w strefie dla klientów.",
    "osm": "access=customers"
   },
   {
    "kod": "tylko_personel",
    "etykieta": "Tylko personel / na wezwanie",
    "opis": "Urządzenie wydaje personel (np. ochrona, recepcja).",
    "osm": "access=private"
   },
   {
    "kod": "mobilny",
    "etykieta": "Mobilny (pojazd, patrol)",
    "opis": "AED w pojeździe OSP, policji, straży miejskiej. Współrzędne = baza pojazdu.",
    "osm": "access=private (do weryfikacji)"
   }
  ],
  "sposob_dostepu": [
   {
    "kod": "otwarta_szafka",
    "etykieta": "Otwarta szafka / uchwyt",
    "opis": "Bez zamka i bez alarmu.",
    "osm": "locked=no; defibrillator:cabinet=*"
   },
   {
    "kod": "szafka_z_alarmem",
    "etykieta": "Szafka z alarmem, bez zamka",
    "opis": "Otwarcie uruchamia sygnał dźwiękowy.",
    "osm": "locked=no"
   },
   {
    "kod": "szafka_na_kod",
    "etykieta": "Szafka zamykana na kod",
    "opis": "Kod NIE jest publikowany w zbiorze. Opisz, kto go podaje (instrukcja_dostepu).",
    "osm": "locked=yes"
   },
   {
    "kod": "szafka_na_klucz",
    "etykieta": "Szafka zamykana na klucz",
    "opis": "Opisz, gdzie jest klucz (instrukcja_dostepu).",
    "osm": "locked=yes"
   },
   {
    "kod": "u_personelu",
    "etykieta": "Wydawany przez personel",
    "opis": "Urządzenie nie wisi w miejscu ogólnodostępnym.",
    "osm": "locked=yes (do weryfikacji)"
   },
   {
    "kod": "nieznany",
    "etykieta": "Nieznany",
    "opis": "Brak informacji (typowe dla importu).",
    "osm": "brak tagu locked"
   }
  ],
  "zrodlo_wspolrzednych": [
   {
    "kod": "pomiar_gps",
    "etykieta": "Pomiar GPS na miejscu",
    "opis": "Najdokładniejsze.",
    "osm": "—"
   },
   {
    "kod": "wskazanie_na_mapie",
    "etykieta": "Wskazanie na mapie",
    "opis": "Dysponent zaznaczył punkt w formularzu.",
    "osm": "—"
   },
   {
    "kod": "geokodowanie_adresu",
    "etykieta": "Geokodowanie adresu",
    "opis": "Punkt adresowy, nie miejsce zawieszenia. lokalizacja_przyblizona=true.",
    "osm": "—"
   },
   {
    "kod": "osm",
    "etykieta": "OpenStreetMap",
    "opis": "Współrzędne węzła OSM.",
    "osm": "lat/lon węzła"
   },
   {
    "kod": "nieznane",
    "etykieta": "Nieznane",
    "opis": "Brak informacji.",
    "osm": "—"
   }
  ],
  "cecha_ulicy": [
   {
    "kod": "ul.",
    "etykieta": "ulica",
    "opis": "",
    "osm": "addr:street"
   },
   {
    "kod": "al.",
    "etykieta": "aleja",
    "opis": "",
    "osm": "addr:street"
   },
   {
    "kod": "pl.",
    "etykieta": "plac",
    "opis": "",
    "osm": "addr:street"
   },
   {
    "kod": "os.",
    "etykieta": "osiedle",
    "opis": "",
    "osm": "addr:street"
   },
   {
    "kod": "rondo",
    "etykieta": "rondo",
    "opis": "",
    "osm": "addr:street"
   },
   {
    "kod": "skwer",
    "etykieta": "skwer",
    "opis": "",
    "osm": "addr:street"
   },
   {
    "kod": "bulw.",
    "etykieta": "bulwar",
    "opis": "",
    "osm": "addr:street"
   },
   {
    "kod": "inne",
    "etykieta": "inne",
    "opis": "Zgodnie z rejestrem TERYT ULIC.",
    "osm": "addr:street"
   }
  ],
  "typ_urzadzenia": [
   {
    "kod": "polautomatyczny",
    "etykieta": "AED półautomatyczny",
    "opis": "Użytkownik naciska przycisk wyładowania.",
    "osm": "—"
   },
   {
    "kod": "automatyczny",
    "etykieta": "AED w pełni automatyczny",
    "opis": "Wyładowanie bez przycisku.",
    "osm": "—"
   },
   {
    "kod": "nieznany",
    "etykieta": "Nieznany",
    "opis": "",
    "osm": "—"
   }
  ],
  "dysponent_typ": [
   {
    "kod": "jst",
    "etykieta": "Jednostka samorządu terytorialnego",
    "opis": "Urzędy, jednostki organizacyjne gminy/powiatu/województwa.",
    "osm": "—"
   },
   {
    "kod": "administracja_rzadowa",
    "etykieta": "Administracja rządowa",
    "opis": "",
    "osm": "—"
   },
   {
    "kod": "podmiot_leczniczy",
    "etykieta": "Podmiot leczniczy",
    "opis": "",
    "osm": "healthcare=*"
   },
   {
    "kod": "placowka_oswiatowa",
    "etykieta": "Szkoła / uczelnia",
    "opis": "",
    "osm": "—"
   },
   {
    "kod": "sluzby",
    "etykieta": "Służby (PSP, OSP, Policja, SM)",
    "opis": "",
    "osm": "—"
   },
   {
    "kod": "transport",
    "etykieta": "Transport (kolej, metro, lotnisko)",
    "opis": "",
    "osm": "—"
   },
   {
    "kod": "firma",
    "etykieta": "Przedsiębiorstwo",
    "opis": "",
    "osm": "—"
   },
   {
    "kod": "organizacja_pozarzadowa",
    "etykieta": "Organizacja pozarządowa / fundacja",
    "opis": "",
    "osm": "—"
   },
   {
    "kod": "inny",
    "etykieta": "Inny",
    "opis": "",
    "osm": "—"
   }
  ],
  "sposob_weryfikacji": [
   {
    "kod": "wizja_lokalna",
    "etykieta": "Wizja lokalna",
    "opis": "Ktoś fizycznie sprawdził urządzenie.",
    "osm": "check_date=*"
   },
   {
    "kod": "potwierdzenie_dysponenta",
    "etykieta": "Potwierdzenie dysponenta",
    "opis": "Dysponent potwierdził dane (np. formularzem).",
    "osm": "—"
   },
   {
    "kod": "zdjecie",
    "etykieta": "Zdjęcie z datą",
    "opis": "",
    "osm": "—"
   },
   {
    "kod": "import_bez_weryfikacji",
    "etykieta": "Import bez weryfikacji",
    "opis": "Dane przejęte automatycznie ze źródła zewnętrznego.",
    "osm": "—"
   }
  ],
  "wojewodztwo": [
   {
    "kod": "dolnośląskie",
    "etykieta": "dolnośląskie",
    "opis": "kod TERC 02",
    "osm": "—"
   },
   {
    "kod": "kujawsko-pomorskie",
    "etykieta": "kujawsko-pomorskie",
    "opis": "kod TERC 04",
    "osm": "—"
   },
   {
    "kod": "lubelskie",
    "etykieta": "lubelskie",
    "opis": "kod TERC 06",
    "osm": "—"
   },
   {
    "kod": "lubuskie",
    "etykieta": "lubuskie",
    "opis": "kod TERC 08",
    "osm": "—"
   },
   {
    "kod": "łódzkie",
    "etykieta": "łódzkie",
    "opis": "kod TERC 10",
    "osm": "—"
   },
   {
    "kod": "małopolskie",
    "etykieta": "małopolskie",
    "opis": "kod TERC 12",
    "osm": "—"
   },
   {
    "kod": "mazowieckie",
    "etykieta": "mazowieckie",
    "opis": "kod TERC 14",
    "osm": "—"
   },
   {
    "kod": "opolskie",
    "etykieta": "opolskie",
    "opis": "kod TERC 16",
    "osm": "—"
   },
   {
    "kod": "podkarpackie",
    "etykieta": "podkarpackie",
    "opis": "kod TERC 18",
    "osm": "—"
   },
   {
    "kod": "podlaskie",
    "etykieta": "podlaskie",
    "opis": "kod TERC 20",
    "osm": "—"
   },
   {
    "kod": "pomorskie",
    "etykieta": "pomorskie",
    "opis": "kod TERC 22",
    "osm": "—"
   },
   {
    "kod": "śląskie",
    "etykieta": "śląskie",
    "opis": "kod TERC 24",
    "osm": "—"
   },
   {
    "kod": "świętokrzyskie",
    "etykieta": "świętokrzyskie",
    "opis": "kod TERC 26",
    "osm": "—"
   },
   {
    "kod": "warmińsko-mazurskie",
    "etykieta": "warmińsko-mazurskie",
    "opis": "kod TERC 28",
    "osm": "—"
   },
   {
    "kod": "wielkopolskie",
    "etykieta": "wielkopolskie",
    "opis": "kod TERC 30",
    "osm": "—"
   },
   {
    "kod": "zachodniopomorskie",
    "etykieta": "zachodniopomorskie",
    "opis": "kod TERC 32",
    "osm": "—"
   }
  ],
  "licencja_rekordu": [
   {
    "kod": "CC0-1.0",
    "etykieta": "CC0 1.0",
    "opis": "Domena publiczna. Stosowana m.in. przez UM Krosno i UM Przemyśl na dane.gov.pl.",
    "osm": "—"
   },
   {
    "kod": "CC-BY-4.0",
    "etykieta": "CC BY 4.0",
    "opis": "Uznanie autorstwa. Stosowana m.in. przez UM Marki i UM st. Warszawy.",
    "osm": "—"
   },
   {
    "kod": "ODbL-1.0",
    "etykieta": "ODbL 1.0",
    "opis": "Dane z OpenStreetMap. Share-alike + atrybucja „© OpenStreetMap contributors”.",
    "osm": "licencja OSM"
   }
  ]
 },
 "zrodla": [
  {
   "kod_zrodla": "DGP-3624",
   "nazwa_zrodla": "Defibrylatory zlokalizowane w Mieście Krosno",
   "dysponent": "Urząd Miasta Krosna",
   "typ_zrodla": "zbiór dane.gov.pl",
   "zasieg_terytorialny": "gmina miejska Krosno",
   "url": "https://dane.gov.pl/pl/dataset/3624",
   "format": "CSV, JSON-LD",
   "licencja": "CC0-1.0",
   "czestotliwosc_aktualizacji": "nie dotyczy",
   "pola_dostepne_wg_wzorca": "dlugosc/szerokosc, nazwa, opis_lokalizacji (Lokalizacja), adres, id_lokalne (Numer Id)",
   "glowne_braki": "dostępność, godziny, sposób dostępu, data weryfikacji",
   "problemy_jakosci": "adres w jednym polu (niezgodne ze Standardem technicznym); kolumna Nazwa zawsze „Defibrylator”",
   "priorytet_przy_konflikcie": 1,
   "status_weryfikacji": "zweryfikowano nagłówek CSV 2026-11-21"
  },
  {
   "kod_zrodla": "DGP-4581",
   "nazwa_zrodla": "Lokalizacje AED – Automatycznych Defibrylatorów Zewnętrznych w Przemyślu",
   "dysponent": "Urząd Miejski w Przemyślu",
   "typ_zrodla": "zbiór dane.gov.pl (dane dynamiczne)",
   "zasieg_terytorialny": "gmina miejska Przemyśl",
   "url": "https://dane.gov.pl/pl/dataset/4581",
   "format": "CSV, GeoJSON, JSON, XML (GML)",
   "licencja": "CC0-1.0",
   "czestotliwosc_aktualizacji": "codziennie",
   "pola_dostepne_wg_wzorca": "id_lokalne (id), nazwa (name), miejscowosc (city), ulica (street), numer_budynku (home_number), kod_pocztowy (postcode), telefon (phone), email, współrzędne (geometry)",
   "glowne_braki": "dostępność, godziny, opis dojścia",
   "problemy_jakosci": "CSV rozdzielany średnikiem; współrzędne jako GeoJSON wewnątrz kolumny; numer AED wpisany w nazwę; ogólny opis AED powtórzony w każdym rekordzie",
   "priorytet_przy_konflikcie": 1,
   "status_weryfikacji": "zweryfikowano nagłówek CSV 2026-11-21"
  },
  {
   "kod_zrodla": "DGP-4955",
   "nazwa_zrodla": "Defibrylatory zlokalizowane na terenie Miasta Marki",
   "dysponent": "Urząd Miasta Marki",
   "typ_zrodla": "zbiór dane.gov.pl",
   "zasieg_terytorialny": "gmina miejska Marki",
   "url": "https://dane.gov.pl/pl/dataset/4955",
   "format": "CSV, JSON-LD, XLSX",
   "licencja": "CC-BY-4.0",
   "czestotliwosc_aktualizacji": "jednorazowe udostępnienie",
   "pola_dostepne_wg_wzorca": "współrzędne, nazwa, opis_lokalizacji, adres, id_lokalne",
   "glowne_braki": "dostępność, godziny, sposób dostępu, data weryfikacji",
   "problemy_jakosci": "nagłówek „Długość, Szerokość” a wartości w kolejności szerokość, długość; każdy wiersz CSV ujęty w cudzysłów jako jedno pole",
   "priorytet_przy_konflikcie": 1,
   "status_weryfikacji": "zweryfikowano nagłówek CSV 2026-11-21"
  },
  {
   "kod_zrodla": "DGP-39512",
   "nazwa_zrodla": "Lokalizacja defibrylatorów (AED)",
   "dysponent": "Urząd m.st. Warszawy",
   "typ_zrodla": "zbiór dane.gov.pl (harwestowany z dane.um.warszawa.pl)",
   "zasieg_terytorialny": "m.st. Warszawa",
   "url": "https://dane.gov.pl/pl/dataset/39512",
   "format": "JSON",
   "licencja": "CC-BY-4.0",
   "czestotliwosc_aktualizacji": "codziennie",
   "pola_dostepne_wg_wzorca": "do weryfikacji",
   "glowne_braki": "do weryfikacji",
   "problemy_jakosci": "do weryfikacji (struktura JSON nieprzejrzana)",
   "priorytet_przy_konflikcie": 1,
   "status_weryfikacji": "metadane zweryfikowane przez API 2026-11-21; kolumny do weryfikacji"
  },
  {
   "kod_zrodla": "OSM",
   "nazwa_zrodla": "OpenStreetMap – emergency=defibrillator",
   "dysponent": "społeczność OpenStreetMap",
   "typ_zrodla": "baza crowdsourcingowa (Overpass API)",
   "zasieg_terytorialny": "cała Polska (pokrycie nierówne)",
   "url": "https://www.openstreetmap.org",
   "format": "JSON (Overpass)",
   "licencja": "ODbL-1.0",
   "czestotliwosc_aktualizacji": "ciągła (edycje na bieżąco)",
   "pola_dostepne_wg_wzorca": "współrzędne, opis_lokalizacji (defibrillator:location), wewnatrz_budynku (indoor), kondygnacja (level), dostępność (access), godziny (opening_hours), sposób dostępu (locked), dysponent (operator), telefon, producent, model, data_weryfikacji (check_date)",
   "glowne_braki": "data ważności elektrod i baterii, TERYT",
   "problemy_jakosci": "kompletność tagów zależy od edytującego; brak potwierdzenia dysponenta; licencja share-alike",
   "priorytet_przy_konflikcie": 3,
   "status_weryfikacji": "lista tagów zweryfikowana na wiki OSM 2026-11-21"
  },
  {
   "kod_zrodla": "FORMULARZ",
   "nazwa_zrodla": "Formularz dysponenta (prototyp)",
   "dysponent": "dowolny dysponent",
   "typ_zrodla": "formularz w aplikacji",
   "zasieg_terytorialny": "cała Polska",
   "url": "—",
   "format": "CSV/JSON/XLSX generowany lokalnie",
   "licencja": "wybór dysponenta (domyślnie CC0-1.0)",
   "czestotliwosc_aktualizacji": "na żądanie",
   "pola_dostepne_wg_wzorca": "wszystkie pola wzorca",
   "glowne_braki": "—",
   "problemy_jakosci": "dane wprowadzane ręcznie, walidowane w formularzu",
   "priorytet_przy_konflikcie": 2,
   "status_weryfikacji": "propozycja zespołu"
  },
  {
   "kod_zrodla": "PLIK",
   "nazwa_zrodla": "Plik CSV/XLSX wgrany przez dysponenta",
   "dysponent": "dowolny dysponent",
   "typ_zrodla": "plik lokalny",
   "zasieg_terytorialny": "zależy od dysponenta",
   "url": "—",
   "format": "CSV, XLSX",
   "licencja": "wskazana przy imporcie",
   "czestotliwosc_aktualizacji": "zależy od dysponenta",
   "pola_dostepne_wg_wzorca": "zależy od pliku (mapowanie kolumn w aplikacji)",
   "glowne_braki": "—",
   "problemy_jakosci": "—",
   "priorytet_przy_konflikcie": 1,
   "status_weryfikacji": "propozycja zespołu"
  },
  {
   "kod_zrodla": "PRZYKLAD-PLIK / PRZYKLAD-OSM / PRZYKLAD-FORMULARZ",
   "nazwa_zrodla": "Rekordy przykładowe w tym pliku",
   "dysponent": "—",
   "typ_zrodla": "dane fikcyjne",
   "zasieg_terytorialny": "—",
   "url": "—",
   "format": "—",
   "licencja": "—",
   "czestotliwosc_aktualizacji": "—",
   "pola_dostepne_wg_wzorca": "—",
   "glowne_braki": "—",
   "problemy_jakosci": "usunąć przed publikacją",
   "priorytet_przy_konflikcie": "—",
   "status_weryfikacji": "—"
  }
 ]
};
