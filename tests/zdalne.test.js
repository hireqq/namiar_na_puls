/* Testy źródeł zdalnych (OpenStreetMap / Overpass i dane.gov.pl).
   Uruchomienie: node tests/zdalne.test.js   (Node 18+, bez zależności npm)
   Skrypty aplikacji ładujemy w vm z minimalnym `window`; `fetch` podmieniamy na odpowiedzi
   z tests/fixtures/api/ (prawdziwe odpowiedzi API dane.gov.pl z 2026-11-21 + fikcyjna odpowiedź Overpass). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const KORZEN = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures', 'api');
const czytaj = function (p) { return fs.readFileSync(path.join(KORZEN, p), 'utf8'); };
const fixture = function (n) { return fs.readFileSync(path.join(FIX, n), 'utf8'); };

// ------------------------------------------------------------ środowisko
let obslugaFetch = null;
const wywolania = [];
const ctx = {
  console, setTimeout, clearTimeout, URL, URLSearchParams, TextDecoder, TextEncoder,
  AbortController, Blob, File, Response, Headers, ReadableStream, crypto: globalThis.crypto,
  fetch: function (url, init) {
    wywolania.push({ url: String(url), init: init || {} });
    return obslugaFetch(String(url), init || {});
  }
};
ctx.window = ctx;
ctx.self = ctx;
vm.createContext(ctx);
['vendor/papaparse/papaparse.min.js', 'js/core/ns.js', 'js/schema/schema.js', 'js/ui/dom.js',
  'js/sources/file.js', 'js/sources/osm.js', 'js/sources/dgp.js'].forEach(function (p) {
  vm.runInContext(czytaj(p), ctx, { filename: p });
});
const AED = ctx.AED;
const osm = AED.zrodla.osm, dgp = AED.zrodla.dgp;

const json = function (tekst, status) {
  return new Response(tekst, { status: status || 200, headers: { 'Content-Type': 'application/json' } });
};
/** fetch, który czeka na przerwanie sygnałem (jak prawdziwy fetch) */
const czekajNaPrzerwanie = function (url, init) {
  return new Promise(function (_, odrzuc) {
    const przerwij = function () { const e = new Error('The operation was aborted.'); e.name = 'AbortError'; odrzuc(e); };
    if (init.signal.aborted) przerwij(); else init.signal.addEventListener('abort', przerwij);
  });
};
/** obiekty z kontekstu vm mają inne prototypy – porównujemy przez JSON */
const zwykly = function (x) { return JSON.parse(JSON.stringify(x)); };
const typeError = function () { return Promise.reject(new TypeError('Failed to fetch')); };

async function oczekujBledu(obietnica, kod) {
  try { await obietnica; } catch (e) {
    assert.strictEqual(e.kod, kod, 'oczekiwano kodu ' + kod + ', jest ' + e.kod + ' (' + e.message + ')');
    assert.ok(e instanceof Error || e.message, 'błąd powinien być Error');
    return e;
  }
  assert.fail('oczekiwano błędu ' + kod);
}

// ------------------------------------------------------------ uruchamianie
const testy = [];
const test = function (nazwa, fn) { testy.push({ nazwa, fn }); };

// ================================================================ OSM
test('OSM: lista 16 województw w kontrakcie', function () {
  assert.strictEqual(osm.OBSZARY.wojewodztwa.length, 16);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(osm.OBSZARY.wojewodztwa[0])), { kod: 'PL-02', nazwa: 'dolnośląskie' });
  assert.ok(osm.OBSZARY.wojewodztwa.some(function (w) { return w.kod === 'PL-18' && w.nazwa === 'podkarpackie'; }));
});

test('OSM: zapytanie – cała Polska', function () {
  const z = osm._test.zbudujZapytanie({ zakres: 'polska' });
  assert.match(z.zapytanie, /^\[out:json\]\[timeout:\d+\];/);
  assert.match(z.zapytanie, /area\["ISO3166-1"="PL"\]\["admin_level"="2"\]->\.a;/);
  assert.match(z.zapytanie, /nwr\["emergency"="defibrillator"\]\(area\.a\);/);
  assert.match(z.zapytanie, /out center tags;/);
});

