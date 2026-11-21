# -*- coding: utf-8 -*-
"""Generator pliku "Wzorcowy zakres danych o defibrylatorach AED" (xlsx + csv).

Uruchomienie:  python generuj_wzorzec.py
Wymaga: openpyxl (MIT).
Jedno źródło prawdy: lista POLA poniżej. Z niej powstaje arkusz danych,
słownik pól, walidacja list rozwijanych i szablon CSV.
"""
import csv
import json
import uuid
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

OUT = Path(__file__).parent
WERSJA = "0.1 (szkic HackNation 2026)"

# --------------------------------------------------------------------------
# Słowniki wartości: kod -> (etykieta, opis, mapowanie OSM)
# --------------------------------------------------------------------------
SLOWNIKI = {
    "status": [
        ("aktywny", "Aktywny", "Urządzenie jest na miejscu i sprawne wg dysponenta.", "emergency=defibrillator"),
        ("tymczasowo_niedostepny", "Tymczasowo niedostępny", "Serwis, kradzież, remont budynku. Wpisz przyczynę w polu uwagi.", "disused:emergency=defibrillator (do weryfikacji)"),
        ("wycofany", "Wycofany", "Urządzenie usunięte. Rekord zostaje w zbiorze (historia), aby nie wracał z innych źródeł.", "rekord usunięty w OSM"),
        ("do_weryfikacji", "Do weryfikacji", "Rekord z importu (np. OSM), niepotwierdzony przez dysponenta.", "—"),
    ],
    "dostepnosc": [
        ("publiczna_24_7", "Publiczna 24/7", "Każdy, o każdej porze, bez pytania kogokolwiek (zwykle kapsuła zewnętrzna).", "access=yes + opening_hours=24/7"),
        ("publiczna_w_godzinach", "Publiczna w godzinach", "Każdy, ale tylko gdy obiekt jest otwarty. Wymaga pola godziny_dostepnosci.", "access=yes + opening_hours=*"),
        ("dla_klientow", "Dla klientów / użytkowników obiektu", "Np. za bramkami biletowymi, w strefie dla klientów.", "access=customers"),
        ("tylko_personel", "Tylko personel / na wezwanie", "Urządzenie wydaje personel (np. ochrona, recepcja).", "access=private"),
        ("mobilny", "Mobilny (pojazd, patrol)", "AED w pojeździe OSP, policji, straży miejskiej. Współrzędne = baza pojazdu.", "access=private (do weryfikacji)"),
    ],
    "sposob_dostepu": [
        ("otwarta_szafka", "Otwarta szafka / uchwyt", "Bez zamka i bez alarmu.", "locked=no; defibrillator:cabinet=*"),
        ("szafka_z_alarmem", "Szafka z alarmem, bez zamka", "Otwarcie uruchamia sygnał dźwiękowy.", "locked=no"),
        ("szafka_na_kod", "Szafka zamykana na kod", "Kod NIE jest publikowany w zbiorze. Opisz, kto go podaje (instrukcja_dostepu).", "locked=yes"),
        ("szafka_na_klucz", "Szafka zamykana na klucz", "Opisz, gdzie jest klucz (instrukcja_dostepu).", "locked=yes"),
        ("u_personelu", "Wydawany przez personel", "Urządzenie nie wisi w miejscu ogólnodostępnym.", "locked=yes (do weryfikacji)"),
        ("nieznany", "Nieznany", "Brak informacji (typowe dla importu).", "brak tagu locked"),
    ],
    "zrodlo_wspolrzednych": [
        ("pomiar_gps", "Pomiar GPS na miejscu", "Najdokładniejsze.", "—"),
        ("wskazanie_na_mapie", "Wskazanie na mapie", "Dysponent zaznaczył punkt w formularzu.", "—"),
        ("geokodowanie_adresu", "Geokodowanie adresu", "Punkt adresowy, nie miejsce zawieszenia. lokalizacja_przyblizona=true.", "—"),
        ("osm", "OpenStreetMap", "Współrzędne węzła OSM.", "lat/lon węzła"),
        ("nieznane", "Nieznane", "Brak informacji.", "—"),
    ],
    "cecha_ulicy": [
        ("ul.", "ulica", "", "addr:street"), ("al.", "aleja", "", "addr:street"),
        ("pl.", "plac", "", "addr:street"), ("os.", "osiedle", "", "addr:street"),
        ("rondo", "rondo", "", "addr:street"), ("skwer", "skwer", "", "addr:street"),
        ("bulw.", "bulwar", "", "addr:street"), ("inne", "inne", "Zgodnie z rejestrem TERYT ULIC.", "addr:street"),
    ],
    "typ_urzadzenia": [
        ("polautomatyczny", "AED półautomatyczny", "Użytkownik naciska przycisk wyładowania.", "—"),
        ("automatyczny", "AED w pełni automatyczny", "Wyładowanie bez przycisku.", "—"),
        ("nieznany", "Nieznany", "", "—"),
    ],
    "dysponent_typ": [
        ("jst", "Jednostka samorządu terytorialnego", "Urzędy, jednostki organizacyjne gminy/powiatu/województwa.", "—"),
        ("administracja_rzadowa", "Administracja rządowa", "", "—"),
        ("podmiot_leczniczy", "Podmiot leczniczy", "", "healthcare=*"),
        ("placowka_oswiatowa", "Szkoła / uczelnia", "", "—"),
        ("sluzby", "Służby (PSP, OSP, Policja, SM)", "", "—"),
        ("transport", "Transport (kolej, metro, lotnisko)", "", "—"),
        ("firma", "Przedsiębiorstwo", "", "—"),
        ("organizacja_pozarzadowa", "Organizacja pozarządowa / fundacja", "", "—"),
        ("inny", "Inny", "", "—"),
    ],
    "sposob_weryfikacji": [
        ("wizja_lokalna", "Wizja lokalna", "Ktoś fizycznie sprawdził urządzenie.", "check_date=*"),
        ("potwierdzenie_dysponenta", "Potwierdzenie dysponenta", "Dysponent potwierdził dane (np. formularzem).", "—"),
        ("zdjecie", "Zdjęcie z datą", "", "—"),
        ("import_bez_weryfikacji", "Import bez weryfikacji", "Dane przejęte automatycznie ze źródła zewnętrznego.", "—"),
    ],
    "wojewodztwo": [
        (n, n, f"kod TERC {k}", "—") for k, n in [
            ("02", "dolnośląskie"), ("04", "kujawsko-pomorskie"), ("06", "lubelskie"), ("08", "lubuskie"),
            ("10", "łódzkie"), ("12", "małopolskie"), ("14", "mazowieckie"), ("16", "opolskie"),
            ("18", "podkarpackie"), ("20", "podlaskie"), ("22", "pomorskie"), ("24", "śląskie"),
            ("26", "świętokrzyskie"), ("28", "warmińsko-mazurskie"), ("30", "wielkopolskie"),
            ("32", "zachodniopomorskie")]
    ],
    "licencja_rekordu": [
        ("CC0-1.0", "CC0 1.0", "Domena publiczna. Stosowana m.in. przez UM Krosno i UM Przemyśl na dane.gov.pl.", "—"),
        ("CC-BY-4.0", "CC BY 4.0", "Uznanie autorstwa. Stosowana m.in. przez UM Marki i UM st. Warszawy.", "—"),
        ("ODbL-1.0", "ODbL 1.0", "Dane z OpenStreetMap. Share-alike + atrybucja „© OpenStreetMap contributors”.", "licencja OSM"),
    ],
}

