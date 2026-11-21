/* Źródło „OpenStreetMap”: pobranie defibrylatorów (emergency=defibrillator) przez Overpass API.
   Wynik jak w file.js: { kolumny: string[], wiersze: object[] (wartości jako tekst), meta: {...} }
   Bez kluczy API. Overpass wysyła nagłówek CORS „*”, więc działa też z file://.
   Dane OSM są na licencji ODbL 1.0 – atrybucja „© współtwórcy OpenStreetMap” jest obowiązkowa. */
(function (AED) {
  'use strict';

  const SERWERY = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
  ];

  // Kod TERYT województwa -> kod ISO 3166-2 (od 2018 r. literowy). W OSM bywa jeden lub drugi,
  // dlatego w zapytaniu dopuszczamy oba oraz tag teryt:terc.
  const WOJEWODZTWA = [
    ['02', 'DS', 'dolnośląskie'], ['04', 'KP', 'kujawsko-pomorskie'], ['06', 'LU', 'lubelskie'],
    ['08', 'LB', 'lubuskie'], ['10', 'LD', 'łódzkie'], ['12', 'MA', 'małopolskie'],
    ['14', 'MZ', 'mazowieckie'], ['16', 'OP', 'opolskie'], ['18', 'PK', 'podkarpackie'],
    ['20', 'PD', 'podlaskie'], ['22', 'PM', 'pomorskie'], ['24', 'SL', 'śląskie'],
    ['26', 'SK', 'świętokrzyskie'], ['28', 'WN', 'warmińsko-mazurskie'], ['30', 'WP', 'wielkopolskie'],
    ['32', 'ZP', 'zachodniopomorskie']
  ];
  const OBSZARY = {
    wojewodztwa: WOJEWODZTWA.map(function (w) { return { kod: 'PL-' + w[0], nazwa: w[2] }; })
  };

  // Limit czasu po stronie serwera Overpass [s]; klient czeka o 30 s dłużej.
  const LIMIT_CZASU = { polska: 300, wojewodztwo: 120, gmina: 60 };

  // Kolejność kolumn: najpierw tagi, które mają odpowiedniki we wzorcu
  const KOLEJNOSC_TAGOW = [
    'name', 'defibrillator:location', 'defibrillator:location:en', 'access', 'opening_hours', 'indoor', 'level',
    'locked', 'defibrillator:cabinet', 'operator', 'phone', 'email', 'description', 'note',
    'addr:city', 'addr:place', 'addr:street', 'addr:housenumber', 'addr:postcode',
    'manufacturer', 'model', 'check_date', 'ref', 'website'
  ];

  const ATRYBUCJA = '© współtwórcy OpenStreetMap, licencja ODbL 1.0 (openstreetmap.org/copyright)';

  // ---------------------------------------------------------------- pomocnicze
  function blad(komunikat, kod, dodatki) {
    const e = new Error(komunikat);
    e.kod = kod;
    if (dodatki) Object.assign(e, dodatki);
    return e;
  }

  function odmiana(n, jeden, kilka, wiele) {
    if (AED.dom && AED.dom.odmiana) return AED.dom.odmiana(n, jeden, kilka, wiele);
    if (n === 1) return jeden;
    const d = n % 10, s = n % 100;
    return (d >= 2 && d <= 4 && (s < 12 || s > 14)) ? kilka : wiele;
  }

  /** fetch + odczyt treści z jednym limitem czasu i sygnałem przerwania.
      `czytaj(odp)` czyta treść odpowiedzi; nasłuch przerwania i zegar są zdejmowane dopiero
      po jej odczytaniu, więc anulowanie i limit czasu obejmują też pobieranie dużej treści.
      Błędy: SIEC / TIMEOUT / PRZERWANO albo błąd z kodem rzucony przez `czytaj`. */
  async function pobierzZLimitem(url, init, signal, limitMs, czytaj) {
    if (signal && signal.aborted) throw blad('Przerwano pobieranie.', 'PRZERWANO');
    const ctrl = new AbortController();
    let przekroczono = false;
    const zegar = setTimeout(function () { przekroczono = true; ctrl.abort(); }, limitMs);
    const przerwij = function () { ctrl.abort(); };
    if (signal) signal.addEventListener('abort', przerwij);
    try {
      const odp = await fetch(url, Object.assign({}, init, { signal: ctrl.signal }));
      return await czytaj(odp);
    } catch (e) {
      if (przekroczono) throw blad('Serwer ' + new URL(url).host + ' nie odpowiedział w ciągu ' + Math.round(limitMs / 1000) + ' s.', 'TIMEOUT');
      if ((signal && signal.aborted) || (e && e.name === 'AbortError')) throw blad('Przerwano pobieranie.', 'PRZERWANO');
      if (e && e.kod) throw e;
      throw blad('Brak połączenia z serwerem ' + new URL(url).host + '. Sprawdź połączenie z internetem.', 'SIEC', { przyczyna: e });
    } finally {
      clearTimeout(zegar);
      if (signal) signal.removeEventListener('abort', przerwij);
    }
  }

  /** Cudzysłowy i ukośniki w wartości tagu w Overpass QL. */
  function cytuj(t) { return String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
  /** Znaki specjalne wyrażeń regularnych (dla dopasowania nazwy gminy). */
  function bezRegex(t) { return String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ------------------------------------------------------------ zapytanie QL
  /** Zwraca { zapytanie, opis, limit } albo rzuca błąd dla niepoprawnych opcji. */
  function zbudujZapytanie(opcje) {
    opcje = opcje || {};
    const zakres = opcje.zakres || 'polska';
    let obszar, opis, nazwaObszaru = null;

    if (zakres === 'polska') {
      obszar = 'area["ISO3166-1"="PL"]["admin_level"="2"]->.a;';
      opis = 'Polska';
    } else if (zakres === 'wojewodztwo') {
      const kod = String(opcje.kod || '').toUpperCase().replace(/^PL-/, '');
      const w = WOJEWODZTWA.find(function (x) { return x[0] === kod || x[1] === kod; });
      if (!w) throw blad('Nieznany kod województwa „' + (opcje.kod || '') + '”. Wybierz województwo z listy.', 'FORMAT');
      obszar = '(area["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"~"^PL-(' + w[0] + '|' + w[1] + ')$"];' +
        'area["boundary"="administrative"]["admin_level"="4"]["teryt:terc"="' + w[0] + '"];)->.a;';
      opis = 'województwo ' + w[2];
      nazwaObszaru = w[2];
    } else if (zakres === 'gmina') {
      const g = String(opcje.gmina || '').trim();
      if (!g) throw blad('Podaj nazwę gminy albo jej 7-cyfrowy kod TERYT.', 'FORMAT');
      if (/^\d{7}$/.test(g)) {
        obszar = 'area["boundary"="administrative"]["admin_level"="7"]["teryt:terc"="' + g + '"]->.a;';
        // miasto na prawach powiatu (powiat 61–99, gmina miejska 011) bywa w OSM tylko granicą powiatu
        if (Number(g.slice(2, 4)) >= 61 && g.slice(4) === '011') {
          obszar = '(area["boundary"="administrative"]["admin_level"="7"]["teryt:terc"="' + g + '"];' +
            'area["boundary"="administrative"]["admin_level"="6"]["teryt:terc"="' + g.slice(0, 4) + '"];)->.a;';
        }
        opis = 'gmina o kodzie TERYT ' + g;
      } else if (/^\d{6}$/.test(g)) {
        // kod bez cyfry rodzaju gminy
        obszar = 'area["boundary"="administrative"]["admin_level"="7"]["teryt:terc"~"^' + g + '[0-9]$"]->.a;';
        opis = 'gmina o kodzie TERYT ' + g + '*';
      } else {
        // W OSM gminy wiejskie i miejsko-wiejskie mają nazwę „gmina X”, gminy miejskie – samo „X”.
        // Poziom 6 = miasta na prawach powiatu (powiaty nazywają się „powiat …”, więc nie pasują).
        const nazwa = g.replace(/^gmina\s+/i, '');
        obszar = 'area["ISO3166-1"="PL"]["admin_level"="2"]->.pl;' +
          'area["boundary"="administrative"]["admin_level"~"^[67]$"]["name"~"^(gmina )?' + cytuj(bezRegex(nazwa)) + '$",i](area.pl)->.a;';
        opis = 'gmina ' + nazwa;
      }
    } else {
      throw blad('Nieznany zakres „' + zakres + '” (dozwolone: polska, wojewodztwo, gmina).', 'FORMAT');
    }

    const limit = LIMIT_CZASU[zakres];
    const zapytanie = '[out:json][timeout:' + limit + '];\n' + obszar + '\n' +
      'nwr["emergency"="defibrillator"](area.a);\n' +
      'out center tags;\n' +
      '.a out tags;';   // obszary na końcu – do sprawdzenia, czy gmina jest jednoznaczna
    return { zapytanie: zapytanie, opis: opis, nazwaObszaru: nazwaObszaru || opis, limit: limit, zakres: zakres };
  }

  // ----------------------------------------------------- spłaszczanie wierszy
  /** elements Overpass -> { kolumny, wiersze, obszary, pominiete } */
  function splaszcz(elementy) {
    const obszary = [], punkty = [];
    let pominiete = 0;
    (elementy || []).forEach(function (el) {
      if (el.type === 'area') { obszary.push(el); return; }
      const lat = el.lat !== undefined ? el.lat : el.center && el.center.lat;
      const lon = el.lon !== undefined ? el.lon : el.center && el.center.lon;
      if (typeof lat !== 'number' || typeof lon !== 'number') { pominiete++; return; }
      punkty.push({ el: el, lat: lat, lon: lon });
    });

    const czestosc = {};
    punkty.forEach(function (p) {
      Object.keys(p.el.tags || {}).forEach(function (k) { czestosc[k] = (czestosc[k] || 0) + 1; });
    });
    const tagi = Object.keys(czestosc).filter(function (k) { return k !== 'emergency'; }).sort(function (a, b) {
      const ia = KOLEJNOSC_TAGOW.indexOf(a), ib = KOLEJNOSC_TAGOW.indexOf(b);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      return (czestosc[b] - czestosc[a]) || (a < b ? -1 : a > b ? 1 : 0);
    });
    const kolumny = ['osm_typ', 'osm_id', 'lat', 'lon'].concat(tagi);

    const wiersze = punkty.map(function (p) {
      const t = p.el.tags || {};
      const o = { osm_typ: p.el.type, osm_id: String(p.el.id), lat: String(p.lat), lon: String(p.lon) };
      tagi.forEach(function (k) { o[k] = t[k] === undefined ? '' : String(t[k]).trim(); });
      return o;
    });
    // kolumny tagów puste we wszystkich wierszach (np. same spacje) – usuwamy
    const niepuste = kolumny.filter(function (k, i) { return i < 4 || wiersze.some(function (w) { return w[k] !== ''; }); });
    if (niepuste.length !== kolumny.length) {
      wiersze.forEach(function (w) { kolumny.forEach(function (k) { if (niepuste.indexOf(k) < 0) delete w[k]; }); });
    }
    return { kolumny: niepuste, wiersze: wiersze, obszary: obszary, pominiete: pominiete };
  }

  function ostrzezenia(wynik) {
    const w = wynik.wiersze, n = w.length, lista = [];
    const ile = function (f) { return w.filter(f).length; };
    const opisz = function (k, tekst) {
      if (k) lista.push(k + ' z ' + n + ' ' + odmiana(n, 'punktu', 'punktów', 'punktów') + ' ' + tekst);
    };
    opisz(ile(function (r) { return !r['defibrillator:location']; }), 'bez opisu lokalizacji (defibrillator:location).');
    opisz(ile(function (r) { return !r['addr:street'] && !r['addr:place']; }), 'bez adresu (addr:street / addr:place) – adres trzeba będzie uzupełnić.');
    opisz(ile(function (r) { return !r['opening_hours']; }), 'bez godzin dostępności (opening_hours).');
    opisz(ile(function (r) { return !r['access']; }), 'bez informacji o dostępie (access).');
    const nieWezly = ile(function (r) { return r.osm_typ !== 'node'; });
    if (nieWezly) lista.push(nieWezly + ' ' + odmiana(nieWezly, 'obiekt jest', 'obiekty są', 'obiektów jest') +
      ' linią lub relacją – jako położenie przyjęto środek obiektu.');
    if (wynik.pominiete) lista.push('Pominięto ' + wynik.pominiete + ' ' + odmiana(wynik.pominiete, 'obiekt', 'obiekty', 'obiektów') + ' bez współrzędnych.');
    return lista;
  }

  /** Zgodność kolumn ze wzorcem – wspólna funkcja z file.js. */
  function zgodnoscZeWzorcem(kolumny) {
    return AED.zrodla.plik.zgodnoscZeWzorcem(kolumny);
  }

  // ---------------------------------------------------------- jeden serwer
  /** Odczyt odpowiedzi Overpass. Błąd z `ostateczny: true` (błędne zapytanie, 400) nie jest ponawiany na innym serwerze. */
  async function czytajOdpowiedz(odp) {
    if (odp.status === 429) throw blad('Serwer OpenStreetMap (Overpass) ogranicza liczbę zapytań. Odczekaj minutę i spróbuj ponownie.', 'LIMIT');
    if (odp.status === 504 || odp.status === 503) throw blad('Serwer OpenStreetMap (Overpass) jest przeciążony. Spróbuj za kilka minut lub wybierz mniejszy obszar.', 'LIMIT');
    if (!odp.ok) {
      const tekst = await odp.text().catch(function (e) { if (e && e.name === 'AbortError') throw e; return ''; });
      const m = /<strong[^>]*>Error<\/strong>:\s*([^<]+)/.exec(tekst);
      throw blad('Serwer Overpass zwrócił błąd ' + odp.status + (m ? ': ' + m[1].trim() : '') + '.',
        odp.status === 400 ? 'FORMAT' : 'SIEC', { ostateczny: odp.status === 400 });
    }
    const tekst = await odp.text();
    let dane;
    try { dane = JSON.parse(tekst); } catch (e) {
      throw blad('Serwer Overpass zwrócił odpowiedź, której nie da się odczytać (to nie jest JSON).', 'FORMAT');
    }
    // Błąd wykonania (np. przekroczony czas / pamięć) Overpass zgłasza w polu remark przy statusie 200
    if (dane && dane.remark && /runtime error|timed out|out of memory/i.test(dane.remark)) {
      throw blad('Zapytanie było za duże dla serwera Overpass (' + dane.remark.replace(/^runtime error:\s*/i, '').slice(0, 120) +
        '). Wybierz mniejszy obszar lub spróbuj później.', /timed out/i.test(dane.remark) ? 'TIMEOUT' : 'LIMIT');
    }
    if (!dane || !Array.isArray(dane.elements)) throw blad('Odpowiedź Overpass nie zawiera listy obiektów.', 'FORMAT');
    return dane;
  }

  function zapytajSerwer(serwer, zap, signal, limitMs) {
    return pobierzZLimitem(serwer, {
      method: 'POST',
      // application/x-www-form-urlencoded = „prosty” request CORS, bez preflight
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: 'data=' + encodeURIComponent(zap.zapytanie)
    }, signal, limitMs, czytajOdpowiedz);
  }

  const OPIS_KODU = { SIEC: 'brak połączenia', TIMEOUT: 'przekroczony czas oczekiwania', LIMIT: 'serwer przeciążony', FORMAT: 'nieprawidłowa odpowiedź' };

  /** Limity czasu [ms]: pierwszy serwer – limit zapytania + 30 s; zapasowe – krócej;
      łącznie najwyżej limit + 60 s (np. gmina 2 min, cała Polska 6 min). */
  function budzetCzasu(zap) {
    return {
      calkowity: (zap.limit + 60) * 1000,
      pierwszy: (zap.limit + 30) * 1000,
      zapasowy: Math.max(45, Math.round(zap.limit / 2)) * 1000,
      minimum: 15000
    };
  }

  // -------------------------------------------------------- publiczne API
  /**
   * @param {{zakres:'polska'|'wojewodztwo'|'gmina', kod?:string, gmina?:string}} opcje
   * @param {{signal?:AbortSignal, onPostep?:function(string)}} [ust]
   * @returns {Promise<{kolumny, wiersze, meta}>}
   */
  async function pobierz(opcje, ust) {
    ust = ust || {};
    const postep = function (t) { if (typeof ust.onPostep === 'function') { try { ust.onPostep(t); } catch (e) { /* UI */ } } };
    const zap = zbudujZapytanie(opcje);

    let dane = null, serwer = null, ostatniBlad = null;
    const bledy = [];
    const budzet = budzetCzasu(zap);
    const start = Date.now();
    for (let i = 0; i < SERWERY.length && !dane; i++) {
      const pozostalo = budzet.calkowity - (Date.now() - start);
      if (i > 0 && pozostalo < budzet.minimum) break; // budżet czasu wyczerpany
      serwer = SERWERY[i];
      postep(i === 0 ? 'Wysyłanie zapytania do OpenStreetMap (' + zap.opis + ')…'
        : 'Serwer ' + new URL(SERWERY[i - 1]).host + ': ' + (OPIS_KODU[ostatniBlad && ostatniBlad.kod] || 'błąd') +
          '. Próba na zapasowym serwerze ' + new URL(serwer).host + '…');
      try {
        dane = await zapytajSerwer(serwer, zap, ust.signal, Math.min(i === 0 ? budzet.pierwszy : budzet.zapasowy, pozostalo));
      } catch (e) {
        if (e.kod === 'PRZERWANO' || e.ostateczny) throw e;
        ostatniBlad = e; // SIEC / LIMIT / TIMEOUT / FORMAT – spróbuj następnego serwera
        bledy.push(e);
      }
    }
    if (!dane) {
      if (bledy.length < 2) throw ostatniBlad;
      // wszystkie serwery zawiodły – zgłaszamy najbardziej pomocną przyczynę
      const kody = bledy.map(function (e) { return e.kod; });
      const kod = ['LIMIT', 'TIMEOUT', 'FORMAT', 'SIEC'].find(function (k) { return kody.indexOf(k) >= 0; }) || 'SIEC';
      let przyczyna = {
        SIEC: 'brak połączenia. Sprawdź połączenie z internetem.',
        FORMAT: 'serwery zwróciły nieprawidłowe odpowiedzi. Spróbuj za kilka minut.',
        LIMIT: 'serwery są przeciążone lub zapytanie trwa zbyt długo. Spróbuj za kilka minut',
        TIMEOUT: 'serwery są przeciążone lub zapytanie trwa zbyt długo. Spróbuj za kilka minut'
      }[kod];
      if (kod === 'LIMIT' || kod === 'TIMEOUT') przyczyna += zap.zakres === 'gmina' ? '.' : ' albo wybierz mniejszy obszar.';
      throw blad('Żaden z ' + bledy.length + ' ' + odmiana(bledy.length, 'serwera', 'serwerów', 'serwerów') +
        ' OpenStreetMap (Overpass) nie zwrócił danych – ' + przyczyna, kod,
        { bledySerwerow: bledy.map(function (e) { return e.message; }) });
    }

    const elementy = dane.elements;
    postep('Przetwarzanie ' + elementy.length + ' ' + odmiana(elementy.length, 'obiektu', 'obiektów', 'obiektów') + '…');
    const wynik = splaszcz(elementy);

    if (!wynik.obszary.length && zap.zakres !== 'polska') {
      throw blad(zap.zakres === 'gmina'
        ? 'Nie znaleziono w OpenStreetMap gminy „' + opcje.gmina + '”. Sprawdź pisownię albo podaj 7-cyfrowy kod TERYT.'
        : 'Nie znaleziono w OpenStreetMap granicy obszaru (' + zap.opis + ').', 'BRAK_DANYCH');
    }
    if (!wynik.wiersze.length) {
      throw blad('W OpenStreetMap nie ma żadnego defibrylatora AED w obszarze: ' + zap.opis + '.', 'BRAK_DANYCH');
    }

    const ostrz = ostrzezenia(wynik);
    // ta sama gmina jako granica gminy (7) i miasta na prawach powiatu (6) to nie niejednoznaczność
    const rozne = {};
    wynik.obszary.forEach(function (a) { rozne[((a.tags && a.tags['teryt:terc']) || '').slice(0, 4) || ('id' + a.id)] = a; });
    const gminy = Object.keys(rozne).map(function (k) { return rozne[k]; });
    if (zap.zakres === 'gmina' && gminy.length > 1) {
      ostrz.unshift('Nazwa „' + opcje.gmina + '” pasuje do ' + gminy.length + ' gmin (' +
        gminy.map(function (a) { return (a.tags && a.tags.name) + (a.tags && a.tags['teryt:terc'] ? ' – TERYT ' + a.tags['teryt:terc'] : ''); }).join('; ') +
        '). Pobrano punkty ze wszystkich – aby zawęzić, podaj kod TERYT.');
    }

    const osm3s = dane.osm3s || {};
    postep('Pobrano ' + wynik.wiersze.length + ' ' + odmiana(wynik.wiersze.length, 'punkt', 'punkty', 'punktów') + ' AED.');
    return {
      kolumny: wynik.kolumny,
      wiersze: wynik.wiersze,
      meta: {
        format: 'Overpass JSON',
        url: serwer,
        zapytanie: zap.zapytanie,
        obszar: zap.nazwaObszaru,   // dla województwa sama nazwa, np. „podkarpackie”
        // bez duplikatów: gmina miejska bywa w OSM i granicą gminy (7), i miasta na prawach powiatu (6)
        obszaryOsm: (zap.zakres === 'gmina' ? gminy : wynik.obszary).map(function (a) { return { id: a.id, nazwa: (a.tags && a.tags.name) || '', teryt: (a.tags && a.tags['teryt:terc']) || '' }; }),
        dataDanych: osm3s.timestamp_osm_base || new Date().toISOString().slice(0, 19) + 'Z',
        licencjaSugerowana: 'ODbL-1.0',
        dysponentSugerowany: 'współtwórcy OpenStreetMap',
        atrybucja: ATRYBUCJA,
        naprawy: [],
        ostrzezenia: ostrz,
        wzorzec: zgodnoscZeWzorcem(wynik.kolumny)
      }
    };
  }

  AED.zrodla = AED.zrodla || {};
  AED.zrodla.osm = {
    OBSZARY: OBSZARY,
    SERWERY: SERWERY,
    ATRYBUCJA: ATRYBUCJA,
    pobierz: pobierz,
    _test: { zbudujZapytanie: zbudujZapytanie, splaszcz: splaszcz, ostrzezenia: ostrzezenia, budzetCzasu: budzetCzasu }
  };
})(window.AED);