test('OSM: zapytanie – województwo (kod TERYT i literowy ISO)', function () {
  const z = osm._test.zbudujZapytanie({ zakres: 'wojewodztwo', kod: 'PL-18' });
  assert.match(z.zapytanie, /\["ISO3166-2"~"\^PL-\(18\|PK\)\$"\]/);
  assert.match(z.zapytanie, /\["teryt:terc"="18"\]/);
  assert.match(z.zapytanie, /\["admin_level"="4"\]/);
  assert.strictEqual(z.opis, 'województwo podkarpackie');
  const z2 = osm._test.zbudujZapytanie({ zakres: 'wojewodztwo', kod: 'PL-MZ' });
  assert.match(z2.zapytanie, /PL-\(14\|MZ\)/);
});

test('OSM: zapytanie – gmina po TERYT, po nazwie, miasto na prawach powiatu', function () {
  const t = osm._test.zbudujZapytanie({ zakres: 'gmina', gmina: '1816115' });
  assert.match(t.zapytanie, /\["admin_level"="7"\]\["teryt:terc"="1816115"\]/);
  const m = osm._test.zbudujZapytanie({ zakres: 'gmina', gmina: '1861011' }); // Krosno
  assert.match(m.zapytanie, /\["admin_level"="6"\]\["teryt:terc"="1861"\]/);
  const n = osm._test.zbudujZapytanie({ zakres: 'gmina', gmina: 'gmina Rymanów' });
  assert.match(n.zapytanie, /\["name"~"\^\(gmina \)\?Rymanów\$",i\]\(area\.pl\)->\.a;/);
  const s = osm._test.zbudujZapytanie({ zakres: 'gmina', gmina: 'Nowy "Targ" (x)' });
  assert.ok(s.zapytanie.indexOf('Nowy \\"Targ\\" \\\\(x\\\\)') >= 0, 'cudzysłowy i nawiasy powinny być zabezpieczone');
});

test('OSM: niepoprawne opcje -> FORMAT', async function () {
  await oczekujBledu(osm.pobierz({ zakres: 'wojewodztwo', kod: 'PL-99' }, {}), 'FORMAT');
  await oczekujBledu(osm.pobierz({ zakres: 'gmina', gmina: ' ' }, {}), 'FORMAT');
  await oczekujBledu(osm.pobierz({ zakres: 'powiat' }, {}), 'FORMAT');
});

test('OSM: pobranie i spłaszczenie (node + way z center)', async function () {
  wywolania.length = 0;
  obslugaFetch = function () { return Promise.resolve(json(fixture('overpass_przyklad.json'))); };
  const postep = [];
  const w = await osm.pobierz({ zakres: 'gmina', gmina: '1807062' }, { onPostep: function (t) { postep.push(t); } });

  assert.strictEqual(wywolania.length, 1);
  assert.strictEqual(wywolania[0].url, osm.SERWERY[0]);
  assert.strictEqual(wywolania[0].init.method, 'POST');
  assert.ok(decodeURIComponent(wywolania[0].init.body.replace(/^data=/, '')).indexOf('"teryt:terc"="1807062"') >= 0);

  assert.deepStrictEqual(zwykly(w.kolumny.slice(0, 6)), ['osm_typ', 'osm_id', 'lat', 'lon', 'name', 'defibrillator:location']);
  assert.ok(w.kolumny.indexOf('emergency') < 0, 'emergency jest stałe – bez kolumny');
  assert.ok(w.kolumny.indexOf('note') < 0, 'kolumna z samymi spacjami powinna zniknąć');
  assert.strictEqual(w.wiersze.length, 3, 'relacja bez center pominięta');
  const way = w.wiersze.find(function (r) { return r.osm_typ === 'way'; });
  assert.strictEqual(way.lat, '49.6899');
  assert.strictEqual(way.lon, '21.7601');
  assert.strictEqual(way.osm_id, '900000003');
  assert.strictEqual(way.access, '');
  w.wiersze.forEach(function (r) {
    Object.keys(r).forEach(function (k) { assert.strictEqual(typeof r[k], 'string'); });
    assert.deepStrictEqual(Object.keys(r), zwykly(w.kolumny));
  });

  assert.strictEqual(w.meta.licencjaSugerowana, 'ODbL-1.0');
  assert.match(w.meta.atrybucja, /OpenStreetMap/);
  assert.strictEqual(w.meta.dataDanych, '2026-11-21T12:00:00Z');
  assert.strictEqual(w.meta.url, osm.SERWERY[0]);
  assert.match(w.meta.zapytanie, /emergency/);
  assert.ok(Array.isArray(w.meta.naprawy));
  assert.ok(w.meta.ostrzezenia.some(function (t) { return /1 z 3 .*defibrillator:location/.test(t); }), w.meta.ostrzezenia.join(' | '));
  assert.ok(w.meta.ostrzezenia.some(function (t) { return /1 z 3 .*bez adresu/.test(t); }));
  assert.ok(w.meta.ostrzezenia.some(function (t) { return /środek obiektu/.test(t); }));
  assert.ok(w.meta.ostrzezenia.some(function (t) { return /Pominięto 1 obiekt/.test(t); }));
  assert.strictEqual(typeof w.meta.wzorzec.zgodny, 'boolean');
  assert.ok(postep.some(function (t) { return /Wysyłanie zapytania/.test(t); }));
  assert.ok(postep.some(function (t) { return /Przetwarzanie 5 obiektów/.test(t); }));
});