# --------------------------------------------------------------------------
# Pola wzorca
# obowiazkowosc: O = obowiązkowe, W = warunkowo obowiązkowe, Z = zalecane, F = fakultatywne
# --------------------------------------------------------------------------
POLA = [
    # grupa, pole, etykieta, typ, format, obow, przyklad, opis, uzasadnienie, slownik, osm, walidacja
    ("Identyfikacja", "id_aed", "Identyfikator AED", "tekst", "UUID (RFC 9562), małe litery; nowe rekordy: wersja 4 (losowa)", "O",
     "8f14e45f-ceea-467a-9a3b-2c1d0e5f6a7b",
     "Stały, globalnie unikalny identyfikator urządzenia w zbiorze ogólnopolskim. Nadaje go narzędzie przy pierwszym imporcie; potem się nie zmienia.",
     "Pozwala aktualizować rekord zamiast tworzyć duplikat i łączyć go z innymi zbiorami. UUID nie wymaga centralnego rejestru, więc może go nadać dysponent lub aplikacja w przeglądarce.",
     "", "ref:aed (propozycja, do weryfikacji)", "wzorzec UUID; unikalny w zbiorze"),
    ("Identyfikacja", "id_lokalne", "Identyfikator u dysponenta", "tekst", "dowolny", "Z",
     "AED-9485",
     "Numer inwentarzowy lub ID w systemie dysponenta (np. „Numer Id” w Krośnie, „AED 9485” w Przemyślu).",
     "Dysponent szybko odnajduje swój rekord. Para dysponent + id_lokalne pewnie wykrywa duplikaty przy kolejnych importach.",
     "", "ref=*", "unikalny w obrębie dysponenta"),
    ("Identyfikacja", "nazwa", "Nazwa miejsca", "tekst", "maks. 150 znaków", "O",
     "Szkoła Podstawowa nr 1 – hol główny",
     "Krótka nazwa obiektu, w którym jest AED, rozpoznawalna dla przechodnia.",
     "Świadek zdarzenia szuka budynku, a nie współrzędnych. Nazwa jest też tytułem pinezki w aplikacjach.",
     "", "name=* (obiektu) / description=*", "niepuste; maks. 150 znaków"),
    ("Identyfikacja", "status", "Status urządzenia", "słownik", "kod ze słownika", "O",
     "aktywny",
     "Czy urządzenie jest obecnie dostępne.",
     "Wycofanych rekordów nie kasujemy, tylko oznaczamy. Dzięki temu urządzenie, którego już nie ma, nie „wraca” z OSM przy kolejnym scaleniu.",
     "status", "emergency=defibrillator / disused:*", "wartość ze słownika"),

    ("Lokalizacja", "szerokosc_geograficzna", "Szerokość geograficzna", "liczba dziesiętna", "WGS84 (EPSG:4326), stopnie dziesiętne, kropka, 6 miejsc po przecinku", "O",
     "52.229676",
     "Szerokość geograficzna miejsca zawieszenia AED (nie środka działki).",
     "Bez współrzędnych nie ma nawigacji ani mapy. WGS84 wymaga format GeoJSON (RFC 7946) i używa go GPS oraz OSM. Kropka dziesiętna zgodnie ze Standardem technicznym dane.gov.pl (2020).",
     "", "lat węzła", "49.0–54.9 (granice PL); kontrola zamiany z długością"),
    ("Lokalizacja", "dlugosc_geograficzna", "Długość geograficzna", "liczba dziesiętna", "WGS84 (EPSG:4326), stopnie dziesiętne, kropka, 6 miejsc po przecinku", "O",
     "21.012229",
     "Długość geograficzna miejsca zawieszenia AED.",
     "Jw. W zbiorze z Marek na dane.gov.pl nagłówki mają odwrotną kolejność niż wartości. Walidator musi to wykrywać.",
     "", "lon węzła", "14.1–24.2 (granice PL)"),
    ("Lokalizacja", "lokalizacja_przyblizona", "Lokalizacja przybliżona", "logiczny", "true / false", "O",
     "false",
     "true, gdy punkt wyznaczono z adresu lub „na oko”, a nie w miejscu zawieszenia urządzenia.",
     "Ratownik wie, czy może ufać pinezce, czy musi szukać w budynku. Rekordy przybliżone wskazują też, gdzie potrzebna jest weryfikacja w terenie.",
     "", "— (brak odpowiednika)", "true/false"),
    ("Lokalizacja", "zrodlo_wspolrzednych", "Źródło współrzędnych", "słownik", "kod ze słownika", "Z",
     "pomiar_gps",
     "Jak ustalono współrzędne.",
     "Uzupełnia flagę przybliżenia. Pomaga rozstrzygać konflikty przy scalaniu (pomiar GPS > geokodowanie).",
     "zrodlo_wspolrzednych", "—", "wartość ze słownika"),
    ("Lokalizacja", "kod_terc_gminy", "Kod TERC gminy", "tekst", "7 cyfr WWPPGGR (TERYT)", "Z",
     "1465011",
     "Kod terytorialny gminy z rejestru TERYT GUS (z cyfrą rodzaju gminy).",
     "Pozwala agregować dane po gminach, powiatach i województwach oraz łączyć je z innymi zbiorami publicznymi. Standard techniczny dane.gov.pl wskazuje TERYT jako miejsce publikacji danych adresowych.",
     "", "— (pochodna z granic administracyjnych)", "7 cyfr; tekst, z zerem wiodącym"),
    ("Lokalizacja", "wojewodztwo", "Województwo", "słownik", "nazwa małymi literami", "Z",
     "mazowieckie",
     "Nazwa województwa.",
     "Ułatwia filtrowanie bez znajomości kodów. Można ją wyliczyć z kod_terc_gminy (pierwsze 2 cyfry).",
     "wojewodztwo", "—", "jedna z 16 nazw"),
    ("Lokalizacja", "miejscowosc", "Miejscowość", "tekst", "jak w TERYT SIMC", "O",
     "Warszawa",
     "Nazwa miejscowości.",
     "Standard techniczny dane.gov.pl wymaga adresu w odrębnych polach (ulica, numer, kod, miejscowość), a nie w jednym polu tekstowym.",
     "", "addr:city / addr:place", "niepuste"),
    ("Lokalizacja", "kod_simc", "Identyfikator miejscowości SIMC", "tekst", "7 cyfr", "F",
     "0918123",
     "Identyfikator miejscowości z TERYT SIMC.",
     "Jednoznaczny i niezmienny. Rozwiązuje problem powtarzalnych nazw miejscowości (np. wiele miejscowości „Zalesie”).",
     "", "—", "7 cyfr"),
    ("Lokalizacja", "cecha_ulicy", "Cecha ulicy", "słownik", "kod ze słownika", "W",
     "ul.",
     "Typ ulicy: ul., al., pl. itd. Obowiązkowe, jeśli wypełniono pole ulica.",
     "Rozdzielenie cechy od nazwy wzorujemy na tabeli 4 Standardu technicznego dane.gov.pl.",
     "cecha_ulicy", "część addr:street", "wymagane gdy ulica niepusta"),
    ("Lokalizacja", "ulica", "Nazwa ulicy", "tekst", "bez cechy, jak w TERYT ULIC", "W",
     "Marszałkowska",
     "Nazwa ulicy. Puste w miejscowościach bez nazw ulic.",
     "Jw. Część małych miejscowości nie ma ulic, więc pole jest warunkowe.",
     "", "addr:street", "—"),
    ("Lokalizacja", "kod_ulic", "Identyfikator ulicy ULIC", "tekst", "5 cyfr", "F",
     "12345",
     "Identyfikator ulicy z TERYT ULIC.",
     "Jednoznaczny klucz do rejestru adresów; ułatwia geokodowanie i deduplikację.",
     "", "—", "5 cyfr"),
    ("Lokalizacja", "numer_budynku", "Numer budynku", "tekst", "np. 5A, 12/14", "W",
     "100",
     "Numer porządkowy budynku. Obowiązkowe, jeśli budynek ma numer.",
     "Potrzebny do nawigacji i porównywania adresów przy deduplikacji. Typ tekstowy, bo numery zawierają litery.",
     "", "addr:housenumber", "—"),
    ("Lokalizacja", "kod_pocztowy", "Kod pocztowy", "tekst", "NN-NNN", "Z",
     "00-001",
     "Kod pocztowy (PNA).",
     "Standardowy element adresu pocztowego (Standard techniczny, tabela 4).",
     "", "addr:postcode", "wzorzec \\d{2}-\\d{3}"),
    ("Lokalizacja", "opis_lokalizacji", "Opis dojścia / miejsca", "tekst", "maks. 300 znaków", "O",
     "Hol główny, na lewo od wejścia, obok recepcji",
     "Gdzie dokładnie wisi AED w obiekcie lub na budynku.",
     "Najważniejsza informacja w pierwszych minutach. Współrzędne nie powiedzą, za którymi drzwiami szukać.",
     "", "defibrillator:location=*", "niepuste"),
    ("Lokalizacja", "opis_lokalizacji_en", "Opis dojścia (EN)", "tekst", "maks. 300 znaków", "F",
     "Main hall, left of the entrance, next to the reception",
     "Opis dojścia po angielsku.",
     "Turyści i obcokrajowcy. OSM ma odpowiednik defibrillator:location:en.",
     "", "defibrillator:location:en=*", "—"),
    ("Lokalizacja", "wewnatrz_budynku", "Wewnątrz budynku", "logiczny", "true / false", "Z",
     "true",
     "true: wewnątrz budynku; false: na zewnątrz (np. kapsuła na elewacji).",
     "AED na zewnątrz jest zwykle dostępny całą dobę; wewnątrz zależy od godzin otwarcia.",
     "", "indoor=yes/no", "true/false"),
    ("Lokalizacja", "kondygnacja", "Kondygnacja", "liczba całkowita", "0 = parter, -1 = piwnica", "F",
     "0",
     "Numer piętra, na którym jest urządzenie.",
     "W wielopiętrowych budynkach (galerie, dworce) oszczędza czas.",
     "", "level=*", "liczba całkowita od -5 do 100"),

    ("Dostępność", "dostepnosc", "Dostępność", "słownik", "kod ze słownika", "O",
     "publiczna_w_godzinach",
     "Kto i kiedy może skorzystać z urządzenia.",
     "To sedno lekcji z opisu zadania: AED był w kilku miejscach, ale zamknięty. Ratownik musi wiedzieć to z góry.",
     "dostepnosc", "access=*", "wartość ze słownika"),
    ("Dostępność", "godziny_dostepnosci", "Godziny dostępności", "tekst", "składnia OSM opening_hours, np. Mo-Fr 07:00-17:00; Sa 08:00-14:00 lub 24/7", "W",
     "Mo-Fr 07:00-17:00",
     "Godziny, w których urządzenie jest dostępne. Obowiązkowe, gdy dostepnosc = publiczna_w_godzinach lub dla_klientow.",
     "Składnia OSM jest maszynowo czytelna (są do niej otwarte parsery). Aplikacja może więc pokazać „dostępny teraz”. Zwykły tekst („w godzinach pracy”) na to nie pozwala.",
     "", "opening_hours=*", "poprawna składnia opening_hours"),
    ("Dostępność", "sposob_dostepu", "Sposób dostępu / zabezpieczenie", "słownik", "kod ze słownika", "O",
     "szafka_z_alarmem",
     "Czy urządzenie jest zamknięte i w jaki sposób.",
     "Szafka na klucz bez informacji, gdzie jest klucz, oznacza w praktyce brak AED.",
     "sposob_dostepu", "locked=* + defibrillator:cabinet=*", "wartość ze słownika"),
    ("Dostępność", "instrukcja_dostepu", "Instrukcja dostępu", "tekst", "maks. 300 znaków", "W",
     "Klucz w portierni (całodobowo)",
     "Gdzie jest klucz lub kto podaje kod. Obowiązkowe, gdy sposob_dostepu = szafka_na_kod lub szafka_na_klucz. NIE wpisujemy samego kodu.",
     "Uzupełnia sposób dostępu. Publikowanie kodu w otwartych danych byłoby ryzykiem kradzieży (Standard bezpieczeństwa).",
     "", "description=* (brak dedykowanego klucza)", "nie zawiera ciągu wyglądającego na kod (np. 4–8 cyfr)"),

    ("Urządzenie", "typ_urzadzenia", "Typ urządzenia", "słownik", "kod ze słownika", "F",
     "polautomatyczny",
     "AED półautomatyczny lub automatyczny.",
     "Pomocne dla dyspozytora prowadzącego świadka przez telefon.",
     "typ_urzadzenia", "—", "wartość ze słownika"),
    ("Urządzenie", "producent", "Producent", "tekst", "", "F",
     "Producent X",
     "Producent urządzenia.",
     "Komunikaty bezpieczeństwa (wycofania z rynku) dotyczą konkretnych producentów i modeli.",
     "", "manufacturer=*", "—"),
    ("Urządzenie", "model", "Model", "tekst", "", "F",
     "Model Y",
     "Model urządzenia.",
     "Jw. Dyspozytor może też podać instrukcję obsługi dla danego modelu.",
     "", "model=*", "—"),
    ("Urządzenie", "tryb_pediatryczny", "Tryb / elektrody pediatryczne", "logiczny", "true / false", "F",
     "true",
     "Czy na miejscu są elektrody lub klucz pediatryczny.",
     "Przy NZK u dziecka pozwala wybrać właściwe urządzenie (szkoły, przedszkola, baseny).",
     "", "— (propozycja: defibrillator:pediatric, do weryfikacji)", "true/false"),
    ("Urządzenie", "data_waznosci_elektrod", "Ważność elektrod", "data", "RRRR-MM-DD (ISO 8601)", "Z",
     "2027-06-30",
     "Data ważności założonych elektrod.",
     "Elektrody po terminie mogą nie działać. Pole odpowiada na pytanie z zadania „czy działa” i pozwala przypominać dysponentom o wymianie.",
     "", "—", "data ISO; ostrzeżenie, gdy w przeszłości"),
    ("Urządzenie", "data_waznosci_baterii", "Ważność baterii", "data", "RRRR-MM-DD (ISO 8601)", "Z",
     "2029-01-31",
     "Data ważności lub wymiany baterii.",
     "Jw.",
     "", "—", "data ISO; ostrzeżenie, gdy w przeszłości"),
    ("Urządzenie", "data_przegladu", "Data ostatniego przeglądu", "data", "RRRR-MM-DD (ISO 8601)", "Z",
     "2026-09-15",
     "Data ostatniego przeglądu technicznego (serwisu).",
     "Pokazuje, czy urządzenie jest utrzymywane.",
     "", "—", "data ISO; nie w przyszłości"),

    ("Dysponent", "dysponent_nazwa", "Dysponent (nazwa)", "tekst", "pełna nazwa instytucji", "O",
     "Urząd Dzielnicy Śródmieście m.st. Warszawy",
     "Podmiot odpowiedzialny za urządzenie i aktualność danych.",
     "Wiadomo, kogo pytać o poprawki. Grupowanie po dysponencie służy do kampanii zachęcającej do publikacji.",
     "", "operator=*", "niepuste"),
    ("Dysponent", "dysponent_typ", "Typ dysponenta", "słownik", "kod ze słownika", "Z",
     "jst",
     "Kategoria podmiotu.",
     "Analiza pokrycia (np. ile AED mają szkoły) i kierowanie kampanii do grup dysponentów.",
     "dysponent_typ", "—", "wartość ze słownika"),
    ("Dysponent", "dysponent_regon", "REGON dysponenta", "tekst", "9 lub 14 cyfr, bez spacji", "F",
     "012345678",
     "REGON instytucji. Nie podawać dla osób fizycznych prowadzących działalność.",
     "Jednoznacznie identyfikuje podmiot (format wg Standardu technicznego dane.gov.pl). Wyłączenie osób fizycznych ogranicza ryzyko RODO.",
     "", "—", "9 lub 14 cyfr"),
    ("Dysponent", "telefon_kontaktowy", "Telefon kontaktowy", "tekst", "9 cyfr bez spacji lub +48 i 9 cyfr", "F",
     "225970927",
     "Telefon instytucji (portiernia, recepcja). Nie numer prywatny.",
     "Pozwala zadzwonić po klucz lub zgłosić usterkę. Format wg Standardu technicznego dane.gov.pl.",
     "", "phone=*", "wzorzec (\\+48)?\\d{9}"),
    ("Dysponent", "email_kontaktowy", "E-mail kontaktowy", "tekst", "adres funkcyjny", "F",
     "sekretariat@przyklad.gov.pl",
     "Funkcyjny adres e-mail instytucji do zgłaszania zmian. Nie adres imienny.",
     "Kanał na zgłoszenia błędów w danych. Adres funkcyjny ogranicza ryzyko RODO.",
     "", "email=*", "poprawny e-mail"),

    ("Jakość i pochodzenie", "data_weryfikacji", "Data weryfikacji", "data", "RRRR-MM-DD (ISO 8601)", "O",
     "2026-11-20",
     "Kiedy ostatnio potwierdzono, że urządzenie jest na miejscu i działa.",
     "Najważniejsza miara aktualności. Pozwala odróżnić dane świeże od zalegających od lat i ustalić, który rekord wygrywa przy scalaniu.",
     "", "check_date=*", "data ISO; nie w przyszłości; ostrzeżenie, gdy > 12 mies."),
    ("Jakość i pochodzenie", "sposob_weryfikacji", "Sposób weryfikacji", "słownik", "kod ze słownika", "Z",
     "wizja_lokalna",
     "Jak potwierdzono dane.",
     "Wizja lokalna jest pewniejsza niż import. Pole wspiera ocenę jakości.",
     "sposob_weryfikacji", "—", "wartość ze słownika"),
    ("Jakość i pochodzenie", "zrodlo_danych", "Źródło danych (kod)", "tekst", "kod z arkusza zakres_referencyjny_zrodel", "O",
     "DGP-4581",
     "Kod źródła, z którego pochodzi rekord. Rekordy scalone z wielu źródeł mają tu źródło nadrzędne, a pełną listę w tabeli zrodla_rekordu.",
     "Wymóg zadania: oznaczenie źródła każdego rekordu i wskazanie zakresu referencyjnego źródeł.",
     "", "— (stała „OSM”)", "kod istnieje w rejestrze źródeł"),
    ("Jakość i pochodzenie", "zrodlo_id_rekordu", "ID rekordu w źródle", "tekst", "np. node/123456789", "Z",
     "node/123456789",
     "Identyfikator rekordu w systemie źródłowym.",
     "Pozwala wrócić do źródła i zsynchronizować zmiany (np. edycje w OSM).",
     "", "typ/id obiektu OSM", "—"),
    ("Jakość i pochodzenie", "licencja_rekordu", "Licencja rekordu", "słownik", "identyfikator SPDX", "O",
     "CC0-1.0",
     "Licencja, na której udostępniono rekord.",
     "Zbiór łączy dane na różnych licencjach (CC0, CC BY, ODbL). Licencja na poziomie rekordu pozwala wydzielić część bez share-alike i ogranicza ryzyko z ODbL.",
     "licencja_rekordu", "ODbL-1.0", "wartość ze słownika"),
    ("Jakość i pochodzenie", "data_aktualizacji_rekordu", "Data aktualizacji rekordu", "data i czas", "RRRR-MM-DDThh:mm:ss (ISO 8601)", "O",
     "2026-11-21T10:15:00",
     "Kiedy rekord ostatnio zmieniono w zbiorze.",
     "Pozwala pobierać przyrostowo tylko zmiany. To co innego niż data weryfikacji: zmiana w zbiorze nie oznacza sprawdzenia urządzenia.",
     "", "timestamp węzła", "data i czas ISO"),
    ("Jakość i pochodzenie", "uwagi", "Uwagi", "tekst", "maks. 500 znaków", "F",
     "Urządzenie w serwisie do 2026-12-15",
     "Dodatkowe informacje.",
     "Miejsce na wyjątki, których nie da się zapisać w słownikach.",
     "", "note=* / description=*", "—"),
]

