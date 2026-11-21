/* Atrapa (mock) AED.zrodla.osm i AED.zrodla.dgp do testów interfejsu bez sieci.
   Wczytuje się TYLKO, gdy prawdziwe moduły nie istnieją. Nie dołączaj na stałe do index.html.
   Sterowanie błędami: gmina „limit” → LIMIT, „cors” → CORS z linkiem ręcznym, „pusta” → 0 rekordów,
   fraza w dane.gov.pl „błąd” → SIEC; zasób o nazwie zawierającej „cors” → CORS z linkiem ręcznym. */
(function (AED) {
  'use strict';
  AED.zrodla = AED.zrodla || {};
  if (AED.zrodla.osm && AED.zrodla.dgp) return;

  function czekaj(ms, signal) {
    return new Promise(function (ok, nie) {
      const t = setTimeout(ok, ms);
      if (signal) signal.addEventListener('abort', function () {
        clearTimeout(t);
        const e = new Error('Przerwano pobieranie.'); e.kod = 'PRZERWANO'; nie(e);
      });
    });
  }
  function blad(kod, msg, link) { const e = new Error(msg); e.kod = kod; if (link) e['linkRęczny'] = link; return e; }
  const OPOZNIENIE = Number(window.MOCK_OPOZNIENIE || 600);

  const WOJ = [['PL-02', 'dolnośląskie'], ['PL-04', 'kujawsko-pomorskie'], ['PL-06', 'lubelskie'], ['PL-08', 'lubuskie'],
    ['PL-10', 'łódzkie'], ['PL-12', 'małopolskie'], ['PL-14', 'mazowieckie'], ['PL-16', 'opolskie'],
    ['PL-18', 'podkarpackie'], ['PL-20', 'podlaskie'], ['PL-22', 'pomorskie'], ['PL-24', 'śląskie'],
    ['PL-26', 'świętokrzyskie'], ['PL-28', 'warmińsko-mazurskie'], ['PL-30', 'wielkopolskie'], ['PL-32', 'zachodniopomorskie']]
    .map(function (w) { return { kod: w[0], nazwa: w[1] }; });

  function wiersze(n, prefix) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ osm_id: 'node/' + (1000 + i), nazwa: prefix + ' ' + (i + 1), lat: String(50 + i / 100), lon: String(21 + i / 100),
        dostep: i % 2 ? 'yes' : 'customers', '<img src=x onerror=alert(1)>': '<b>xss</b>' });
    }
    return out;
  }

  if (!AED.zrodla.osm) AED.zrodla.osm = {
    OBSZARY: { wojewodztwa: WOJ },
    pobierz: async function (opcje, o) {
      o = o || {};
      const p = o.onPostep || function () {};
      p('Wysyłanie zapytania do Overpass…');
      await czekaj(OPOZNIENIE, o.signal);
      const g = (opcje.gmina || '').toLowerCase();
      if (g === 'limit') throw blad('LIMIT', 'Serwer Overpass odpowiedział: zbyt wiele zapytań (429).');
      if (g === 'cors') throw blad('CORS', 'Przeglądarka zablokowała odpowiedź serwera.', 'https://overpass-api.de/api/interpreter?data=x');
      if (g === 'timeout') throw blad('TIMEOUT', 'Serwer nie odpowiedział w ciągu 180 s.');
      p({ tekst: 'Odebrano dane, przetwarzanie…' });
      await czekaj(OPOZNIENIE, o.signal);
      const n = g === 'pusta' ? 0 : opcje.zakres === 'polska' ? 250 : 37;
      return {
        kolumny: ['osm_id', 'nazwa', 'lat', 'lon', 'dostep', '<img src=x onerror=alert(1)>'],
        wiersze: wiersze(n, 'AED'),
        meta: { format: 'Overpass JSON', url: 'https://overpass-api.de/api/interpreter',
          zapytanie: '[out:json][timeout:180];\narea["ISO3166-2"="' + (opcje.kod || 'PL') + '"]->.a;\nnwr["emergency"="defibrillator"](area.a);\nout center tags;',
          dataDanych: '2026-11-21T08:00:00Z', licencjaSugerowana: 'ODbL-1.0',
          atrybucja: '© współtwórcy OpenStreetMap, licencja ODbL', naprawy: [], ostrzezenia: ['3 punkty bez współrzędnych pominięto.'],
          wzorzec: { zgodny: false, dopasowane: 3, wszystkie: 30, brakujaceObowiazkowe: ['a', 'b'] } }
      };
    }
  };

  if (!AED.zrodla.dgp) AED.zrodla.dgp = {
    szukaj: async function (fraza, o) {
      await czekaj(OPOZNIENIE, o && o.signal);
      if (/błąd/i.test(fraza)) throw blad('SIEC', 'Brak połączenia z API dane.gov.pl.');
      if (/nic/i.test(fraza)) return [];
      return [
        { id: 3624, tytul: 'Lokalizacja defibrylatorów AED w Krośnie', instytucja: 'Gmina Miasto Krosno',
          licencja: 'CC BY 4.0', licencjaOpis: 'Uznanie autorstwa 4.0', zmodyfikowano: '2025-03-14T10:00:00Z',
          url: 'https://dane.gov.pl/pl/dataset/3624',
          zasoby: [{ id: 1, nazwa: 'AED Krosno 2025', format: 'csv', url: 'https://dane.gov.pl/r/1', tabelaryczny: true },
            { id: 2, nazwa: 'AED Krosno (XLSX)', format: 'xlsx', url: 'https://dane.gov.pl/r/2', tabelaryczny: true },
            { id: 3, nazwa: 'Mapa – opis', format: 'pdf', url: 'https://dane.gov.pl/r/3', tabelaryczny: false }] },
        { id: 4581, tytul: 'Defibrylatory AED – Przemyśl', instytucja: 'Gmina Miejska Przemyśl',
          licencja: 'CC0 1.0', zmodyfikowano: '2024-10-01', url: 'javascript:alert(1)',
          zasoby: [{ id: 9, nazwa: 'zasób cors', format: 'csv', url: 'https://dane.gov.pl/r/9', tabelaryczny: true }] }
      ];
    },
    pobierzZasob: async function (zbior, zasob, o) {
      o = o || {};
      (o.onPostep || function () {})('Pobieranie ' + zasob.format + '…');
      await czekaj(OPOZNIENIE, o.signal);
      if (/cors/.test(zasob.nazwa)) throw blad('CORS', 'Serwer z plikiem nie pozwala na pobranie z przeglądarki.', zasob.url);
      return {
        kolumny: ['Lp', 'Adres', 'Lokalizacja'],
        wiersze: [{ Lp: '1', Adres: 'ul. Lwowska 28a', Lokalizacja: 'Urząd' }, { Lp: '2', Adres: 'ul. Bieszczadzka 1', Lokalizacja: 'Szkoła' }],
        meta: { format: zasob.format.toUpperCase(), url: zasob.url, dataDanych: zbior.zmodyfikowano,
          licencjaSugerowana: 'CC-BY-4.0', dysponentSugerowany: zbior.instytucja, atrybucja: zbior.instytucja + ', dane.gov.pl',
          naprawy: [], ostrzezenia: [], wzorzec: { zgodny: false, dopasowane: 1, wszystkie: 30, brakujaceObowiazkowe: ['x'] } }
      };
    }
  };
})(window.AED);