test('OSM: 429 na pierwszym serwerze -> zapasowy', async function () {
  wywolania.length = 0;
  obslugaFetch = function (url) {
    return Promise.resolve(url === osm.SERWERY[0] ? new Response('Too Many Requests', { status: 429 }) : json(fixture('overpass_przyklad.json')));
  };
  const postep = [];
  const w = await osm.pobierz({ zakres: 'wojewodztwo', kod: 'PL-18' }, { onPostep: function (t) { postep.push(t); } });
  assert.strictEqual(w.meta.url, osm.SERWERY[1]);
  assert.strictEqual(wywolania.length, 2);
  assert.ok(postep.some(function (t) { return /przeciążony/.test(t); }), postep.join(' | '));
  assert.ok(!postep.some(function (t) { return /\b(LIMIT|SIEC|TIMEOUT)\b/.test(t); }), 'bez surowych kodów w komunikatach');
});

test('OSM: 429 na wszystkich -> LIMIT; 504 -> LIMIT', async function () {
  obslugaFetch = function () { return Promise.resolve(new Response('x', { status: 429 })); };
  await oczekujBledu(osm.pobierz({ zakres: 'polska' }, {}), 'LIMIT');
  obslugaFetch = function () { return Promise.resolve(new Response('x', { status: 504 })); };
  await oczekujBledu(osm.pobierz({ zakres: 'polska' }, {}), 'LIMIT');
});

test('OSM: runtime error w remark -> TIMEOUT', async function () {
  obslugaFetch = function () {
    return Promise.resolve(json(JSON.stringify({ osm3s: {}, elements: [], remark: 'runtime error: Query timed out in "query" at line 3 after 61 seconds.' })));
  };
  await oczekujBledu(osm.pobierz({ zakres: 'polska' }, {}), 'TIMEOUT');
});

test('OSM: brak sieci (TypeError) -> SIEC; przerwanie -> PRZERWANO', async function () {
  obslugaFetch = typeError;
  await oczekujBledu(osm.pobierz({ zakres: 'polska' }, {}), 'SIEC');
  const ctrl = new AbortController();
  obslugaFetch = czekajNaPrzerwanie;
  const p = osm.pobierz({ zakres: 'polska' }, { signal: ctrl.signal });
  setTimeout(function () { ctrl.abort(); }, 10);
  await oczekujBledu(p, 'PRZERWANO');
  wywolania.length = 0;
  await oczekujBledu(osm.pobierz({ zakres: 'polska' }, { signal: ctrl.signal }), 'PRZERWANO');
  assert.strictEqual(wywolania.length, 0, 'już przerwany sygnał – bez zapytania');
});

test('OSM: gmina nieznaleziona / brak AED -> BRAK_DANYCH', async function () {
  obslugaFetch = function () { return Promise.resolve(json(JSON.stringify({ osm3s: {}, elements: [] }))); };
  const e = await oczekujBledu(osm.pobierz({ zakres: 'gmina', gmina: 'Atlantyda' }, {}), 'BRAK_DANYCH');
  assert.match(e.message, /Nie znaleziono w OpenStreetMap gminy/);
  obslugaFetch = function () {
    return Promise.resolve(json(JSON.stringify({ osm3s: {}, elements: [{ type: 'area', id: 1, tags: { name: 'X' } }] })));
  };
  await oczekujBledu(osm.pobierz({ zakres: 'gmina', gmina: 'X' }, {}), 'BRAK_DANYCH');
});