NAGLOWKI = [p[1] for p in POLA]

# --------------------------------------------------------------------------
# Rekordy przykładowe (FIKCYJNE – ilustrują format, nie są danymi o realnych AED)
# --------------------------------------------------------------------------
NS = uuid.UUID("6f1c2a64-0000-4000-8000-000000000aed")
def uid(n):
    return str(uuid.uuid5(NS, f"przyklad-{n}"))

PRZYKLADY = [
    dict(id_aed=uid(1), id_lokalne="AED-001", nazwa="Przykładowa stacja metra – wejście A",
         status="aktywny", szerokosc_geograficzna=52.229676, dlugosc_geograficzna=21.012229,
         lokalizacja_przyblizona="false", zrodlo_wspolrzednych="pomiar_gps", kod_terc_gminy="1465011",
         wojewodztwo="mazowieckie", miejscowosc="Warszawa", kod_simc="0918123", cecha_ulicy="ul.",
         ulica="Przykładowa", numer_budynku="1", kod_pocztowy="00-001",
         opis_lokalizacji="Kapsuła na ścianie przy wejściu A, poziom ulicy", opis_lokalizacji_en="Cabinet on the wall at entrance A, street level",
         wewnatrz_budynku="false", kondygnacja=0, dostepnosc="publiczna_24_7", godziny_dostepnosci="24/7",
         sposob_dostepu="szafka_z_alarmem", typ_urzadzenia="polautomatyczny", tryb_pediatryczny="true",
         data_waznosci_elektrod="2027-06-30", data_waznosci_baterii="2029-01-31", data_przegladu="2026-09-15",
         dysponent_nazwa="Przykładowy Operator Metra Sp. z o.o.", dysponent_typ="transport",
         telefon_kontaktowy="220000000", email_kontaktowy="dyzurny@przyklad.pl",
         data_weryfikacji="2026-11-20", sposob_weryfikacji="wizja_lokalna", zrodlo_danych="PRZYKLAD-PLIK",
         zrodlo_id_rekordu="AED-001", licencja_rekordu="CC0-1.0", data_aktualizacji_rekordu="2026-11-21T10:15:00",
         uwagi="Rekord przykładowy – dane fikcyjne"),
    dict(id_aed=uid(2), id_lokalne="SP1/1", nazwa="Szkoła Podstawowa nr 1 (przykład) – hol główny",
         status="aktywny", szerokosc_geograficzna=50.061430, dlugosc_geograficzna=19.936580,
         lokalizacja_przyblizona="false", zrodlo_wspolrzednych="wskazanie_na_mapie", kod_terc_gminy="1261011",
         wojewodztwo="małopolskie", miejscowosc="Kraków", cecha_ulicy="ul.", ulica="Szkolna", numer_budynku="5A",
         kod_pocztowy="30-001", opis_lokalizacji="Hol główny, na lewo od wejścia, obok portierni",
         wewnatrz_budynku="true", kondygnacja=0, dostepnosc="publiczna_w_godzinach",
         godziny_dostepnosci="Mo-Fr 07:00-17:00", sposob_dostepu="otwarta_szafka", typ_urzadzenia="automatyczny",
         tryb_pediatryczny="true", data_waznosci_elektrod="2026-12-31", data_przegladu="2026-03-01",
         dysponent_nazwa="Szkoła Podstawowa nr 1 (przykład)", dysponent_typ="placowka_oswiatowa",
         telefon_kontaktowy="120000000", email_kontaktowy="sekretariat@sp1.przyklad.pl",
         data_weryfikacji="2026-10-01", sposob_weryfikacji="potwierdzenie_dysponenta", zrodlo_danych="PRZYKLAD-FORMULARZ",
         licencja_rekordu="CC0-1.0", data_aktualizacji_rekordu="2026-10-01T12:00:00",
         uwagi="Rekord przykładowy – dane fikcyjne"),
    dict(id_aed=uid(3), nazwa="Centrum handlowe (przykład) – poziom 1",
         status="aktywny", szerokosc_geograficzna=54.352050, dlugosc_geograficzna=18.646640,
         lokalizacja_przyblizona="false", zrodlo_wspolrzednych="pomiar_gps", kod_terc_gminy="2261011",
         wojewodztwo="pomorskie", miejscowosc="Gdańsk", cecha_ulicy="al.", ulica="Przykładowa", numer_budynku="10",
         kod_pocztowy="80-001", opis_lokalizacji="Poziom 1, przy toaletach obok punktu informacji",
         wewnatrz_budynku="true", kondygnacja=1, dostepnosc="dla_klientow",
         godziny_dostepnosci="Mo-Sa 09:00-21:00; Su 10:00-20:00", sposob_dostepu="u_personelu",
         dysponent_nazwa="Przykład Centrum Handlowe S.A.", dysponent_typ="firma",
         data_weryfikacji="2026-06-10", sposob_weryfikacji="zdjecie", zrodlo_danych="PRZYKLAD-PLIK",
         licencja_rekordu="CC-BY-4.0", data_aktualizacji_rekordu="2026-06-10T09:00:00",
         uwagi="Rekord przykładowy – dane fikcyjne"),
    dict(id_aed=uid(4), nazwa="Urząd miasta (przykład)",
         status="do_weryfikacji", szerokosc_geograficzna=49.782100, dlugosc_geograficzna=22.773500,
         lokalizacja_przyblizona="false", zrodlo_wspolrzednych="osm",
         wojewodztwo="podkarpackie", miejscowosc="Przemyśl",
         opis_lokalizacji="Parter, przy wejściu głównym (opis z OSM)",
         wewnatrz_budynku="true", dostepnosc="publiczna_w_godzinach", godziny_dostepnosci="Mo-Fr 07:30-15:30",
         sposob_dostepu="nieznany", dysponent_nazwa="Urząd miasta (przykład)",
         data_weryfikacji="2025-04-02", sposob_weryfikacji="import_bez_weryfikacji", zrodlo_danych="PRZYKLAD-OSM",
         zrodlo_id_rekordu="node/0000000001", licencja_rekordu="ODbL-1.0", data_aktualizacji_rekordu="2026-11-21T08:00:00",
         uwagi="Rekord przykładowy – dane fikcyjne; import z OSM bez numeru budynku"),
    dict(id_aed=uid(5), nazwa="Remiza OSP (przykład)",
         status="aktywny", szerokosc_geograficzna=51.100000, dlugosc_geograficzna=17.030000,
         lokalizacja_przyblizona="true", zrodlo_wspolrzednych="geokodowanie_adresu",
         wojewodztwo="dolnośląskie", miejscowosc="Przykładowo", numer_budynku="12",
         opis_lokalizacji="Szafka na ścianie remizy od strony drogi",
         wewnatrz_budynku="false", dostepnosc="publiczna_24_7", godziny_dostepnosci="24/7",
         sposob_dostepu="szafka_na_klucz",
         instrukcja_dostepu="Klucz w sklepie obok (Mo-Sa 06:00-20:00) i u sołtysa pod nr 12",
         dysponent_nazwa="Ochotnicza Straż Pożarna (przykład)", dysponent_typ="sluzby",
         data_weryfikacji="2024-05-20", sposob_weryfikacji="potwierdzenie_dysponenta", zrodlo_danych="PRZYKLAD-FORMULARZ",
         licencja_rekordu="CC0-1.0", data_aktualizacji_rekordu="2026-11-21T08:00:00",
         uwagi="Rekord przykładowy – dane fikcyjne; miejscowość bez nazw ulic"),
]

# --------------------------------------------------------------------------
# Zakres referencyjny źródeł – fakty zweryfikowane 2026-11-21 przez API dane.gov.pl
# --------------------------------------------------------------------------
ZRODLA_NAGL = ["kod_zrodla", "nazwa_zrodla", "dysponent", "typ_zrodla", "zasieg_terytorialny", "url",
               "format", "licencja", "czestotliwosc_aktualizacji", "pola_dostepne_wg_wzorca",
               "glowne_braki", "problemy_jakosci", "priorytet_przy_konflikcie", "status_weryfikacji"]
ZRODLA = [
    ["DGP-3624", "Defibrylatory zlokalizowane w Mieście Krosno", "Urząd Miasta Krosna", "zbiór dane.gov.pl",
     "gmina miejska Krosno", "https://dane.gov.pl/pl/dataset/3624", "CSV, JSON-LD", "CC0-1.0", "nie dotyczy",
     "dlugosc/szerokosc, nazwa, opis_lokalizacji (Lokalizacja), adres, id_lokalne (Numer Id)",
     "dostępność, godziny, sposób dostępu, data weryfikacji",
     "adres w jednym polu (niezgodne ze Standardem technicznym); kolumna Nazwa zawsze „Defibrylator”",
     1, "zweryfikowano nagłówek CSV 2026-11-21"],
    ["DGP-4581", "Lokalizacje AED – Automatycznych Defibrylatorów Zewnętrznych w Przemyślu", "Urząd Miejski w Przemyślu",
     "zbiór dane.gov.pl (dane dynamiczne)", "gmina miejska Przemyśl", "https://dane.gov.pl/pl/dataset/4581",
     "CSV, GeoJSON, JSON, XML (GML)", "CC0-1.0", "codziennie",
     "id_lokalne (id), nazwa (name), miejscowosc (city), ulica (street), numer_budynku (home_number), kod_pocztowy (postcode), telefon (phone), email, współrzędne (geometry)",
     "dostępność, godziny, opis dojścia",
     "CSV rozdzielany średnikiem; współrzędne jako GeoJSON wewnątrz kolumny; numer AED wpisany w nazwę; ogólny opis AED powtórzony w każdym rekordzie",
     1, "zweryfikowano nagłówek CSV 2026-11-21"],
    ["DGP-4955", "Defibrylatory zlokalizowane na terenie Miasta Marki", "Urząd Miasta Marki", "zbiór dane.gov.pl",
     "gmina miejska Marki", "https://dane.gov.pl/pl/dataset/4955", "CSV, JSON-LD, XLSX", "CC-BY-4.0",
     "jednorazowe udostępnienie",
     "współrzędne, nazwa, opis_lokalizacji, adres, id_lokalne",
     "dostępność, godziny, sposób dostępu, data weryfikacji",
     "nagłówek „Długość, Szerokość” a wartości w kolejności szerokość, długość; każdy wiersz CSV ujęty w cudzysłów jako jedno pole",
     1, "zweryfikowano nagłówek CSV 2026-11-21"],
    ["DGP-39512", "Lokalizacja defibrylatorów (AED)", "Urząd m.st. Warszawy", "zbiór dane.gov.pl (harwestowany z dane.um.warszawa.pl)",
     "m.st. Warszawa", "https://dane.gov.pl/pl/dataset/39512", "JSON", "CC-BY-4.0", "codziennie",
     "do weryfikacji", "do weryfikacji", "do weryfikacji (struktura JSON nieprzejrzana)", 1,
     "metadane zweryfikowane przez API 2026-11-21; kolumny do weryfikacji"],
    ["OSM", "OpenStreetMap – emergency=defibrillator", "społeczność OpenStreetMap", "baza crowdsourcingowa (Overpass API)",
     "cała Polska (pokrycie nierówne)", "https://www.openstreetmap.org", "JSON (Overpass)", "ODbL-1.0", "ciągła (edycje na bieżąco)",
     "współrzędne, opis_lokalizacji (defibrillator:location), wewnatrz_budynku (indoor), kondygnacja (level), dostępność (access), godziny (opening_hours), sposób dostępu (locked), dysponent (operator), telefon, producent, model, data_weryfikacji (check_date)",
     "data ważności elektrod i baterii, TERYT",
     "kompletność tagów zależy od edytującego; brak potwierdzenia dysponenta; licencja share-alike",
     3, "lista tagów zweryfikowana na wiki OSM 2026-11-21"],
    ["FORMULARZ", "Formularz dysponenta (prototyp)", "dowolny dysponent", "formularz w aplikacji",
     "cała Polska", "—", "CSV/JSON/XLSX generowany lokalnie", "wybór dysponenta (domyślnie CC0-1.0)", "na żądanie",
     "wszystkie pola wzorca", "—", "dane wprowadzane ręcznie, walidowane w formularzu", 2, "propozycja zespołu"],
    ["PLIK", "Plik CSV/XLSX wgrany przez dysponenta", "dowolny dysponent", "plik lokalny",
     "zależy od dysponenta", "—", "CSV, XLSX", "wskazana przy imporcie", "zależy od dysponenta",
     "zależy od pliku (mapowanie kolumn w aplikacji)", "—", "—", 1, "propozycja zespołu"],
    ["PRZYKLAD-PLIK / PRZYKLAD-OSM / PRZYKLAD-FORMULARZ", "Rekordy przykładowe w tym pliku", "—", "dane fikcyjne",
     "—", "—", "—", "—", "—", "—", "—", "usunąć przed publikacją", "—", "—"],
]