// ========================================================== dane.gov.pl
const ROUTER_DGP = function (url) {
  let m;
  if (/\/1\.4\/datasets\?/.test(url)) return Promise.resolve(json(fixture('dgp_szukaj.json')));
  if ((m = /\/1\.4\/datasets\/(\d+)\/resources\?/.exec(url))) {
    const plik = 'dgp_zasoby_' + m[1] + '.json';
    return Promise.resolve(fs.existsSync(path.join(FIX, plik)) ? json(fixture(plik)) : json('{}', 404));
  }
  if ((m = /\/resources\/(\d+)\/data\?(?:.*&)?page=(\d+)/.exec(url))) {
    const plik = 'dgp_data_' + m[1] + '_s' + m[2] + '.json';
    if (fs.existsSync(path.join(FIX, plik))) return Promise.resolve(json(fixture(plik)));
    return Promise.resolve(json('{"errors":[]}', 404));
  }
  if (/\/media\/resources\//.test(url) || /skycms/.test(url)) return typeError(); // pliki bez nagłówka CORS
  return Promise.resolve(json('{}', 404));
};

test('DGP: mapowanie licencji na słownik licencja_rekordu', function () {
  assert.strictEqual(dgp.mapujLicencje('CC0 1.0'), 'CC0-1.0');
  assert.strictEqual(dgp.mapujLicencje('CC BY 4.0'), 'CC-BY-4.0');
  assert.strictEqual(dgp.mapujLicencje('cc-by-4.0'), 'CC-BY-4.0');
  assert.strictEqual(dgp.mapujLicencje('ODbL 1.0'), 'ODbL-1.0');
  assert.strictEqual(dgp.mapujLicencje('CC BY-SA 4.0'), '');
  assert.strictEqual(dgp.mapujLicencje('CC BY-NC-SA 4.0'), '');
  assert.strictEqual(dgp.mapujLicencje(''), '');
});

let zbiory;
test('DGP: wyszukiwanie – odsianie trafień rozmytych, instytucje, zasoby', async function () {
  wywolania.length = 0;
  obslugaFetch = ROUTER_DGP;
  zbiory = await dgp.szukaj('', {});
  assert.match(wywolania[0].url, /^https:\/\/api\.dane\.gov\.pl\/1\.4\/datasets\?q=AED%20defibrylator&per_page=20&sort=relevance$/);
  assert.deepStrictEqual(zwykly(zbiory.map(function (z) { return z.id; })), ['4581', '39512', '3624', '4955']);
  assert.strictEqual(wywolania.length, 5, 'wyszukiwanie + 4 listy zasobów (tylko dla trafnych zbiorów)');
  assert.ok(wywolania.slice(1).every(function (x) { return /\/resources\?per_page=100&include=institution$/.test(x.url); }));
  const krosno = zbiory.find(function (z) { return z.id === '3624'; });
  assert.strictEqual(krosno.tytul, 'Defibrylatory zlokalizowane w Mieście Krosno');
  assert.strictEqual(krosno.instytucja, 'Urząd Miasta Krosna');
  assert.strictEqual(krosno.licencja, 'CC0-1.0');
  assert.strictEqual(krosno.licencjaOpis, 'CC0 1.0');
  assert.match(krosno.url, /^https:\/\/dane\.gov\.pl\/pl\/dataset\/3624,/);
  assert.match(krosno.zmodyfikowano, /^\d{4}-\d\d-\d\dT/);
  assert.strictEqual(krosno.zasoby.length, 1);
  const zs = krosno.zasoby[0];
  assert.strictEqual(zs.id, '54632');
  assert.strictEqual(zs.format, 'CSV');
  assert.strictEqual(zs.tabelaryczny, true);
  assert.strictEqual(zs.url, 'https://api.dane.gov.pl/media/resources/20240219/Defibrylator_jAmxQcp.csv');
  assert.match(zs.urlPobrania, /\/resources\/54632,.*\/file$/);
  const marki = zbiory.find(function (z) { return z.id === '4955'; });
  assert.strictEqual(marki.licencja, 'CC-BY-4.0');
  assert.strictEqual(marki.zasoby[0].format, 'XLSX', 'zasób tabelaryczny pierwszy');
  assert.strictEqual(marki.zasoby[0].tabelaryczny, true);
  const przemysl = zbiory.find(function (z) { return z.id === '4581'; });
  assert.strictEqual(przemysl.zasoby.length, 5);
  assert.strictEqual(przemysl.zasoby[0].format, 'CSV');
  assert.strictEqual(przemysl.zasoby[przemysl.zasoby.length - 1].format, 'XML');
  assert.strictEqual(przemysl.instytucja, 'Urząd Miejski w Przemyślu');
});

test('DGP: zasób tabelaryczny – paginacja /data (3 strony, 21 wierszy)', async function () {
  wywolania.length = 0;
  obslugaFetch = ROUTER_DGP;
  const krosno = zbiory.find(function (z) { return z.id === '3624'; });
  const postep = [];
  const w = await dgp.pobierzZasob(krosno, krosno.zasoby[0], { onPostep: function (t) { postep.push(t); } });
  const strony = wywolania.filter(function (x) { return /\/data\?/.test(x.url); });
  assert.strictEqual(strony.length, 3, strony.map(function (x) { return x.url; }).join('\n'));
  assert.match(strony[0].url, /resources\/54632\/data\?per_page=100&page=1$/);
  assert.strictEqual(w.wiersze.length, 21);
  assert.deepStrictEqual(zwykly(w.kolumny), ['Długość geograficzna', 'Szerokość geograficzna', 'Nazwa', 'Lokalizacja', 'Adres', 'Numer Id']);
  assert.strictEqual(w.wiersze[0]['Adres'], 'ul. Jasna, 38-400 Krosno');
  assert.strictEqual(w.wiersze[0]['Numer Id'], '1');
  assert.strictEqual(w.meta.licencjaSugerowana, 'CC0-1.0');
  assert.strictEqual(w.meta.dysponentSugerowany, 'Urząd Miasta Krosna');
  assert.match(w.meta.atrybucja, /Urząd Miasta Krosna.*dane\.gov\.pl.*CC0 1\.0/);
  assert.match(w.meta.url, /resources\/54632\/data$/);
  assert.match(w.meta.dataDanych, /^2024-02-19/);
  assert.ok(w.meta.wzorzec && typeof w.meta.wzorzec.dopasowane === 'number');
  assert.ok(Array.isArray(w.meta.naprawy) && Array.isArray(w.meta.ostrzezenia));
  assert.ok(postep.some(function (t) { return /z 21 wierszy/.test(t); }), postep.join(' | '));
});

test('DGP: zasób tabelaryczny z całym wierszem w jednej komórce (Marki) – naprawa przez file.js', async function () {
  obslugaFetch = ROUTER_DGP;
  const marki = zbiory.find(function (z) { return z.id === '4955'; });
  const w = await dgp.pobierzZasob(marki, marki.zasoby[0], {});
  assert.strictEqual(w.wiersze.length, 8);
  assert.strictEqual(w.kolumny.length, 6, w.kolumny.join(' | '));
  assert.strictEqual(w.kolumny[0], 'Długość geograficzna');
  assert.ok(w.meta.naprawy.length >= 1, 'powinna być odnotowana naprawa');
  assert.strictEqual(w.meta.licencjaSugerowana, 'CC-BY-4.0');
});

test('DGP: plik bez CORS -> błąd CORS z linkiem do ręcznego pobrania', async function () {
  obslugaFetch = ROUTER_DGP;
  const przemysl = zbiory.find(function (z) { return z.id === '4581'; });
  const csv = przemysl.zasoby[0];
  const e = await oczekujBledu(dgp.pobierzZasob(przemysl, csv, {}), 'CORS');
  assert.match(e.linkRęczny, /^https:\/\/api\.dane\.gov\.pl\/resources\/\d+,.*\/file$/);
  assert.match(e.message, /Plik/);
});

test('DGP: nieobsługiwany format (XML) -> FORMAT', async function () {
  const przemysl = zbiory.find(function (z) { return z.id === '4581'; });
  const xml = przemysl.zasoby.find(function (z) { return z.format === 'XML'; });
  wywolania.length = 0;
  const e = await oczekujBledu(dgp.pobierzZasob(przemysl, xml, {}), 'FORMAT');
  assert.ok(e.linkRęczny);
  assert.strictEqual(wywolania.length, 0);
});

test('DGP: plik z nagłówkiem CORS jest czytany przez AED.zrodla.plik', async function () {
  const krosnoCsv = fs.readFileSync(path.join(__dirname, 'fixtures', 'krosno_dgp3624.csv'));
  obslugaFetch = function () { return Promise.resolve(new Response(krosnoCsv, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } })); };
  const zbior = { id: '1', tytul: 'Test', instytucja: 'Gmina Test', licencja: '', licencjaOpis: 'CC BY-SA 4.0', zmodyfikowano: '2025-01-01T00:00:00Z', url: 'https://dane.gov.pl/pl/dataset/1' };
  const zasob = { id: '9', nazwa: 'plik', format: 'CSV', url: 'https://example.org/aed.csv', tabelaryczny: false };
  const w = await dgp.pobierzZasob(zbior, zasob, {});
  assert.strictEqual(w.wiersze.length, 21);
  assert.strictEqual(w.meta.url, 'https://example.org/aed.csv');
  assert.strictEqual(w.meta.licencjaSugerowana, '');
  assert.ok(w.meta.ostrzezenia.some(function (t) { return /CC BY-SA 4\.0/.test(t); }));
  assert.strictEqual(w.skoroszyt, undefined);
});