ZR_REK_NAGL = ["id_aed", "zrodlo_danych", "zrodlo_id_rekordu", "licencja_rekordu", "data_pobrania", "rola_w_scaleniu"]
ZR_REK = [
    [uid(4), "PRZYKLAD-OSM", "node/0000000001", "ODbL-1.0", "2026-11-21", "nadrzedne"],
    [uid(1), "PRZYKLAD-PLIK", "AED-001", "CC0-1.0", "2026-11-21", "nadrzedne"],
    [uid(1), "PRZYKLAD-OSM", "node/0000000002", "ODbL-1.0", "2026-11-21", "duplikat_scalony"],
]

METADANE = [
    ("Tytuł zbioru", "Defibrylatory AED w Polsce – zbiór zintegrowany", "propozycja"),
    ("Opis", "Ogólnopolski zbiór lokalizacji automatycznych defibrylatorów zewnętrznych (AED) z informacją o dostępności, sposobie dostępu i aktualności danych. Zbiór łączy dane dysponentów opublikowane według wzorcowego zakresu, dane z formularza oraz (w osobnym zasobie) dane OpenStreetMap.", "propozycja"),
    ("Kategoria", "Zdrowie", "kategoria istnieje w API dane.gov.pl (id 147) – zweryfikowano 2026-11-21"),
    ("Słowa kluczowe", "AED; defibrylator; NZK; pierwsza pomoc; ratownictwo; zdrowie; wzorzec-aed", "propozycja; wspólne słowo kluczowe „wzorzec-aed” pozwala wyszukać wszystkie zbiory dysponentów przez API"),
    ("Częstotliwość aktualizacji", "codziennie", "wartość występuje w API dane.gov.pl; lista dozwolonych wartości do weryfikacji"),
    ("Dane dynamiczne", "tak", "atrybut has_dynamic_data istnieje w API (np. zbiór 4581); znaczenie do weryfikacji"),
    ("Licencja zasobu podstawowego", "CC0 1.0 lub CC BY 4.0 (rekordy dysponentów)", "obie licencje stosują już dysponenci AED na dane.gov.pl; wybór ostateczny do weryfikacji z MC"),
    ("Licencja zasobu z OSM", "ODbL 1.0 + atrybucja „© OpenStreetMap contributors”", "wymóg licencji OSM; zgodność z zasadami portalu do weryfikacji"),
    ("Formaty zasobów", "CSV (RFC 4180, UTF-8, przecinek), JSON, XLSX, GeoJSON", "CSV i JSON na 3. poziomie otwartości wg Standardu technicznego dane.gov.pl (2020)"),
    ("Nazwy plików dysponentów", "aed_<kod_terc_gminy>_<RRRR-MM-DD>.csv", "propozycja"),
    ("Tytuł zbioru dysponenta", "Defibrylatory AED – <nazwa dysponenta / gminy>", "propozycja: jednolite tytuły ułatwiają wyszukiwanie"),
    ("Schemat danych", "Ten plik (wzorcowy zakres danych AED), wersja " + WERSJA, "propozycja: dołączać jako zasób „dokumentacja” do zbioru"),
]

INFO = [
    ("Wzorcowy zakres danych o defibrylatorach AED", ""),
    ("Wersja", WERSJA),
    ("Cel", "Jednolity format, w którym każdy dysponent AED (gmina, szkoła, firma, fundacja) publikuje dane w portalu dane.gov.pl. Dzięki niemu dane z wielu źródeł można automatycznie połączyć w jeden ogólnopolski zbiór."),
    ("Arkusze", "dane_aed – szablon do wypełnienia (1 wiersz nagłówka, 1 wiersz = 1 urządzenie; przykładowe wiersze są FIKCYJNE); slownik_pol – opis pól; slowniki_wartosci – dozwolone kody; mapowanie_osm – odpowiedniki tagów OpenStreetMap; zakres_referencyjny_zrodel – rejestr źródeł danych; zrodla_rekordu – tabela pochodzenia rekordów scalonych; metadane_zbioru – proponowane metadane zbioru w dane.gov.pl"),
    ("Obowiązkowość", "O – obowiązkowe; W – obowiązkowe warunkowo (warunek w opisie pola); Z – zalecane; F – fakultatywne. Minimum dla dysponenta to " + str(sum(1 for p in POLA if p[5] == "O")) + " pól O."),
    ("Formaty wartości", "Na podstawie Standardu technicznego dane.gov.pl (2020): daty RRRR-MM-DD, data i czas RRRR-MM-DDThh:mm:ss, kropka dziesiętna bez separatorów tysięcy, wartości logiczne true/false, telefon jako 9 cyfr, adres w odrębnych polach, CSV wg RFC 4180 (UTF-8, przecinek, jeden wiersz nagłówka, bez pustych kolumn i wierszy)."),
    ("Współrzędne", "WGS84 (EPSG:4326), stopnie dziesiętne, 6 miejsc po przecinku (ok. 0,1 m). Standard techniczny nie narzuca układu współrzędnych; WGS84 wybrano ze względu na GeoJSON (RFC 7946), GPS i OSM."),
    ("Deduplikacja", "Duplikat to: (a) ten sam dysponent i id_lokalne; albo (b) odległość ≤ 15 m; albo (c) odległość ≤ 50 m i podobieństwo znormalizowanego adresu (ulica + numer) lub nazwy ≥ 0,8. Pola scalonego rekordu biorą wartość z rekordu z najnowszą data_weryfikacji, a przy remisie ze źródła o wyższym priorytecie (1 = najwyższy). Wszystkie źródła trafiają do tabeli zrodla_rekordu. Progi do kalibracji na danych testowych."),
    ("Bezpieczeństwo i RODO", "Nie publikujemy kodów do szafek, imiennych adresów e-mail, prywatnych telefonów ani numerów seryjnych urządzeń. Kontakt wyłącznie instytucjonalny."),
    ("Rekordy przykładowe", "Wiersze w arkuszu dane_aed są FIKCYJNE i ilustrują tylko format (zrodlo_danych = PRZYKLAD-*). Przed publikacją należy je usunąć."),
    ("Źródła wymagań", "Standard techniczny dane.gov.pl 2020: https://dane.gov.pl/pl/knowledgebase/useful-materials/standardy-otwartosci-danych ; wiki OSM: https://wiki.openstreetmap.org/wiki/Tag:emergency%3Ddefibrillator ; API dane.gov.pl: https://api.dane.gov.pl/1.4/datasets?q=defibrylator"),
]