test('DGP: kody błędów API (429, 5xx, brak sieci, przerwanie)', async function () {
  obslugaFetch = function () { return Promise.resolve(json('{}', 429)); };
  await oczekujBledu(dgp.szukaj('AED', {}), 'LIMIT');
  obslugaFetch = function () { return Promise.resolve(json('{}', 502)); };
  await oczekujBledu(dgp.szukaj('AED', {}), 'SIEC');
  obslugaFetch = typeError;
  await oczekujBledu(dgp.szukaj('AED', {}), 'SIEC');
  const ctrl = new AbortController();
  obslugaFetch = czekajNaPrzerwanie;
  const p = dgp.szukaj('AED', { signal: ctrl.signal });
  setTimeout(function () { ctrl.abort(); }, 10);
  await oczekujBledu(p, 'PRZERWANO');
  // przerwanie w trakcie paginacji
  const ctrl2 = new AbortController();
  let n = 0;
  obslugaFetch = function (url, init) { n++; if (n === 2) { ctrl2.abort(); return czekajNaPrzerwanie(url, init); } return ROUTER_DGP(url); };
  const krosno = zbiory.find(function (z) { return z.id === '3624'; });
  await oczekujBledu(dgp.pobierzZasob(krosno, krosno.zasoby[0], { signal: ctrl2.signal }), 'PRZERWANO');
});