# --------------------------------------------------------------------------
# Mapowanie OSM -> wzorzec (import) i wzorzec -> OSM
# --------------------------------------------------------------------------
OSM_NAGL = ["klucz_osm", "przykladowa_wartosc", "pole_wzorca", "transformacja_przy_imporcie", "uwagi"]
OSM = [
    ("emergency", "defibrillator", "—", "filtr zapytania Overpass: node[emergency=defibrillator]", "tag główny (wiki: approved)"),
    ("(lat, lon)", "52.2297, 21.0122", "szerokosc_geograficzna, dlugosc_geograficzna", "zaokrąglenie do 6 miejsc; zrodlo_wspolrzednych=osm; lokalizacja_przyblizona=false", ""),
    ("(type/id)", "node/123456789", "zrodlo_id_rekordu", "konkatenacja typ/id", "pozwala zsynchronizować zmiany"),
    ("defibrillator:location", "Hol główny przy portierni", "opis_lokalizacji", "kopiowanie 1:1; gdy brak → description", ""),
    ("defibrillator:location:en", "Main hall", "opis_lokalizacji_en", "kopiowanie 1:1", ""),
    ("description", "...", "uwagi / opis_lokalizacji", "jeśli brak defibrillator:location → opis_lokalizacji", ""),
    ("indoor", "yes / no", "wewnatrz_budynku", "yes→true, no→false, inne→puste", ""),
    ("level", "0 / 1 / -1", "kondygnacja", "liczba całkowita; „0;1” → pierwsza wartość", ""),
    ("access", "yes", "dostepnosc", "yes + opening_hours=24/7 lub brak → publiczna_24_7 (gdy indoor=no) / publiczna_w_godzinach", "brak tagu → zgadywanie; status=do_weryfikacji"),
    ("access", "customers / permissive", "dostepnosc", "→ dla_klientow", ""),
    ("access", "private / no", "dostepnosc", "→ tylko_personel", "access=emergency jest przestarzałe wg wiki"),
    ("opening_hours", "Mo-Fr 08:00-16:00", "godziny_dostepnosci", "kopiowanie 1:1 (ta sama składnia)", "zaleta wyboru składni OSM we wzorcu"),
    ("locked", "yes / no", "sposob_dostepu", "no → otwarta_szafka; yes → szafka_na_klucz (do potwierdzenia); brak → nieznany", ""),
    ("defibrillator:cabinet", "vertical_door / no", "sposob_dostepu", "informacyjnie", "wartości wg wiki: vertical_door, horizontal_door, twist, mechanical, no"),
    ("defibrillator:code", "—", "— (NIE importujemy)", "pomijane", "kod do szafki nie trafia do zbioru otwartego"),
    ("operator", "Urząd Gminy X", "dysponent_nazwa", "kopiowanie 1:1; brak → „nieznany (OSM)”", ""),
    ("phone", "+48 22 000 00 00", "telefon_kontaktowy", "normalizacja do 9 cyfr", "wiki: telefon podmiotu odpowiedzialnego"),
    ("emergency:phone", "112", "—", "pomijane (zawsze 112)", ""),
    ("manufacturer", "...", "producent", "kopiowanie 1:1", ""),
    ("model", "...", "model", "kopiowanie 1:1", ""),
    ("check_date", "2026-05-01", "data_weryfikacji", "kopiowanie; brak → data ostatniej edycji węzła; sposob_weryfikacji=import_bez_weryfikacji", "check_date nie jest opisany na stronie wiki tagu – klucz ogólny OSM"),
    ("addr:street / addr:housenumber / addr:postcode / addr:city", "...", "ulica / numer_budynku / kod_pocztowy / miejscowosc", "rozdzielenie cechy (ul./al./pl.) od nazwy", "rzadko obecne na węźle AED"),
    ("(stałe)", "—", "licencja_rekordu = ODbL-1.0; zrodlo_danych = OSM; status = do_weryfikacji", "", "wymóg licencji ODbL"),
]

# --------------------------------------------------------------------------
# Budowa skoroszytu
# --------------------------------------------------------------------------
HDR_FILL = PatternFill("solid", fgColor="1F3864")
HDR_FONT = Font(bold=True, color="FFFFFF")
WRAP = Alignment(wrap_text=True, vertical="top")
OBOW_FILL = {"O": PatternFill("solid", fgColor="F8D7DA"), "W": PatternFill("solid", fgColor="FFF3CD")}


def naglowek(ws, kolumny, szer=None):
    ws.append(kolumny)
    for i, _ in enumerate(kolumny, 1):
        c = ws.cell(row=1, column=i)
        c.fill, c.font, c.alignment = HDR_FILL, HDR_FONT, Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = (szer[i - 1] if szer else 22)
    ws.freeze_panes = "A2"


def tabela(ws, kolumny, wiersze, szer=None):
    naglowek(ws, kolumny, szer)
    for w in wiersze:
        ws.append(list(w))
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = WRAP
    ws.auto_filter.ref = ws.dimensions


wb = Workbook()

# 0. Informacje
ws = wb.active
ws.title = "informacje"
ws.column_dimensions["A"].width = 26
ws.column_dimensions["B"].width = 120
for k, v in INFO:
    ws.append([k, v])
ws["A1"].font = Font(bold=True, size=14)
for row in ws.iter_rows(min_row=2):
    row[0].font = Font(bold=True)
    for c in row:
        c.alignment = WRAP

# 1. dane_aed
ws = wb.create_sheet("dane_aed")
naglowek(ws, NAGLOWKI, [24 if p[1] != "id_aed" else 38 for p in POLA])
for p in PRZYKLADY:
    ws.append([p.get(h, "") for h in NAGLOWKI])
for i, p in enumerate(POLA, 1):
    if p[5] in OBOW_FILL:
        ws.cell(row=1, column=i).fill = PatternFill("solid", fgColor="9C0006" if p[5] == "O" else "7F6000")
# kolumny tekstowe z zerami wiodącymi zapisujemy jako tekst
for i, p in enumerate(POLA, 1):
    if p[3] == "tekst":
        for r in range(2, len(PRZYKLADY) + 2):
            ws.cell(row=r, column=i).number_format = "@"
# listy rozwijane dla pól słownikowych i logicznych (wiersze 2–5000)
DV_SLOWNIK = []  # (pole słownikowe, kolumna) – walidacja dodawana po zbudowaniu arkusza słowników
for i, p in enumerate(POLA, 1):
    col = get_column_letter(i)
    if p[9]:
        DV_SLOWNIK.append((p[9], col))
    elif p[3] == "logiczny":
        dv = DataValidation(type="list", formula1='"true,false"', allow_blank=True)
        dv.add(f"{col}2:{col}5000")
        ws.add_data_validation(dv)