// ================================================ poprawki po przeglądzie
/** Odpowiedź, której treść przychodzi „w nieskończoność” – przerwanie sygnałem zrywa strumień (jak w fetch). */
const treoscBezKonca = function (init, poczatek, typ) {
  const strumien = new ReadableStream({
    start: function (c) {
      c.enqueue(new TextEncoder().encode(poczatek));
      const zerwij = function () { const e = new Error('aborted'); e.name = 'AbortError'; c.error(e); };
      if (init.signal.aborted) zerwij(); else init.signal.addEventListener('abort', zerwij);
    }
  });
  return Promise.resolve(new Response(strumien, { status: 200, headers: { 'Content-Type': typ || 'application/json' } }));
};

test('OSM: przerwanie w trakcie czytania treści -> PRZERWANO', async function () {
  const ctrl = new AbortController();
  obslugaFetch = function (url, init) { setTimeout(function () { ctrl.abort(); }, 20); return treoscBezKonca(init, '{"elements":['); };
  await oczekujBledu(osm.pobierz({ zakres: 'polska' }, { signal: ctrl.signal }), 'PRZERWANO');
});

test('OSM: HTML/zły JSON z serwera -> kolejny serwer; wszystkie FORMAT -> FORMAT; 400 -> od razu', async function () {
  wywolania.length = 0;
  obslugaFetch = function (url) {
    return Promise.resolve(url === osm.SERWERY[0] ? new Response('<html>błąd</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })
      : json(fixture('overpass_przyklad.json')));
  };
  const w = await osm.pobierz({ zakres: 'gmina', gmina: '1807062' }, {});
  assert.strictEqual(w.meta.url, osm.SERWERY[1]);

  wywolania.length = 0;
  obslugaFetch = function () { return Promise.resolve(new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } })); };
  const e = await oczekujBledu(osm.pobierz({ zakres: 'gmina', gmina: '1807062' }, {}), 'FORMAT');
  assert.strictEqual(wywolania.length, osm.SERWERY.length);
  assert.strictEqual(e.bledySerwerow.length, osm.SERWERY.length);

  wywolania.length = 0;
  obslugaFetch = function () { return Promise.resolve(new Response('<p><strong>Error</strong>: line 1: parse error</p>', { status: 400 })); };
  await oczekujBledu(osm.pobierz({ zakres: 'polska' }, {}), 'FORMAT');
  assert.strictEqual(wywolania.length, 1, 'błąd zapytania (400) jest ostateczny');
});

test('OSM: wspólny budżet czasu (limit + 60 s), krótsze limity serwerów zapasowych', function () {
  const b = osm._test.budzetCzasu(osm._test.zbudujZapytanie({ zakres: 'polska' }));
  assert.strictEqual(b.calkowity, 360000);
  assert.strictEqual(b.pierwszy, 330000);
  assert.ok(b.zapasowy < b.pierwszy);
  const g = osm._test.budzetCzasu(osm._test.zbudujZapytanie({ zakres: 'gmina', gmina: '1807062' }));
  assert.strictEqual(g.calkowity, 120000);
});

test('DGP: przerwanie w trakcie czytania treści /data -> PRZERWANO', async function () {
  const ctrl = new AbortController();
  obslugaFetch = function (url, init) { setTimeout(function () { ctrl.abort(); }, 20); return treoscBezKonca(init, '{"data":['); };
  await oczekujBledu(dgp.pobierzZasob({ id: '1' }, { id: '54632', tabelaryczny: true }, { signal: ctrl.signal }), 'PRZERWANO');
  const ctrl2 = new AbortController();
  obslugaFetch = function (url, init) { setTimeout(function () { ctrl2.abort(); }, 20); return treoscBezKonca(init, 'a,b\n1,', 'text/csv'); };
  await oczekujBledu(dgp.pobierzZasob({ id: '1' }, { id: '9', format: 'CSV', url: 'https://example.org/a.csv' }, { signal: ctrl2.signal }), 'PRZERWANO');
});

test('DGP: plik okazuje się stroną HTML -> FORMAT', async function () {
  obslugaFetch = function () { return Promise.resolve(new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })); };
  const e = await oczekujBledu(dgp.pobierzZasob({ id: '1' }, { id: '9', format: 'CSV', url: 'https://example.org/aed.csv' }, {}), 'FORMAT');
  assert.ok(e.linkRęczny);
});