dane_ws = ws

# 2. slownik_pol
ws = wb.create_sheet("slownik_pol")
kol = ["lp", "grupa", "nazwa_pola", "etykieta", "typ", "format", "obowiazkowosc", "przyklad", "opis",
       "uzasadnienie", "slownik_wartosci", "odpowiednik_osm", "regula_walidacji"]
tabela(ws, kol, [(n, *p) for n, p in enumerate(POLA, 1)],
       [5, 16, 26, 26, 14, 30, 8, 28, 50, 60, 18, 30, 30])
for r in range(2, len(POLA) + 2):
    o = ws.cell(row=r, column=7).value
    if o in OBOW_FILL:
        ws.cell(row=r, column=7).fill = OBOW_FILL[o]

# 3. slowniki_wartosci
ws = wb.create_sheet("slowniki_wartosci")
wiersze, zakresy = [], {}
r = 2
for nazwa, wart in SLOWNIKI.items():
    start = r
    for kod, et, op, osm in wart:
        wiersze.append((nazwa, kod, et, op, osm))
        r += 1
    zakresy[nazwa] = (start, r - 1)
tabela(ws, ["slownik", "kod", "etykieta", "opis", "odpowiednik_osm"], wiersze, [22, 26, 34, 70, 34])
for s, col in DV_SLOWNIK:
    a, b = zakresy[s]
    dv = DataValidation(type="list", formula1=f"slowniki_wartosci!$B${a}:$B${b}", allow_blank=True,
                        showErrorMessage=True, errorTitle="Wartość spoza słownika",
                        error=f"Wybierz kod ze słownika „{s}” (arkusz slowniki_wartosci).")
    dv.add(f"{col}2:{col}5000")
    dane_ws.add_data_validation(dv)

# 4. mapowanie_osm
tabela(wb.create_sheet("mapowanie_osm"), OSM_NAGL, OSM, [34, 26, 34, 60, 50])
# 5. zakres_referencyjny_zrodel
tabela(wb.create_sheet("zakres_referencyjny_zrodel"), ZRODLA_NAGL, ZRODLA,
       [12, 36, 26, 24, 22, 34, 18, 14, 16, 50, 34, 50, 12, 30])
# 6. zrodla_rekordu
tabela(wb.create_sheet("zrodla_rekordu"), ZR_REK_NAGL, ZR_REK, [38, 18, 20, 14, 14, 18])
# 7. metadane_zbioru
tabela(wb.create_sheet("metadane_zbioru"), ["metadana", "proponowana_wartosc", "status / zrodlo"], METADANE, [28, 80, 60])

wb.properties.title = "Wzorcowy zakres danych o defibrylatorach AED"
wb.properties.creator = "Zespół HackNation 2026"
xlsx = OUT / "wzorcowy_zakres_danych_AED.xlsx"
wb.save(xlsx)

# Szablon CSV (RFC 4180: UTF-8, przecinek, CRLF) z samymi nagłówkami + przykłady
with open(OUT / "szablon_aed.csv", "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, lineterminator="\r\n")
    w.writerow(NAGLOWKI)
with open(OUT / "przyklad_aed.csv", "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, lineterminator="\r\n")
    w.writerow(NAGLOWKI)
    for p in PRZYKLADY:
        w.writerow([p.get(h, "") for h in NAGLOWKI])

# --------------------------------------------------------------------------
# Schemat maszynowy: Frictionless Table Schema (schema.json) – format zbliżony do
# "data_schema" zwracanego przez API dane.gov.pl – oraz js/schema/schema.js dla aplikacji
# --------------------------------------------------------------------------
TYP_TS = {"tekst": "string", "słownik": "string", "liczba dziesiętna": "number",
          "liczba całkowita": "integer", "logiczny": "boolean", "data": "date", "data i czas": "datetime"}
UUID_RE = r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
OGRANICZENIA = {
    "id_aed": {"unique": True, "pattern": UUID_RE},
    "nazwa": {"maxLength": 150},
    "szerokosc_geograficzna": {"minimum": 49.0, "maximum": 54.9},
    "dlugosc_geograficzna": {"minimum": 14.1, "maximum": 24.2},
    "kod_terc_gminy": {"pattern": r"^\d{7}$"},
    "kod_simc": {"pattern": r"^\d{7}$"},
    "kod_ulic": {"pattern": r"^\d{5}$"},
    "kod_pocztowy": {"pattern": r"^\d{2}-\d{3}$"},
    "opis_lokalizacji": {"maxLength": 300},
    "opis_lokalizacji_en": {"maxLength": 300},
    "kondygnacja": {"minimum": -5, "maximum": 100},
    "instrukcja_dostepu": {"maxLength": 300},
    "dysponent_regon": {"pattern": r"^(\d{9}|\d{14})$"},
    "telefon_kontaktowy": {"pattern": r"^(\+48)?\d{9}$"},
    "email_kontaktowy": {"pattern": r"^[^@\s]+@[^@\s]+\.[^@\s]+$"},
    "uwagi": {"maxLength": 500},
}
WARUNKI = {  # pola W, dla których warunek da się sprawdzić maszynowo
    "cecha_ulicy": {"pole": "ulica", "niepuste": True},
    "godziny_dostepnosci": {"pole": "dostepnosc", "wartosci": ["publiczna_w_godzinach", "dla_klientow"]},
    "instrukcja_dostepu": {"pole": "sposob_dostepu", "wartosci": ["szafka_na_kod", "szafka_na_klucz"]},
}
pola_ts = []
for (grupa, pole, etykieta, typ, fmt, obow, przyklad, opis, uzas, slownik, osm, walid) in POLA:
    c = dict(OGRANICZENIA.get(pole, {}))
    if obow == "O":
        c["required"] = True
    if slownik:
        c["enum"] = [w[0] for w in SLOWNIKI[slownik]]
    f = {"name": pole, "title": etykieta, "description": opis, "type": TYP_TS[typ]}
    if typ == "data i czas":
        f["format"] = "%Y-%m-%dT%H:%M:%S"
    if typ == "logiczny":
        f["trueValues"], f["falseValues"] = ["true"], ["false"]
    if c:
        f["constraints"] = c
    f["aed"] = {"grupa": grupa, "obowiazkowosc": obow, "format": fmt, "przyklad": przyklad,
                "uzasadnienie": uzas, "slownik": slownik or None, "osm": osm, "walidacja": walid}
    if pole in WARUNKI:
        f["aed"]["wymaganeGdy"] = WARUNKI[pole]
    pola_ts.append(f)

schema = {"name": "aed", "title": "Wzorcowy zakres danych o defibrylatorach AED", "version": WERSJA,
          "fields": pola_ts, "missingValues": [""], "primaryKey": "id_aed"}
(OUT / "schema.json").write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")

js_dane = {
    "schema": schema,
    "slowniki": {k: [{"kod": a, "etykieta": b, "opis": c, "osm": d} for a, b, c, d in v] for k, v in SLOWNIKI.items()},
    "zrodla": [dict(zip(ZRODLA_NAGL, z)) for z in ZRODLA],
}
js_path = OUT.parent / "js" / "schema" / "schema.js"
js_path.parent.mkdir(parents=True, exist_ok=True)
js_path.write_text(
    "/* PLIK GENEROWANY przez wzorzec/generuj_wzorzec.py – nie edytuj ręcznie. */\n"
    "window.AED = window.AED || {};\nwindow.AED.wzorzec = "
    + json.dumps(js_dane, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")

print(f"OK: {xlsx.name}, schema.json, js/schema/schema.js – {len(POLA)} pól, "
      f"{sum(1 for p in POLA if p[5] == 'O')} obowiązkowych")