test('DGP: Warszawa – zasób wskazuje stronę katalogu dostawcy -> FORMAT bez pobierania, obslugiwany:false', async function () {
  obslugaFetch = ROUTER_DGP;
  const warszawa = zbiory.find(function (z) { return z.id === '39512'; });
  const zs = warszawa.zasoby[0];
  assert.strictEqual(zs.stronaWww, true);
  assert.strictEqual(zs.obslugiwany, false);
  wywolania.length = 0;
  const e = await oczekujBledu(dgp.pobierzZasob(warszawa, zs, {}), 'FORMAT');
  assert.strictEqual(wywolania.length, 0);
  assert.match(e.message, /stronę WWW dostawcy \(dane\.um\.warszawa\.pl\)/);
  assert.match(e.linkRęczny, /^https:\/\/dane\.um\.warszawa\.pl\//);
  // pliki z /media/ portalu nie są stronami WWW
  const przemysl = zbiory.find(function (z) { return z.id === '4581'; });
  assert.ok(przemysl.zasoby.every(function (z) { return z.stronaWww === false; }));
});

test('DGP: pusty /data -> BRAK_DANYCH (bez próby pobrania pliku)', async function () {
  wywolania.length = 0;
  obslugaFetch = function () {
    return Promise.resolve(json(JSON.stringify({ data: [], links: {}, meta: { count: 0, headers_map: { col1: 'a' } } })));
  };
  const e = await oczekujBledu(dgp.pobierzZasob({ id: '1' }, { id: '77', nazwa: 'pusty', format: 'CSV', tabelaryczny: true, url: 'https://api.dane.gov.pl/media/resources/x.csv' }, {}), 'BRAK_DANYCH');
  assert.strictEqual(wywolania.length, 1);
  assert.ok(e.linkRęczny);
});

test('DGP: błąd listy zasobów -> bladZasobow; zasobyZbioru() ponawia i uzupełnia instytucję', async function () {
  obslugaFetch = function (url) {
    if (/datasets\/3624\/resources/.test(url)) return Promise.resolve(json('{}', 502));
    return ROUTER_DGP(url);
  };
  const wyn = await dgp.szukaj('AED defibrylator', {});
  const krosno = wyn.find(function (z) { return z.id === '3624'; });
  assert.strictEqual(krosno.zasoby.length, 0);
  assert.strictEqual(krosno.instytucja, '');
  assert.match(krosno.bladZasobow, /502/);
  assert.ok(wyn.find(function (z) { return z.id === '4955'; }).zasoby.length === 2, 'inne zbiory bez zmian');

  obslugaFetch = ROUTER_DGP;
  const zasoby = await dgp.zasobyZbioru(krosno, {});
  assert.strictEqual(zasoby.length, 1);
  assert.strictEqual(krosno.zasoby, zasoby);
  assert.strictEqual(krosno.instytucja, 'Urząd Miasta Krosna');
  assert.strictEqual(krosno.bladZasobow, undefined);

  // błąd przy ponowieniu nie zmienia zbioru
  obslugaFetch = function () { return Promise.resolve(json('{}', 429)); };
  await oczekujBledu(dgp.zasobyZbioru(krosno, {}), 'LIMIT');
  assert.strictEqual(krosno.zasoby.length, 1);
});

test('DGP: paginacja listy zasobów', async function () {
  const s1 = JSON.parse(fixture('dgp_zasoby_4581.json'));
  s1.links = { next: 'https://api.dane.gov.pl/1.4/datasets/4581/resources?per_page=100&include=institution&page=2' };
  s1.meta = Object.assign({}, s1.meta, { count: 6 });
  const s2 = JSON.parse(fixture('dgp_zasoby_3624.json'));
  s2.links = {}; s2.meta = Object.assign({}, s2.meta, { count: 6 });
  obslugaFetch = function (url) { return Promise.resolve(json(JSON.stringify(/page=2/.test(url) ? s2 : s1))); };
  const zb = { id: '4581' };
  const zasoby = await dgp.zasobyZbioru(zb, {});
  assert.strictEqual(zasoby.length, 6);
  assert.strictEqual(zb.ostrzezenieZasobow, undefined);
  assert.strictEqual(zb.instytucja, 'Urząd Miejski w Przemyślu');
});

/** Wyszukiwanie z 10 trafnymi zbiorami (kopie prawdziwego wpisu z innym id). */
const ROUTER_10 = function (opoznienie, stat) {
  const baza = JSON.parse(fixture('dgp_szukaj.json'));
  const wzor = baza.data[2]; // Krosno
  const dane = { data: [], meta: { count: 10 }, links: {} };
  for (let i = 0; i < 10; i++) dane.data.push(Object.assign({}, wzor, { id: String(9000 + i) }));
  return function (url, init) {
    if (/\/1\.4\/datasets\?/.test(url)) return Promise.resolve(json(JSON.stringify(dane)));
    stat.teraz++; stat.maks = Math.max(stat.maks, stat.teraz);
    return new Promise(function (ok, zle) {
      const t = setTimeout(function () { stat.teraz--; ok(json(fixture('dgp_zasoby_3624.json'))); }, opoznienie);
      init.signal.addEventListener('abort', function () {
        clearTimeout(t); stat.teraz--; const e = new Error('aborted'); e.name = 'AbortError'; zle(e);
      });
    });
  };
};

test('DGP: najwyżej 4 równoległe zapytania o zasoby', async function () {
  const stat = { teraz: 0, maks: 0 };
  wywolania.length = 0;
  obslugaFetch = ROUTER_10(10, stat);
  const wyn = await dgp.szukaj('defibrylator', {});
  assert.strictEqual(wyn.length, 10);
  assert.ok(wyn.every(function (z) { return z.zasoby.length === 1 && z.instytucja === 'Urząd Miasta Krosna'; }));
  assert.strictEqual(wywolania.length, 11);
  assert.ok(stat.maks <= dgp._test.MAKS_ROWNOLEGLYCH && stat.maks >= 2, 'maks. równolegle: ' + stat.maks);
});

test('DGP: przerwanie przy równoległych zapytaniach o zasoby -> PRZERWANO', async function () {
  const stat = { teraz: 0, maks: 0 };
  wywolania.length = 0;
  obslugaFetch = ROUTER_10(1000, stat);
  const ctrl = new AbortController();
  const p = dgp.szukaj('defibrylator', { signal: ctrl.signal });
  setTimeout(function () { ctrl.abort(); }, 30);
  await oczekujBledu(p, 'PRZERWANO');
  assert.strictEqual(stat.teraz, 0, 'wszystkie trwające zapytania przerwane');
  assert.ok(wywolania.length <= 1 + dgp._test.MAKS_ROWNOLEGLYCH, 'po przerwaniu nie startują nowe zapytania');
});

// ------------------------------------------------------------------ start
(async function () {
  const straznik = setTimeout(function () { console.log('Przekroczono czas testów – coś wisi.'); process.exit(1); }, 20000);
  let ok = 0, zle = 0;
  for (const t of testy) {
    try { await t.fn(); ok++; console.log('  ok   ' + t.nazwa); } catch (e) {
      zle++; console.log('  BŁĄD ' + t.nazwa + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 4).join('\n       '));
    }
  }
  console.log('\n' + ok + ' zaliczonych, ' + zle + ' niezaliczonych');
  clearTimeout(straznik);
  process.exitCode = zle ? 1 : 0;
})();
