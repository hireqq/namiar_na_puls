/* Testy części 4: duplikaty, punkty odstające, scalanie, eksport (CSV, JSON, GeoJSON, XLSX, Data Package, XML), store.
   Uruchomienie: node tests/czesc4.test.js   (Node 18+, bez zależności npm)
   Walidacja XML względem otwarte_dane_latest.xsd: przez tests/waliduj_xml.py (Python + lxml). Gdy lxml brak – test
   wypisuje „POMINIĘTO” i sprawdza tylko strukturę w JS. Ścieżkę do lxml można podać w zmiennej PYTHONPATH. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const cp = require('child_process');

const KORZEN = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const czytaj = function (p) { return fs.readFileSync(path.join(KORZEN, p), 'utf8'); };

// ------------------------------------------------------------ środowisko
const zdarzenia = [];
const ctx = {
  console, setTimeout, clearTimeout, URL, URLSearchParams, TextDecoder, TextEncoder,
  AbortController, Blob, File, Response, ArrayBuffer, Uint8Array, Headers, ReadableStream, crypto: globalThis.crypto
};
ctx.window = ctx;
ctx.self = ctx;
vm.createContext(ctx);
['vendor/papaparse/papaparse.min.js', 'vendor/sheetjs/xlsx.full.min.js', 'js/core/ns.js', 'js/schema/schema.js', 'js/ui/dom.js',
  'js/sources/file.js', 'js/sources/osm.js', 'js/core/store.js',
  'js/core/normalizacja.js', 'js/core/mapowanie.js', 'js/core/walidacja.js',
  'js/core/duplikaty.js', 'js/core/eksport.js'].forEach(function (p) {
  vm.runInContext(czytaj(p), ctx, { filename: p });
});
const AED = ctx.AED;
const D = AED.duplikaty, E = AED.eksport, M = AED.mapowanie, store = AED.store;
['duplikaty:zmiana', 'wynik:zmiana', 'rekordy:zmiana'].forEach(function (e) { AED.on(e, function (p) { zdarzenia.push({ e: e, p: p }); }); });

const zwykly = function (x) { return JSON.parse(JSON.stringify(x)); };
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const statystyki = [];

async function wczytajPlik(nazwa) {
  const plik = new File([fs.readFileSync(path.join(FIX, nazwa))], nazwa);
  return AED.zrodla.plik.wczytaj(plik);
}
const ZBIORY = {
  krosno: { plik: 'krosno_dgp3624.csv', id: 'dgp-krosno', kod: 'DGP-01', licencja: 'CC0-1.0', dysponent: 'Urząd Miasta Krosna', zbior: '3624' },
  przemysl: { plik: 'przemysl_dgp4581.csv', id: 'dgp-przemysl', kod: 'DGP-02', licencja: 'CC0-1.0', dysponent: 'Urząd Miejski w Przemyślu', zbior: '4581' },
  marki: { plik: 'marki_dgp4955.csv', id: 'dgp-marki', kod: 'DGP-03', licencja: 'CC-BY-4.0', dysponent: 'Urząd Miasta Marki', zbior: '4955' }
};
const zrodla = {};
async function zrodloDgp(klucz) {
  if (zrodla[klucz]) return zrodla[klucz];
  const c = ZBIORY[klucz];
  const w = await wczytajPlik(c.plik);
  const meta = Object.assign({}, w.meta, { zbior: { id: c.zbior, tytul: 'zbiór ' + c.zbior, url: 'https://dane.gov.pl/pl/dataset/' + c.zbior } });
  return (zrodla[klucz] = { id: c.id, kod: c.kod, typ: 'DGP', nazwa: 'zbiór ' + klucz, licencja: c.licencja, dysponent: c.dysponent,
    priorytet: 1, kolumny: w.kolumny, wiersze: w.wiersze, meta: meta, dataPobrania: '2026-11-21T10:00:00' });
}
function rekordyZ(z) { return M.zastosuj(z, M.podpowiedz(z)).rekordy; }

/** Przesunięcie punktu o d metrów w kierunku azymutu (stopnie). */
function przesun(lat, lon, d, az) {
  const r = az * Math.PI / 180;
  return { lat: lat + d * Math.cos(r) / 111320, lon: lon + d * Math.sin(r) / (111320 * Math.cos(lat * Math.PI / 180)) };
}

/** Syntetyczne źródło OSM: każdy punkt Krosna przesunięty o 5–40 m; różne zestawy tagów. */
function zrodloOsmZKrosna(krosno) {
  const elementy = krosno.map(function (r, i) {
    const d = 5 + (i * 7) % 36;          // 5…40 m
    const p = przesun(r.szerokosc_geograficzna, r.dlugosc_geograficzna, d, (i * 47) % 360);
    const tags = { emergency: 'defibrillator', access: 'yes', opening_hours: '24/7' };
    if (i % 3 === 0) tags.name = r.nazwa;
    if (i % 3 === 1 && r.ulica) { tags['addr:street'] = r.ulica; if (r.numer_budynku) tags['addr:housenumber'] = r.numer_budynku; }
    return { type: 'node', id: 800000000 + i, lat: Number(p.lat.toFixed(7)), lon: Number(p.lon.toFixed(7)), tags: tags, _d: d, _krosno: r._id };
  });
  const w = AED.zrodla.osm._test.splaszcz(elementy);
  const z = { id: 'osm-syntetyczny', kod: 'OSM-01', typ: 'OSM', nazwa: 'OSM (syntetyczny)', licencja: 'ODbL-1.0', dysponent: '',
    priorytet: 3, kolumny: w.kolumny, wiersze: w.wiersze, meta: { atrybucja: AED.zrodla.osm.ATRYBUCJA }, dataPobrania: '2026-11-21T11:00:00' };
  return { zrodlo: z, elementy: elementy };
}

/** Rekord ręczny (do małych scenariuszy). */
let nrRek = 0;
function rek(pola) {
  nrRek++;
  const r = { _id: (pola._zrodlo || 'test') + ':' + nrRek, _zrodlo: 'test', _kodZrodla: 'PLIK-01', _wiersz: nrRek + 1, _naprawy: [] };
  AED.wzorzec.schema.fields.forEach(function (f) { r[f.name] = null; });
  r.id_aed = M.nowyUuid();
  r.status = 'aktywny'; r.lokalizacja_przyblizona = false; r.miejscowosc = 'Przykładowo';
  r.zrodlo_danych = 'PLIK-01'; r.licencja_rekordu = 'CC0-1.0'; r.data_aktualizacji_rekordu = '2026-11-21T10:00:00';
  return Object.assign(r, pola);
}
const grupaZ = function (wynik, id) { return wynik.grupy.find(function (g) { return g.rekordy.indexOf(id) >= 0; }) || null; };

const testy = [];
const test = function (nazwa, fn) { testy.push({ nazwa, fn }); };

// ================================================================ pomocnicze
test('podobieństwo: Jaro-Winkler, trigramy, nazwy', function () {
  const T = D._test;
  assert.ok(Math.abs(T.jaroWinkler('martha', 'marhta') - 0.9611) < 0.001);
  assert.strictEqual(T.jaroWinkler('abc', 'abc'), 1);
  assert.strictEqual(T.jaroWinkler('', 'abc'), 0);
  const a = T.opisTekstu('Defibrylator AED – Zespół Krytych Pływalni'), b = T.opisTekstu('Zespół  Krytych Pływalni');
  assert.strictEqual(T.podobienstwoTekstu(a, b), 1, 'słowa „Defibrylator AED” nie odróżniają miejsc');
  assert.ok(T.podobienstwoTekstu(T.opisTekstu('Szkoła Podstawowa nr 2'), T.opisTekstu('Komisariat Policji')) < 0.3);
  assert.strictEqual(T.podobienstwoTekstu(T.opisTekstu('AED'), b), null, 'sama nazwa „AED” = brak informacji');
  const d = T.odlegloscM({ lat: 52.2297, lon: 21.0122 }, { lat: 52.2297, lon: 21.0122 + 0.001 });
  assert.ok(Math.abs(d - 68.2) < 1, 'ok. 68 m na 0,001° długości w Warszawie: ' + d);
  assert.ok(Math.abs(T.haversineKm(49.7188, 21.7203, 52.3267, 21.1076) - 292.7) < 1);
});

// ================================================================ prawdziwe dane
test('duplikaty: Krosno + Przemyśl + Marki (prawdziwe dane) – tylko grupy niskiej pewności, nic nie znika automatycznie', async function () {
  const rek3 = [].concat(rekordyZ(await zrodloDgp('krosno')), rekordyZ(await zrodloDgp('przemysl')), rekordyZ(await zrodloDgp('marki')));
  assert.strictEqual(rek3.length, 50);
  const w = D.znajdz(rek3);
  statystyki.push(['prawdziwe dane (50 rek.)', JSON.stringify(zwykly(w.podsumowanie))]);
  assert.strictEqual(w.podsumowanie.wysoka, 0, 'w prawdziwych zbiorach nie ma pewnych duplikatów');
  assert.strictEqual(w.grupy.length, 4);
  w.grupy.forEach(function (g) {
    assert.ok(/^g[0-9a-z]+-\d+$/.test(g.id));
    assert.ok(g.powody.length > 0 && g.powody.every(function (p) { return typeof p === 'string'; }));
    assert.ok(g.rekordy.indexOf(g.glowny) >= 0);
  });
  // Przemyśl: AED 7639 dwa razy, 2,7 km od siebie, inne adresy
  const p = rek3.filter(function (r) { return r.id_lokalne === 'AED-7639'; });
  assert.strictEqual(p.length, 2);
  const g = grupaZ(w, p[0]._id);
  assert.ok(g && g.rekordy.indexOf(p[1]._id) >= 0, 'podwójny AED 7639 w jednej grupie');
  assert.strictEqual(g.pewnosc, 'niska');
  assert.ok(g.odlegloscM > 2000);
  assert.ok(g.powody.some(function (t) { return /AED-7639/.test(t) && /km od siebie/.test(t); }), g.powody.join(' | '));
  // Marki: wiersze 6 i 7 (id 5 i 6) – te same współrzędne, różne adresy -> niska
  const m56 = grupaZ(w, 'dgp-marki:6');
  assert.ok(m56 && m56.rekordy.indexOf('dgp-marki:7') >= 0 && m56.pewnosc === 'niska');
  assert.ok(m56.powody.some(function (t) { return /różne numery/.test(t); }));
  // Krosno: dwa AED pod tym samym adresem z różnymi numerami -> niska (nie jeden AED)
  const k = w.grupy.find(function (x) { return x.rekordy.every(function (id) { return /^dgp-krosno/.test(id); }); });
  assert.ok(k && k.pewnosc === 'niska');
  // Marki wiersz 8 ma współrzędne z Krosna -> punkt odstający
  assert.strictEqual(w.odstajace.length, 1);
  const o = w.odstajace[0];
  assert.strictEqual(o.rekordId, 'dgp-marki:8');
  assert.strictEqual(o.kod, 'DALEKO_OD_ZBIORU');
  assert.ok(o.odlegloscKm > 250 && o.odlegloscKm < 320);
  assert.ok(/km od pozostałych punktów/.test(o.komunikat));
  // jego para z Krosnem (0 m) ma niską pewność – różne miejscowości
  const gm = grupaZ(w, 'dgp-marki:8');
  assert.ok(gm && gm.pewnosc === 'niska' && gm.powody.some(function (t) { return /różne miejscowości/.test(t); }));
  // scalenie bez decyzji niczego nie łączy
  const s = D.scal(rek3, w.grupy, {});
  assert.strictEqual(s.rekordy.length, 50);
  assert.deepStrictEqual(zwykly(s.raport), { grupy: 4, scalone: 0, rozdzielone: 4, usuniete: 0, pominiete: 0, automatycznie: 0 });
});

test('duplikaty: Krosno (dane.gov.pl) + syntetyczny OSM przesunięty o 5–40 m', async function () {
  const krosno = rekordyZ(await zrodloDgp('krosno'));
  const osm = zrodloOsmZKrosna(krosno);
  const ro = rekordyZ(osm.zrodlo);
  assert.strictEqual(ro.length, krosno.length);
  const w = D.znajdz(krosno.concat(ro));
  statystyki.push(['Krosno + OSM (42 rek.)', JSON.stringify(zwykly(w.podsumowanie))]);
  let trafione = 0, wysokie = 0;
  osm.elementy.forEach(function (el, i) {
    const r = ro[i];
    const g = grupaZ(w, r._id);
    const opis = 'OSM ' + i + ' (' + el._d + ' m, tagi: ' + Object.keys(el.tags).join(',') + ')';
    // bez nazwy i adresu i dalej niż 30 m – nie ma podstaw, by uznać za duplikat
    if (!g) { assert.ok(el._d >= 30 && !el.tags.name && !el.tags['addr:street'], opis + ' – brak grupy'); return; }
    assert.ok(g.rekordy.indexOf(el._krosno) >= 0, opis + ' – grupa bez swojego odpowiednika z Krosna');
    trafione++;
    if (g.pewnosc === 'wysoka') {
      wysokie++;
      assert.strictEqual(g.glowny, el._krosno, 'główny = źródło o wyższym priorytecie (dane.gov.pl)');
      assert.ok(g.rekordy.length === 2);
    }
  });
  assert.ok(trafione >= 17, 'odnaleziono ' + trafione + ' z ' + ro.length);
  assert.ok(wysokie >= 8, 'pewnych par: ' + wysokie);
  // konflikty: współrzędne różnią się o 5–40 m -> konflikt „wspolrzedne” z propozycją głównego
  const gw = w.grupy.find(function (g) { return g.pewnosc === 'wysoka'; });
  const kw = gw.konflikty.find(function (k) { return k.pole === D.POLE_WSPOLRZEDNE; });
  assert.ok(kw && kw.wartosci.length === 2 && kw.proponowana === gw.glowny);
  assert.ok(typeof kw.wartosci[0].lat === 'number');
  // nie ma konfliktu dla pól różniących się tylko zapisem
  assert.ok(!gw.konflikty.some(function (k) { return k.pole === 'id_aed' || k.pole === 'zrodlo_danych'; }));
});

test('duplikaty: dwa AED w tym samym budynku na różnych piętrach – nie są scalane automatycznie', function () {
  const a = rek({ nazwa: 'Galeria Przykładowa', ulica: 'Długa', numer_budynku: '10', szerokosc_geograficzna: 50.0, dlugosc_geograficzna: 20.0,
    kondygnacja: 0, opis_lokalizacji: 'Parter, przy wejściu głównym', id_lokalne: null });
  const b = rek({ nazwa: 'Galeria Przykładowa', ulica: 'Długa', numer_budynku: '10', szerokosc_geograficzna: 50.00002, dlugosc_geograficzna: 20.00001,
    kondygnacja: 2, opis_lokalizacji: 'II piętro, obok kina', id_lokalne: null });
  // OSM: ten sam budynek, poziom 1 – też inne urządzenie
  const c = rek({ _zrodlo: 'osm', nazwa: 'Galeria Przykładowa', szerokosc_geograficzna: 50.00004, dlugosc_geograficzna: 20.0, kondygnacja: 1,
    _kodZrodla: 'OSM-01', licencja_rekordu: 'ODbL-1.0' });
  c._zrodlo = 'osm';
  const w = D.znajdz([a, b, c]);
  w.grupy.forEach(function (g) { assert.notStrictEqual(g.pewnosc, 'wysoka', g.powody.join(' | ')); });
  const g = grupaZ(w, a._id);
  assert.ok(g && g.powody.some(function (t) { return /różne kondygnacje/.test(t); }));
  assert.strictEqual(D.scal([a, b, c], w.grupy, {}).rekordy.length, 3, 'bez decyzji wszystkie trzy zostają');
  // te same piętra i ten sam opis = duplikat w obrębie źródła
  const kopia = Object.assign({}, a, { id_aed: M.nowyUuid(), szerokosc_geograficzna: 50.00003 });
  delete kopia._id;
  const d = rek(kopia);
  const w2 = D.znajdz([a, d]);
  assert.strictEqual(w2.grupy.length, 1);
  assert.strictEqual(w2.grupy[0].pewnosc, 'wysoka', w2.grupy[0].powody.join(' | '));
});

test('duplikaty: w obrębie źródła – ten sam dysponent i id_lokalne, ten sam id_aed, rekordy bez współrzędnych', function () {
  const a = rek({ id_lokalne: 'AED-1', dysponent_nazwa: 'Gmina X', nazwa: 'Urząd', szerokosc_geograficzna: 50.1, dlugosc_geograficzna: 20.1 });
  const b = rek({ id_lokalne: 'aed-1', dysponent_nazwa: 'GMINA X', nazwa: 'Urząd Gminy', szerokosc_geograficzna: 50.1003, dlugosc_geograficzna: 20.1 });
  const c = rek({ id_aed: a.id_aed, nazwa: 'Inna nazwa', szerokosc_geograficzna: null, dlugosc_geograficzna: null });
  const x = rek({ id_lokalne: 'AED-1', dysponent_nazwa: 'Gmina Y', nazwa: 'Szkoła', szerokosc_geograficzna: 52.1, dlugosc_geograficzna: 18.1 });
  const w = D.znajdz([a, b, c, x]);
  assert.strictEqual(w.grupy.length, 1);
  const g = w.grupy[0];
  assert.deepStrictEqual(zwykly(g.rekordy.slice().sort()), [a._id, b._id, c._id].sort());
  assert.strictEqual(g.pewnosc, 'wysoka');
  assert.ok(g.powody.indexOf('ten sam id_aed') >= 0);
  assert.ok(g.powody.some(function (t) { return /ten sam dysponent i id_lokalne/.test(t); }));
  assert.strictEqual(g.odlegloscM, 33);
  // stabilne id grupy – niezależne od kolejności rekordów
  assert.strictEqual(D.znajdz([x, c, b, a]).grupy[0].id, g.id);
});

test('odstające: poza województwem (z pola i z kodu TERC), daleko od miejscowości', function () {
  const lista = [];
  for (let i = 0; i < 6; i++) lista.push(rek({ miejscowosc: 'Kraków', wojewodztwo: 'małopolskie', szerokosc_geograficzna: 50.06 + i * 0.003, dlugosc_geograficzna: 19.94 + i * 0.002 }));
  const zla = rek({ miejscowosc: 'Kraków', wojewodztwo: 'małopolskie', szerokosc_geograficzna: 52.23, dlugosc_geograficzna: 21.01 });
  const terc = rek({ miejscowosc: 'Gdańsk', kod_terc_gminy: '2261011', szerokosc_geograficzna: 50.06, dlugosc_geograficzna: 19.95 });
  const w = D.znajdz(lista.concat([zla, terc]));
  const o = {};
  w.odstajace.forEach(function (x) { o[x.rekordId] = x; });
  assert.strictEqual(o[zla._id].kod, 'POZA_WOJEWODZTWEM');
  assert.ok(/małopolskie/.test(o[zla._id].komunikat));
  assert.strictEqual(o[terc._id].kod, 'POZA_WOJEWODZTWEM', 'województwo z kodu TERC (22 = pomorskie)');
  assert.ok(/pomorskie/.test(o[terc._id].komunikat));
  lista.forEach(function (r) { assert.ok(!o[r._id], 'poprawne punkty bez ostrzeżeń'); });
  // daleko od miejscowości (bez województwa)
  const m = [];
  for (let i = 0; i < 4; i++) m.push(rek({ _zrodlo: 'z' + i, miejscowosc: 'Nowy Sącz', szerokosc_geograficzna: 49.62 + i * 0.002, dlugosc_geograficzna: 20.69 }));
  m.forEach(function (r, i) { r._zrodlo = 'z' + i; });
  const daleko = rek({ miejscowosc: 'Nowy Sącz', szerokosc_geograficzna: 50.3, dlugosc_geograficzna: 20.69 });
  daleko._zrodlo = 'z9';
  const w2 = D.znajdz(m.concat([daleko]));
  assert.strictEqual(w2.odstajace.length, 1);
  assert.strictEqual(w2.odstajace[0].kod, 'DALEKO_OD_MIEJSCOWOSCI');
  assert.ok(w2.odstajace[0].odlegloscKm > 70);
});

// ================================================================ scalanie
test('scal: priorytety źródeł, uzupełnianie pustych pól, pochodzenie, licencja, decyzje', async function () {
  const krosno = rekordyZ(await zrodloDgp('krosno'));
  const osm = zrodloOsmZKrosna(krosno);
  const ro = rekordyZ(osm.zrodlo);
  const wszystkie = krosno.concat(ro);
  const w = D.znajdz(wszystkie, { zrodla: [await zrodloDgp('krosno'), osm.zrodlo] });
  const wys = w.grupy.filter(function (g) { return g.pewnosc === 'wysoka'; });
  const s = D.scal(wszystkie, w.grupy, {});
  assert.strictEqual(s.raport.scalone, wys.length);
  assert.strictEqual(s.raport.usuniete, wys.length);
  assert.strictEqual(s.raport.automatycznie, wys.length);
  assert.strictEqual(s.rekordy.length, wszystkie.length - wys.length);
  const g = wys[0];
  const glowny = wszystkie.find(function (r) { return r._id === g.glowny; });
  const inny = wszystkie.find(function (r) { return r._id !== g.glowny && g.rekordy.indexOf(r._id) >= 0; });
  const m = s.rekordy.find(function (r) { return r._scalonoZ && r._scalonoZ[0]._id === g.glowny; });
  assert.ok(m, 'rekord wynikowy z _scalonoZ');
  assert.strictEqual(m.id_aed, glowny.id_aed, 'id_aed z głównego');
  assert.strictEqual(m.nazwa, glowny.nazwa);
  assert.strictEqual(m.szerokosc_geograficzna, glowny.szerokosc_geograficzna);
  assert.strictEqual(m.godziny_dostepnosci, '24/7', 'puste pole uzupełnione z OSM');
  assert.strictEqual(m.dostepnosc, 'publiczna_24_7');
  assert.strictEqual(m.zrodlo_danych, 'DGP-01;OSM-01');
  assert.strictEqual(m.zrodlo_id_rekordu, inny.zrodlo_id_rekordu, 'node/… z OSM');
  assert.strictEqual(m.licencja_rekordu, 'ODbL-1.0', 'pole z OSM -> licencja ODbL');
  assert.deepStrictEqual(zwykly(m._scalonoZ.map(function (x) { return [x._id, x.kodZrodla, x.rola]; })),
    [[glowny._id, 'DGP-01', 'nadrzedne'], [inny._id, 'OSM-01', 'duplikat_scalony']]);
  assert.ok(!wszystkie.find(function (r) { return r._id === g.glowny; })._scalonoZ, 'rekordy wejściowe bez zmian');

  // decyzje: rozdziel pewną grupę; scal niską; główny OSM z nazwą wybraną z Krosna
  const niska = w.grupy.find(function (x) { return x.pewnosc !== 'wysoka'; });
  const dec = {};
  dec[g.id] = { status: 'scal', glowny: inny._id, wartosci: { nazwa: glowny._id, wspolrzedne: glowny._id } };
  dec[wys[1].id] = { status: 'rozdziel' };
  dec[niska.id] = { status: 'scal' };
  const s2 = D.scal(wszystkie, w.grupy, dec);
  assert.strictEqual(s2.raport.rozdzielone, w.grupy.length - wys.length);
  assert.strictEqual(s2.raport.scalone, wys.length - 1 + 1);
  const m2 = s2.rekordy.find(function (r) { return r._scalonoZ && r._scalonoZ[0]._id === inny._id; });
  assert.strictEqual(m2.id_aed, inny.id_aed);
  assert.strictEqual(m2.nazwa, glowny.nazwa);
  assert.strictEqual(m2.szerokosc_geograficzna, glowny.szerokosc_geograficzna);
  assert.strictEqual(m2.zrodlo_danych, 'OSM-01;DGP-01');
  assert.ok(wys[1].rekordy.every(function (id) { return s2.rekordy.some(function (r) { return r._id === id; }); }), 'rozdzielone zostają');
});

test('scal: licencja wynikowa = najbardziej restrykcyjna z użytych rekordów', function () {
  const a = rek({ nazwa: 'Szkoła', ulica: 'Polna', numer_budynku: '1', szerokosc_geograficzna: 51, dlugosc_geograficzna: 19, licencja_rekordu: 'CC0-1.0',
    godziny_dostepnosci: 'Mo-Fr 08:00-16:00' });
  const b = rek({ nazwa: 'Szkoła', ulica: 'Polna', numer_budynku: '1', szerokosc_geograficzna: 51.00005, dlugosc_geograficzna: 19, licencja_rekordu: 'ODbL-1.0',
    godziny_dostepnosci: 'Mo-Fr 08:00-15:00' });
  b._zrodlo = 'osm'; b._kodZrodla = 'OSM-01'; b.zrodlo_danych = 'OSM-01';
  const c = rek({ nazwa: 'Szkoła', ulica: 'Polna', numer_budynku: '1', szerokosc_geograficzna: 51.00003, dlugosc_geograficzna: 19, licencja_rekordu: 'CC-BY-4.0',
    telefon_kontaktowy: '123456789' });
  c._zrodlo = 'marki'; c._kodZrodla = 'DGP-03'; c.zrodlo_danych = 'DGP-03';
  const w = D.znajdz([a, b, c], { zrodla: [{ id: 'test', priorytet: 1 }, { id: 'osm', priorytet: 3 }, { id: 'marki', priorytet: 2 }] });
  assert.strictEqual(w.grupy.length, 1);
  assert.strictEqual(w.grupy[0].glowny, a._id);
  assert.deepStrictEqual(zwykly(w.grupy[0].rekordy), [a._id, c._id, b._id], 'kolejność wg priorytetu');
  const kg = w.grupy[0].konflikty.find(function (k) { return k.pole === 'godziny_dostepnosci'; });
  assert.ok(kg && kg.proponowana === a._id && kg.wartosci.length === 2);
  // OSM nic nie wnosi (godziny ma główny) -> CC BY (z telefonu z Marek)
  let s = D.scal([a, b, c], w.grupy, {});
  assert.strictEqual(s.rekordy.length, 1);
  assert.strictEqual(s.rekordy[0].licencja_rekordu, 'CC-BY-4.0');
  assert.strictEqual(s.rekordy[0].telefon_kontaktowy, '123456789');
  assert.strictEqual(s.rekordy[0].zrodlo_danych, 'PLIK-01;DGP-03;OSM-01');
  // wybór godzin z OSM -> ODbL
  const dec = {}; dec[w.grupy[0].id] = { status: 'scal', wartosci: { godziny_dostepnosci: b._id } };
  s = D.scal([a, b, c], w.grupy, dec);
  assert.strictEqual(s.rekordy[0].godziny_dostepnosci, 'Mo-Fr 08:00-15:00');
  assert.strictEqual(s.rekordy[0].licencja_rekordu, 'ODbL-1.0');
  // licencja zbioru
  const lz = E.licencjaZbioru(s.rekordy, [{ kod: 'DGP-03', nazwa: 'Defibrylatory Marki', dysponent: 'Urząd Miasta Marki', meta: { zbior: { url: 'https://dane.gov.pl/pl/dataset/4955' } } }]);
  assert.strictEqual(lz.kod, 'ODbL-1.0');
  assert.ok(/share-alike/.test(lz.uzasadnienie));
  assert.ok(lz.atrybucje.some(function (t) { return /OpenStreetMap/.test(t); }));
  assert.ok(lz.atrybucje.some(function (t) { return /Urząd Miasta Marki/.test(t) && /CC BY 4.0/.test(t); }));
  assert.strictEqual(E.licencjaZbioru([a]).kod, 'CC0-1.0');
  assert.strictEqual(E.licencjaZbioru([a, c]).kod, 'CC-BY-4.0');
  assert.ok(/uzupełnij/.test(E.licencjaZbioru([rek({ licencja_rekordu: null })]).uzasadnienie));
});

test('scal: reguła wzorca – wartość z najnowszej data_weryfikacji, przy remisie priorytet źródła; wklad = lista pól', function () {
  const zr = [{ id: 'test', priorytet: 1 }, { id: 'osm', priorytet: 3 }, { id: 'marki', priorytet: 2 }];
  const a = rek({ nazwa: 'Biblioteka', ulica: 'Polna', numer_budynku: '2', szerokosc_geograficzna: 51.1, dlugosc_geograficzna: 19.1,
    data_weryfikacji: '2025-01-10', godziny_dostepnosci: 'Mo-Fr 08:00-16:00', opis_lokalizacji: 'Hol', uwagi: 'stare' });
  const b = rek({ nazwa: 'Biblioteka Miejska', ulica: 'Polna', numer_budynku: '2', szerokosc_geograficzna: 51.10004, dlugosc_geograficzna: 19.1,
    data_weryfikacji: '2026-05-01', godziny_dostepnosci: '24/7', licencja_rekordu: 'ODbL-1.0' });
  b._zrodlo = 'osm'; b._kodZrodla = 'OSM-01'; b.zrodlo_danych = 'OSM-01';
  const c = rek({ nazwa: 'Biblioteka', ulica: 'Polna', numer_budynku: '2', szerokosc_geograficzna: 51.10002, dlugosc_geograficzna: 19.1,
    data_weryfikacji: '2026-05-01', opis_lokalizacji: 'Hol, przy szatni', licencja_rekordu: 'CC-BY-4.0' });
  c._zrodlo = 'marki'; c._kodZrodla = 'DGP-03'; c.zrodlo_danych = 'DGP-03';
  const w = D.znajdz([a, b, c], { zrodla: zr });
  assert.strictEqual(w.grupy.length, 1);
  const g = w.grupy[0];
  assert.strictEqual(g.glowny, a._id, 'główny nadal wg priorytetu źródła');
  const kon = {};
  g.konflikty.forEach(function (k) { kon[k.pole] = k.proponowana; });
  assert.strictEqual(kon.godziny_dostepnosci, b._id, 'nowsza weryfikacja wygrywa mimo niższego priorytetu');
  assert.strictEqual(kon.nazwa, c._id, 'remis dat (b i c) – wyższy priorytet źródła (c)');
  assert.strictEqual(kon.opis_lokalizacji, c._id);
  assert.strictEqual(kon.data_weryfikacji, c._id);
  assert.strictEqual(kon[D.POLE_WSPOLRZEDNE], c._id);
  assert.ok(!kon.uwagi, 'jedna wartość – bez konfliktu');
  let s = D.scal([a, b, c], w.grupy, {}).rekordy;
  assert.strictEqual(s.length, 1);
  let m = s[0];
  assert.strictEqual(m.id_aed, a.id_aed);
  assert.strictEqual(m.godziny_dostepnosci, '24/7');
  assert.strictEqual(m.nazwa, 'Biblioteka');
  assert.strictEqual(m.opis_lokalizacji, 'Hol, przy szatni');
  assert.strictEqual(m.data_weryfikacji, '2026-05-01');
  assert.strictEqual(m.szerokosc_geograficzna, 51.10002);
  assert.strictEqual(m.uwagi, 'stare', 'jedyna wartość z głównego');
  assert.strictEqual(m.licencja_rekordu, 'ODbL-1.0', 'pole z OSM -> ODbL');
  // domyślny wynik scal = wartości „proponowana”
  g.konflikty.forEach(function (k) {
    const zrodlowy = [a, b, c].find(function (r) { return r._id === k.proponowana; });
    if (k.pole === D.POLE_WSPOLRZEDNE) assert.strictEqual(m.szerokosc_geograficzna, zrodlowy.szerokosc_geograficzna);
    else assert.strictEqual(m[k.pole], zrodlowy[k.pole], k.pole);
  });
  const wk = {};
  m._scalonoZ.forEach(function (x) { wk[x._id] = zwykly(x.wklad); });
  assert.ok(wk[a._id].indexOf('id_aed') >= 0 && wk[a._id].indexOf('uwagi') >= 0 && wk[a._id].indexOf('godziny_dostepnosci') < 0);
  assert.deepStrictEqual(wk[b._id], ['godziny_dostepnosci']);
  assert.ok(['nazwa', 'opis_lokalizacji', 'data_weryfikacji', 'szerokosc_geograficzna', 'dlugosc_geograficzna'].every(function (p) { return wk[c._id].indexOf(p) >= 0; }));
  // decyzja użytkownika ma pierwszeństwo: godziny z głównego -> OSM nic nie wnosi, licencja CC BY
  const dec = {}; dec[g.id] = { status: 'scal', wartosci: { godziny_dostepnosci: a._id } };
  m = D.scal([a, b, c], w.grupy, dec).rekordy[0];
  assert.strictEqual(m.godziny_dostepnosci, 'Mo-Fr 08:00-16:00');
  assert.deepStrictEqual(zwykly(m._scalonoZ.find(function (x) { return x._id === b._id; }).wklad), []);
  assert.strictEqual(m.licencja_rekordu, 'CC-BY-4.0');
  assert.strictEqual(E.licencjaZbioru([m]).atrybucje.some(function (t) { return /OpenStreetMap/.test(t); }), false);
});

// ================================================================ eksport
function rekordyEksportu() {
  return [
    rek({ nazwa: 'Szkoła „Pod Dębem”, sala 1', opis_lokalizacji: 'Hol\nprzy "portierni"', szerokosc_geograficzna: 52.2296756, dlugosc_geograficzna: 21.0122287,
      kondygnacja: -1, wewnatrz_budynku: true, kod_terc_gminy: '0261011', kod_pocztowy: '00-001', telefon_kontaktowy: '+48123456789',
      data_weryfikacji: '2026-11-20', uwagi: '=HYPERLINK("http://zly.example","klik")', ulica: 'Źdźbło', numer_budynku: '1/2' }),
    rek({ nazwa: '-1 piętro, @galeria', opis_lokalizacji: '+ obok windy', szerokosc_geograficzna: 50.0, dlugosc_geograficzna: 19.9,
      kondygnacja: 0, wewnatrz_budynku: false, uwagi: 'Zażółć gęślą jaźń; ŻÓŁW' }),
    rek({ nazwa: 'Bez współrzędnych', szerokosc_geograficzna: null, dlugosc_geograficzna: null })
  ];
}

test('eksport: kolumny i CSV (RFC 4180, CRLF, polskie znaki, ochrona przed CSV injection, round-trip PapaParse)', function () {
  const kol = E.kolumny();
  assert.strictEqual(kol.length, AED.wzorzec.schema.fields.length);
  assert.strictEqual(kol[0], 'id_aed');
  assert.strictEqual(kol.join(','), czytaj('wzorzec/szablon_aed.csv').split(/\r?\n/)[0], 'nagłówek jak w szablonie wzorca');
  const r = rekordyEksportu();
  r[0]._tajne = 'nie eksportuj';
  const t = E.csv(r);
  assert.ok(t.indexOf('\r\n') > 0 && !/[^\r]\n(?!przy)/.test(t.replace(/"[^"]*"/g, '')), 'CRLF poza polami w cudzysłowie');
  assert.ok(t.charCodeAt(0) !== 0xFEFF, 'bez BOM domyślnie');
  assert.strictEqual(E.csv(r, { bom: true }).charCodeAt(0), 0xFEFF);
  assert.ok(t.indexOf('_tajne') < 0 && t.indexOf('nie eksportuj') < 0);
  const p = ctx.Papa.parse(t, { header: true, skipEmptyLines: true });
  assert.strictEqual(p.errors.length, 0, JSON.stringify(p.errors));
  assert.deepStrictEqual(zwykly(p.meta.fields), zwykly(kol));
  assert.strictEqual(p.data.length, 3);
  const w0 = p.data[0], w1 = p.data[1];
  assert.strictEqual(w0.nazwa, 'Szkoła „Pod Dębem”, sala 1');
  assert.strictEqual(w0.opis_lokalizacji, 'Hol\nprzy "portierni"');
  assert.strictEqual(w0.szerokosc_geograficzna, '52.229676', '6 miejsc, kropka');
  assert.strictEqual(w0.dlugosc_geograficzna, '21.012229');
  assert.strictEqual(w0.kondygnacja, '-1', 'ujemna kondygnacja bez apostrofu');
  assert.strictEqual(w0.wewnatrz_budynku, 'true');
  assert.strictEqual(w0.lokalizacja_przyblizona, 'false');
  assert.strictEqual(w0.kod_terc_gminy, '0261011', 'zero wiodące');
  assert.strictEqual(w0.telefon_kontaktowy, '+48123456789', 'telefon z + to nie formuła');
  assert.strictEqual(w0.ulica, 'Źdźbło');
  assert.strictEqual(w0.uwagi, '\'=HYPERLINK("http://zly.example","klik")', 'formuła zneutralizowana');
  assert.strictEqual(w1.nazwa, '\'-1 piętro, @galeria');
  assert.strictEqual(w1.opis_lokalizacji, '\'+ obok windy');
  assert.strictEqual(w1.uwagi, 'Zażółć gęślą jaźń; ŻÓŁW');
  assert.strictEqual(w1.kondygnacja, '0');
  assert.strictEqual(p.data[2].szerokosc_geograficzna, '');
  // bez ochrony – wartości 1:1
  assert.strictEqual(ctx.Papa.parse(E.csv(r, { ochrona: false }), { header: true }).data[0].uwagi, '=HYPERLINK("http://zly.example","klik")');
  // round-trip przez mapowanie aplikacji: plik CSV z eksportu wczytany jako źródło daje te same wartości
  const z = { id: 'rt', kod: 'PLIK-99', typ: 'PLIK', licencja: 'CC0-1.0', kolumny: p.meta.fields, wiersze: p.data, meta: {} };
  const rr = M.zastosuj(z, M.podpowiedz(z)).rekordy;
  assert.strictEqual(rr[0].id_aed, r[0].id_aed);
  assert.strictEqual(rr[0].szerokosc_geograficzna, 52.229676);
  assert.strictEqual(rr[0].kondygnacja, -1);
  assert.strictEqual(rr[0].wewnatrz_budynku, true);
  assert.strictEqual(rr[0].kod_terc_gminy, '0261011');
  // przykładowy plik wzorca: eksport rekordów z niego odtwarza wartości
  const wz = ctx.Papa.parse(czytaj('wzorzec/przyklad_aed.csv'), { header: true, skipEmptyLines: true });
  const zw = { id: 'wz', kod: 'PLIK-98', typ: 'PLIK', licencja: '', kolumny: wz.meta.fields, wiersze: wz.data, meta: {} };
  const rw = M.zastosuj(zw, M.podpowiedz(zw)).rekordy;
  const ponownie = ctx.Papa.parse(E.csv(rw), { header: true, skipEmptyLines: true }).data;
  wz.data.forEach(function (wiersz, i) {
    Object.keys(wiersz).forEach(function (k) {
      if (k === 'cecha_ulicy' || k === 'dysponent_typ') return; // pola uzupełniane przez mapowanie (z _naprawy)
      assert.strictEqual(ponownie[i][k], wiersz[k], 'wiersz ' + (i + 2) + ', pole ' + k);
    });
  });
});

test('eksport: JSON i GeoJSON (FeatureCollection, [długość, szerokość])', function () {
  const r = rekordyEksportu();
  const j = JSON.parse(E.json(r));
  assert.strictEqual(j.length, 3);
  assert.deepStrictEqual(Object.keys(j[0]), zwykly(E.kolumny()));
  assert.strictEqual(j[0].kondygnacja, -1);
  assert.strictEqual(j[0].wewnatrz_budynku, true);
  assert.strictEqual(j[0].szerokosc_geograficzna, 52.229676);
  assert.strictEqual(j[2].szerokosc_geograficzna, null);
  const g = JSON.parse(E.geojson(r));
  assert.strictEqual(g.type, 'FeatureCollection');
  assert.strictEqual(g.features.length, 3);
  assert.deepStrictEqual(g.features[0].geometry, { type: 'Point', coordinates: [21.012229, 52.229676] });
  assert.strictEqual(g.features[0].id, r[0].id_aed);
  assert.strictEqual(g.features[0].properties.nazwa, r[0].nazwa);
  assert.ok(!Object.keys(g.features[0].properties).some(function (k) { return k[0] === '_'; }));
  assert.strictEqual(g.features[2].geometry, null);
  assert.strictEqual(JSON.parse(E.geojson(r, { tylkoZeWspolrzednymi: true })).features.length, 2);
});

test('eksport: XLSX (SheetJS) – arkusz danych, „Źródła”, „Pochodzenie”; odczyt z powrotem', async function () {
  const zk = await zrodloDgp('krosno');
  const krosno = rekordyZ(zk);
  const osm = zrodloOsmZKrosna(krosno);
  const wsz = krosno.concat(rekordyZ(osm.zrodlo));
  const s = D.scal(wsz, D.znajdz(wsz).grupy, {});
  const r = rekordyEksportu().concat(s.rekordy);
  const bufor = E.xlsx(r, { zrodla: [zk, osm.zrodlo] });
  assert.ok(bufor instanceof ctx.ArrayBuffer || bufor instanceof ArrayBuffer);
  const wb = ctx.XLSX.read(new Uint8Array(bufor), { type: 'array' });
  assert.deepStrictEqual(zwykly(wb.SheetNames), ['dane_aed', 'Źródła', 'Pochodzenie']);
  const dane = ctx.XLSX.utils.sheet_to_json(wb.Sheets.dane_aed, { defval: null });
  assert.strictEqual(dane.length, r.length);
  assert.deepStrictEqual(Object.keys(dane[0]), zwykly(E.kolumny()));
  assert.strictEqual(dane[0].kod_terc_gminy, '0261011', 'kod jako tekst');
  assert.strictEqual(dane[0].szerokosc_geograficzna, 52.229676, 'liczba');
  assert.strictEqual(dane[0].kondygnacja, -1);
  assert.strictEqual(dane[0].wewnatrz_budynku, 'true');
  assert.strictEqual(dane[0].uwagi, '=HYPERLINK("http://zly.example","klik")', 'w XLSX tekst nie jest formułą – bez apostrofu');
  assert.ok(!wb.Sheets.dane_aed.A2.f && !Object.keys(wb.Sheets.dane_aed).some(function (k) { return wb.Sheets.dane_aed[k] && wb.Sheets.dane_aed[k].f; }), 'brak formuł');
  const zr = ctx.XLSX.utils.sheet_to_json(wb.Sheets['Źródła']);
  assert.strictEqual(zr.length, 2);
  assert.strictEqual(zr[0].kod_zrodla, 'DGP-01');
  assert.strictEqual(zr[0].zasieg_terytorialny, 'gmina miejska Krosno', 'dopasowanie do rejestru we wzorcu (DGP-3624)');
  assert.strictEqual(zr[0].liczba_rekordow, 21);
  assert.strictEqual(zr[1].licencja, 'ODbL-1.0');
  const poch = ctx.XLSX.utils.sheet_to_json(wb.Sheets.Pochodzenie);
  assert.ok(poch.some(function (w) { return w.rola_w_scaleniu === 'duplikat_scalony' && w.zrodlo_danych === 'OSM-01' && /^node\//.test(w.zrodlo_id_rekordu); }));
  assert.ok(poch.every(function (w) { return RE_UUID.test(w.id_aed) || w.id_aed; }));
});

test('eksport: rejestr źródeł (struktura jak AED.wzorzec.zrodla) i CSV', async function () {
  const zk = await zrodloDgp('krosno'), zm = await zrodloDgp('marki');
  const r = rekordyZ(zk).concat(rekordyZ(zm));
  const rej = E.rejestrZrodel([zk, zm], r);
  Object.keys(AED.wzorzec.zrodla[0]).forEach(function (k) { assert.ok(rej.kolumny.indexOf(k) >= 0, 'kolumna ' + k); });
  assert.ok(rej.kolumny.indexOf('liczba_rekordow') >= 0 && rej.kolumny.indexOf('data_pobrania') >= 0);
  assert.strictEqual(rej.wiersze[1].liczba_rekordow, 8);
  assert.strictEqual(rej.wiersze[1].licencja, 'CC-BY-4.0');
  assert.strictEqual(rej.wiersze[1].url, 'https://dane.gov.pl/pl/dataset/4955');
  assert.strictEqual(rej.wiersze[1].data_pobrania, '2026-11-21');
  assert.ok(/dostepnosc/.test(rej.wiersze[0].glowne_braki), 'braki liczone z rekordów: ' + rej.wiersze[0].glowne_braki);
  const p = ctx.Papa.parse(rej.csv, { header: true, skipEmptyLines: true });
  assert.strictEqual(p.data.length, 2);
  assert.strictEqual(p.data[0].kod_zrodla, 'DGP-01');
  const zr = E.zrodlaRekordu(r, [zk, zm]);
  assert.strictEqual(zr.wiersze.length, 29);
  assert.ok(zr.wiersze.every(function (w) { return w.rola_w_scaleniu === 'nadrzedne'; }));
});

test('eksport: Data Package (Frictionless) ze schematem', function () {
  const lic = E.licencjaZbioru(rekordyEksportu());
  const dp = JSON.parse(E.datapackage({ tytul: 'Defibrylatory AED – Gmina Przykładowo', opis: 'Opis', slowaKluczowe: ['AED', 'wzorzec-aed'], licencja: lic, data: '2026-11-21' }));
  assert.strictEqual(dp.profile, 'tabular-data-package');
  assert.ok(/^[a-z0-9-]+$/.test(dp.name), dp.name);
  assert.strictEqual(dp.licenses[0].name, 'CC0-1.0');
  assert.strictEqual(dp.resources.length, 2);
  const csvRes = dp.resources[0];
  assert.strictEqual(csvRes.path, 'aed_2026-11-21.csv');
  assert.strictEqual(csvRes.profile, 'tabular-data-resource');
  assert.strictEqual(csvRes.dialect.delimiter, ',');
  assert.deepStrictEqual(csvRes.schema.fields.map(function (f) { return f.name; }), zwykly(E.kolumny()));
  assert.strictEqual(csvRes.schema.primaryKey, 'id_aed');
  assert.ok(csvRes.schema.fields.every(function (f) { return !f.aed; }), 'bez rozszerzeń aplikacji');
  assert.strictEqual(dp.resources[1].mediatype, 'application/geo+json');
  const dp2 = JSON.parse(E.datapackage({ tytul: 'x' }, [{ plik: 'a.csv' }, { plik: 'a.xlsx', format: 'xlsx' }]));
  assert.strictEqual(dp2.resources[1].format, 'xlsx');
  assert.notStrictEqual(dp2.resources[0].name, dp2.resources[1].name);
});

function metadanePelne() {
  return {
    extIdent: 'aed-gmina-przykladowo',
    tytul: 'Defibrylatory AED – Gmina Przykładowo & okolice <test>',
    tytulEn: 'AED defibrillators – Przykładowo municipality',
    opis: 'Lokalizacje automatycznych defibrylatorów zewnętrznych (AED) wg wzorcowego zakresu danych. Znaki: "cudzysłów" i \'apostrof\'.',
    opisEn: 'Locations of automated external defibrillators.',
    url: 'https://bip.przyklad.pl/aed',
    czestotliwosc: 'monthly',
    kategorie: ['HEAL', 'REGI'],
    slowaKluczowe: ['AED', 'defibrylator', 'wzorzec-aed'],
    slowaKluczoweEn: ['defibrillator'],
    dataAktualizacji: '2026-11-21T10:15:00',
    daneDynamiczne: false,
    daneWysokiejWartosci: false,
    warunki: { zrodlo: true, modyfikacja: true, odpowiedzialnosc: 'Dane informacyjne.', licencja: 'CC0 1.0' },
    dokumenty: [{ url: 'https://przyklad.pl/wzorzec.xlsx', nazwa: 'Wzorcowy zakres danych AED', jezyk: 'pl' }]
  };
}
function zasobyPelne() {
  return [
    { extIdent: 'aed-csv', url: 'https://przyklad.pl/aed_2026-11-21.csv', tytul: 'AED – CSV', opis: 'Plik CSV (UTF-8, przecinek)',
      dostepnosc: 'local', dataDanych: '2026-11-21', regiony: E.regiony([{ kod_terc_gminy: '1861011' }, { kod_terc_gminy: '1861011' }]) },
    { extIdent: 'aed-geojson', url: 'https://przyklad.pl/aed_2026-11-21.geojson', tytul: 'AED – GeoJSON', opis: 'Plik GeoJSON', daneChronione: false }
  ];
}

test('eksport: metadane XML zgodne z otwarte_dane_latest.xsd (lxml) + walidacja metadanych', function () {
  const xml = E.metadaneXml(metadanePelne(), zasobyPelne());
  assert.ok(xml.indexOf('<ns2:datasets xmlns:ns2="urn:otwarte-dane:harvester:1.13">') > 0);
  assert.ok(xml.indexOf('&amp; okolice &lt;test&gt;') > 0, 'znaki specjalne XML');
  assert.ok(/<regions>\s*<terytIdent>1861011<\/terytIdent>\s*<\/regions>/.test(xml));
  const bledny = E.metadaneXml(Object.assign(metadanePelne(), { kategorie: [] }), zasobyPelne());
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'aed-xml-'));
  const pd = path.join(katalog, 'poprawny.xml'), pb = path.join(katalog, 'bledny.xml');
  fs.writeFileSync(pd, xml, 'utf8');
  fs.writeFileSync(pb, bledny, 'utf8');
  const uruchom = function (plik) {
    for (const py of ['python', 'python3', 'py']) {
      const w = cp.spawnSync(py, [path.join(__dirname, 'waliduj_xml.py'), plik], { encoding: 'utf8', env: process.env });
      if (!w.error) return w;
    }
    return null;
  };
  const w = uruchom(pd);
  if (!w || w.status === 2) {
    statystyki.push(['XML vs XSD', 'POMINIĘTO – brak Pythona lub lxml (pip install lxml)']);
  } else {
    assert.strictEqual(w.status, 0, w.stdout + w.stderr);
    const wb = uruchom(pb);
    assert.strictEqual(wb.status, 1, 'walidator musi odrzucić XML bez kategorii: ' + wb.stdout);
    statystyki.push(['XML vs XSD', 'ZGODNY (lxml); celowo błędny XML odrzucony']);
  }
  fs.rmSync(katalog, { recursive: true, force: true });

  assert.deepStrictEqual(zwykly(E.walidujMetadane(metadanePelne(), zasobyPelne()).filter(function (p) { return p.poziom === 'blad'; })), []);
  const puste = E.walidujMetadane({}, []);
  ['extIdent', 'tytul', 'opis', 'kategorie', 'slowaKluczowe', 'zasoby'].forEach(function (pole) {
    assert.ok(puste.some(function (p) { return p.pole === pole && p.poziom === 'blad'; }), 'brak błędu dla ' + pole);
  });
  puste.forEach(function (p) { assert.ok(typeof p.komunikat === 'string' && p.komunikat.length > 10); });
  const zle = E.walidujMetadane(Object.assign(metadanePelne(), { extIdent: 'x'.repeat(37), czestotliwosc: 'codziennie', kategorie: ['ZDROWIE'],
    warunki: { licencja: 'ODbL 1.0' } }), [{ extIdent: 'a', url: 'http://x.pl/a.csv', tytul: 't', opis: 'o', regiony: ['1'] }]);
  const kody = zle.filter(function (p) { return p.poziom === 'blad'; }).map(function (p) { return p.pole + ':' + p.kod; });
  ['extIdent:DLUGOSC', 'czestotliwosc:SLOWNIK', 'kategorie:SLOWNIK', 'warunki.licencja:SLOWNIK', 'zasoby.0.url:WZORZEC', 'zasoby.0.regiony:WZORZEC'].forEach(function (k) {
    assert.ok(kody.indexOf(k) >= 0, 'oczekiwano ' + k + ' w ' + kody.join(', '));
  });
  const bezTagu = E.walidujMetadane(Object.assign(metadanePelne(), { slowaKluczowe: ['AED'] }));
  assert.ok(bezTagu.some(function (p) { return p.poziom === 'ostrzezenie' && /wzorzec-aed/.test(p.komunikat); }));
  const odbl = E.walidujMetadane(Object.assign(metadanePelne(), { licencja: { kod: 'ODbL-1.0' }, warunki: {} }));
  assert.ok(odbl.some(function (p) { return p.kod === 'LICENCJA' && /ODbL/.test(p.komunikat); }));
  // słowniki dla UI = wartości z XSD
  const xsd = czytaj('otwarte_dane_latest.xsd');
  E.SLOWNIKI_XML.czestotliwosc.concat(E.SLOWNIKI_XML.kategorie, E.SLOWNIKI_XML.licencje).forEach(function (x) {
    assert.ok(xsd.indexOf('<xs:enumeration value="' + x.kod + '"') >= 0, x.kod);
  });
  assert.strictEqual(E.SLOWNIKI_XML.kategorie.length, 13);
  assert.strictEqual(E.SLOWNIKI_XML.czestotliwosc.length, 8);
});

/** Metadane i zasoby zbudowane tak jak w js/ui/wynik.js (domyslneMetadane, metadaneEksportu, zasoby) – kopia logiki UI. */
function metadaneJakUI(rekordy, zrodlaLista, adres) {
  const lic = E.licencjaZbioru(rekordy, zrodlaLista);
  const ob = 'Krosno';
  const m = {
    tytul: 'Defibrylatory AED – ' + ob, tytulEn: 'AED defibrillators – ' + ob,
    opis: 'Lokalizacje automatycznych defibrylatorów zewnętrznych (AED) – ' + ob + '. Zbiór połączono z 2 źródeł i ujednolicono według ' +
      'wzorcowego zakresu danych o AED. Każdy rekord ma stały identyfikator id_aed, źródło pochodzenia i licencję. Lista źródeł jest w pliku rejestru źródeł.',
    opisEn: '', czestotliwosc: 'monthly', kategorie: ['HEAL'],
    slowaKluczowe: ['AED', 'defibrylator', 'pierwsza pomoc', 'ratownictwo', 'zdrowie', 'wzorzec-aed'],
    extIdent: 'aed-krosno', url: ''
  };
  m.licencja = lic.kod ? lic : null;
  m.zrodla = zrodlaLista;
  m.dataAktualizacji = new Date();
  m.warunki = { zrodlo: !!(lic.atrybucje && lic.atrybucje.length) };
  if (/odbl/i.test(lic.kod || '')) {
    m.warunki.bazaDanych = 'Zbiór zawiera dane z OpenStreetMap udostępnione na licencji Open Database License 1.0 (ODbL), ' +
      'https://opendatacommons.org/licenses/odbl/1-0/. Wymagane: podanie źródła „© współtwórcy OpenStreetMap” (openstreetmap.org/copyright) ' +
      'oraz udostępnianie baz pochodnych na tej samej licencji (ODbL).';
  } else if (lic.licencjaXml) m.warunki.licencja = lic.licencjaXml;
  const baza = adres && !/\/$/.test(adres) ? adres + '/' : adres;
  const zasoby = ['csv', 'xlsx', 'json', 'geojson', 'rejestr'].map(function (kod) {
    const plik = E.nazwaPliku(kod === 'rejestr' ? 'csv' : kod, null, { przedrostek: kod === 'rejestr' ? 'aed_rejestr_zrodel' : 'aed' });
    return { nazwa: kod === 'rejestr' ? 'rejestr-zrodel' : 'aed-' + kod, kod: kod, plik: plik, sciezka: plik, format: kod === 'rejestr' ? 'csv' : kod,
      typ: 'text/csv', tytul: m.tytul + ' – ' + kod.toUpperCase(), opis: 'Opis zasobu ' + kod + ' (UTF-8).', url: baza ? baza + plik : '',
      extIdent: m.extIdent.slice(0, 36 - kod.length - 1) + '-' + kod, dataDanych: new Date(), regiony: kod === 'rejestr' ? undefined : E.regiony(rekordy) };
  });
  return { m: m, zasoby: zasoby, lic: lic };
}
function walidujXsd(tresci) {
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'aed-xml-'));
  const pliki = tresci.map(function (t, i) { const p = path.join(katalog, 'm' + i + '.xml'); fs.writeFileSync(p, t, 'utf8'); return p; });
  let w = null;
  for (const py of ['python', 'python3', 'py']) {
    const x = cp.spawnSync(py, [path.join(__dirname, 'waliduj_xml.py')].concat(pliki), { encoding: 'utf8', env: process.env });
    if (!x.error) { w = x; break; }
  }
  fs.rmSync(katalog, { recursive: true, force: true });
  return w && w.status !== 2 ? w : null;
}

test('eksport: XML i datapackage zbudowane jak w UI (wariant ODbL i CC0) – XSD i walidujMetadane', async function () {
  const zk = await zrodloDgp('krosno');
  const krosno = rekordyZ(zk);
  const osm = zrodloOsmZKrosna(krosno);
  const wsz = krosno.concat(rekordyZ(osm.zrodlo));
  const wynik = D.scal(wsz, D.znajdz(wsz).grupy, {}).rekordy;
  const odbl = metadaneJakUI(wynik, [zk, osm.zrodlo], 'https://www.urzad.example.pl/dane/aed');
  assert.strictEqual(odbl.lic.kod, 'ODbL-1.0');
  assert.strictEqual(odbl.lic.licencjaXml, null);
  const tylkoGov = metadaneJakUI(krosno, [zk], 'https://www.urzad.example.pl/dane/aed/');
  assert.strictEqual(tylkoGov.lic.licencjaXml, 'CC0 1.0');
  [odbl, tylkoGov].forEach(function (x) {
    const bl = E.walidujMetadane(x.m, x.zasoby).filter(function (p) { return p.poziom === 'blad'; });
    assert.deepStrictEqual(zwykly(bl), [], JSON.stringify(bl));
  });
  // bez adresu plików walidacja zgłasza brak URL zasobów
  const bezAdresu = metadaneJakUI(krosno, [zk], '');
  assert.ok(E.walidujMetadane(bezAdresu.m, bezAdresu.zasoby).some(function (p) { return /^zasoby\.\d+\.url$/.test(p.pole) && p.kod === 'WYMAGANE'; }));
  const x1 = E.metadaneXml(odbl.m, odbl.zasoby), x2 = E.metadaneXml(tylkoGov.m, tylkoGov.zasoby);
  assert.ok(/<dbOrCopyrighted>/.test(x1) && !/dbOrCopyrightedLicenseChosen/.test(x1));
  assert.ok(/<dbOrCopyrightedLicenseChosen>CC0 1.0</.test(x2));
  const w = walidujXsd([x1, x2]);
  if (w) { assert.strictEqual(w.status, 0, w.stdout); statystyki.push(['XML jak w UI (ODbL, CC0)', 'ZGODNY (lxml)']); }
  else statystyki.push(['XML jak w UI', 'POMINIĘTO – brak lxml']);
  // datapackage z zasobami z UI: rejestr ma własny schemat
  const dp = JSON.parse(E.datapackage(odbl.m, odbl.zasoby));
  const rej = dp.resources.find(function (r) { return /rejestr/.test(r.path); });
  assert.ok(rej.schema.fields.some(function (f) { return f.name === 'kod_zrodla'; }) && !rej.schema.fields.some(function (f) { return f.name === 'id_aed'; }));
  assert.strictEqual(dp.resources.find(function (r) { return r.format === 'csv' && !/rejestr/.test(r.path); }).schema.primaryKey, 'id_aed');
  assert.strictEqual(dp.licenses[0].name, 'ODbL-1.0');
});

test('duplikaty: postęp, wersja asynchroniczna, zachowanie istniejącego id_aed', async function () {
  const krosno = rekordyZ(await zrodloDgp('krosno'));
  const osm = zrodloOsmZKrosna(krosno);
  const wsz = krosno.concat(rekordyZ(osm.zrodlo));
  const kroki = [];
  const w1 = D.znajdz(wsz, { postep: function (u) { kroki.push(u); } });
  assert.ok(kroki.length >= 4 && kroki[kroki.length - 1] === 1);
  assert.ok(kroki.every(function (u, i) { return i === 0 || u >= kroki[i - 1]; }), 'postęp nie maleje');
  const w2 = await D.znajdzAsync(wsz, {});
  assert.deepStrictEqual(w2.grupy.map(function (g) { return g.id; }), w1.grupy.map(function (g) { return g.id; }));
  // rekord z wcześniej opublikowanego zbioru (UUID w surowym wierszu) ma niższą pełność, ale jego id_aed zostaje
  const nowy = rek({ nazwa: 'Hala', ulica: 'Sportowa', numer_budynku: '1', szerokosc_geograficzna: 50.5, dlugosc_geograficzna: 20.5,
    godziny_dostepnosci: '24/7', dostepnosc: 'publiczna_24_7', _surowy: { nazwa: 'Hala' } });
  const stary = rek({ nazwa: 'Hala', ulica: 'Sportowa', numer_budynku: '1', szerokosc_geograficzna: 50.50001, dlugosc_geograficzna: 20.5 });
  stary._surowy = { id_aed: stary.id_aed.toUpperCase(), nazwa: 'Hala' };
  const w = D.znajdz([nowy, stary]);
  assert.strictEqual(w.grupy[0].glowny, nowy._id, 'główny = pełniejszy');
  const m = D.scal([nowy, stary], w.grupy, {}).rekordy[0];
  assert.strictEqual(m.id_aed, stary.id_aed, 'zachowany identyfikator ze źródła');
  assert.ok(m._scalonoZ.find(function (x) { return x._id === stary._id; }).wklad.indexOf('id_aed') >= 0);
});

test('eksport: nazwaPliku i regiony', function () {
  assert.strictEqual(E.nazwaPliku('csv', '2026-11-21'), 'aed_2026-11-21.csv');
  assert.strictEqual(E.nazwaPliku('.GeoJSON', new Date(2026, 10, 21)), 'aed_2026-11-21.geojson');
  assert.strictEqual(E.nazwaPliku('csv', '2026-11-21', { terc: '1861011' }), 'aed_1861011_2026-11-21.csv');
  assert.ok(/^aed_\d{4}-\d{2}-\d{2}\.xml$/.test(E.nazwaPliku('xml')));
  assert.deepStrictEqual(zwykly(E.regiony([{ kod_terc_gminy: '1861011' }, { kod_terc_gminy: '1862011' }])), ['1861011', '1862011']);
  assert.deepStrictEqual(zwykly(E.regiony([{ kod_terc_gminy: '1861011' }, { kod_terc_gminy: '1465011' }])), ['14', '18']);
  assert.deepStrictEqual(zwykly(E.regiony([{ wojewodztwo: 'mazowieckie' }])), ['14']);
});

// ================================================================ store
test('store: znajdzDuplikaty, decyzje (przetrwają przelicz), wynik, zdarzenia', async function () {
  const zk = await zrodloDgp('krosno');
  const osm = zrodloOsmZKrosna(rekordyZ(zk));
  store.dodajZrodlo({ typ: 'DGP', nazwa: 'Krosno', licencja: 'CC0-1.0', dysponent: zk.dysponent, kolumny: zk.kolumny, wiersze: zk.wiersze, meta: zk.meta });
  store.dodajZrodlo({ typ: 'OSM', nazwa: 'OSM', licencja: 'ODbL-1.0', kolumny: osm.zrodlo.kolumny, wiersze: osm.zrodlo.wiersze, meta: osm.zrodlo.meta });
  assert.strictEqual(store.duplikaty, null);
  store.przelicz();
  assert.strictEqual(store.wynik.length, 42, 'bez szukania duplikatów wynik = rekordy');
  assert.strictEqual(store.raportScalenia, null);
  zdarzenia.length = 0;
  const d = store.znajdzDuplikaty({ promienM: 30 });
  assert.ok(d.grupy.length > 0);
  assert.strictEqual(store.duplikaty, d);
  assert.ok(zdarzenia.some(function (z) { return z.e === 'duplikaty:zmiana' && z.p.akcja === 'znaleziono'; }));
  assert.ok(zdarzenia.some(function (z) { return z.e === 'wynik:zmiana'; }));
  const wys = d.grupy.filter(function (g) { return g.pewnosc === 'wysoka'; });
  assert.strictEqual(store.wynik.length, 42 - wys.length);
  assert.strictEqual(store.raportScalenia.scalone, wys.length);
  // decyzja: rozdziel pierwszą pewną grupę
  zdarzenia.length = 0;
  store.ustawDecyzje(wys[0].id, { status: 'rozdziel' });
  assert.deepStrictEqual(zwykly(store.decyzje), (function () { const o = {}; o[wys[0].id] = { status: 'rozdziel' }; return o; })());
  assert.ok(zdarzenia.some(function (z) { return z.e === 'duplikaty:zmiana' && z.p.grupaId === wys[0].id; }));
  assert.strictEqual(store.wynik.length, 42 - wys.length + 1);
  assert.throws(function () { store.ustawDecyzje('x', { status: 'cos' }); }, /scal/);
  // przelicz: te same id grup, decyzja obowiązuje
  store.przelicz();
  assert.ok(store.duplikaty !== d, 'duplikaty policzone od nowa po zmianie rekordów');
  assert.deepStrictEqual(store.duplikaty.grupy.map(function (g) { return g.id; }), d.grupy.map(function (g) { return g.id; }));
  assert.strictEqual(store.wynik.length, 42 - wys.length + 1);
  // ręczna poprawka trafia do wyniku
  const glowny = store.duplikaty.grupy.find(function (g) { return g.id === wys[1].id; }).glowny;
  store.aktualizujRekord(glowny, { uwagi: 'poprawione ręcznie' });
  assert.strictEqual(store.wynik.find(function (r) { return r._scalonoZ && r._scalonoZ[0]._id === glowny; }).uwagi, 'poprawione ręcznie');
  // cofnięcie decyzji
  store.ustawDecyzje(wys[0].id, null);
  assert.deepStrictEqual(zwykly(store.decyzje), {});
  assert.strictEqual(store.przeliczWynik().rekordy.length, 42 - wys.length);
  // odstające uznane za poprawne przetrwają ponowne wyszukiwanie; zmiana współrzędnych unieważnia
  const idOdst = store.rekordy[0]._id;
  assert.strictEqual(store.ustawOdstajacyOk(idOdst, true), true);
  assert.strictEqual(store.odstajaceOk.length, 1);
  store.przelicz();
  assert.strictEqual(store.odstajaceOk.length, 1, 'po przeliczeniu lista zostaje');
  store.duplikaty.odstajace.push({ rekordId: idOdst, kod: 'DALEKO_OD_ZBIORU', komunikat: 'test', odlegloscKm: 1 });
  store.ustawOdstajacyOk(idOdst, true);
  assert.strictEqual(store.duplikaty.odstajace.find(function (o) { return o.rekordId === idOdst; }).zaakceptowany, true);
  store.aktualizujRekord(idOdst, { szerokosc_geograficzna: 49.7 });
  store.znajdzDuplikaty();
  store.duplikaty.odstajace.push({ rekordId: idOdst, kod: 'DALEKO_OD_ZBIORU', komunikat: 'test', odlegloscKm: 1 });
  store.ustawOdstajacyOk('nie-ma-takiego', false); // przelicza oznaczenia
  assert.strictEqual(store.duplikaty.odstajace.find(function (o) { return o.rekordId === idOdst; }).zaakceptowany, false, 'inne współrzędne – trzeba sprawdzić ponownie');
  store.cofnijPoprawke(idOdst);
  store.ustawOdstajacyOk(idOdst, false);
  assert.strictEqual(store.odstajaceOk.length, 0);
  // wiele decyzji naraz + wynik bez ODbL
  store.znajdzDuplikaty({ promienM: 30 });
  const mapa = {};
  store.duplikaty.grupy.forEach(function (g) { if (g.pewnosc === 'wysoka') mapa[g.id] = { status: 'rozdziel' }; });
  zdarzenia.length = 0;
  store.ustawDecyzjeWiele(mapa);
  assert.strictEqual(zdarzenia.filter(function (z) { return z.e === 'duplikaty:zmiana'; }).length, 1);
  assert.strictEqual(store.wynik.length, 42);
  const zero = {};
  Object.keys(mapa).forEach(function (k) { zero[k] = null; });
  store.ustawDecyzjeWiele(zero);
  assert.strictEqual(store.wynik.length, 42 - Object.keys(mapa).length);
  const bezOsm = store.wynikDla(function (r) { return r.licencja_rekordu !== 'ODbL-1.0'; });
  assert.strictEqual(bezOsm.rekordy.length, 21, 'urządzenia z Krosna zostają, bez wkładu OSM');
  assert.ok(bezOsm.rekordy.every(function (r) { return r.licencja_rekordu === 'CC0-1.0'; }));
  const kroki = [];
  const asyncW = await store.znajdzDuplikatyAsync({ promienM: 30, postep: function (u) { kroki.push(u); } });
  assert.strictEqual(asyncW, store.duplikaty);
  assert.strictEqual(kroki[kroki.length - 1], 1);
  store.zrodla.forEach(function (z) { store.usunZrodlo(z.id); });
  assert.strictEqual(store.duplikaty.grupy.length, 0);
  assert.strictEqual(store.wynik.length, 0);
});

// ================================================================ wydajność
test('wydajność: 50 000 rekordów – znajdz < 3 s', function () {
  let ziarno = 12345; // mulberry32 – powtarzalne liczby losowe
  const los = function () {
    ziarno = (ziarno + 0x6D2B79F5) | 0;
    let t = Math.imul(ziarno ^ (ziarno >>> 15), 1 | ziarno);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ulice = ['Długa', 'Krótka', 'Polna', 'Leśna', 'Szkolna', 'Kościelna', 'Ogrodowa', 'Lipowa', 'Słoneczna', 'Mickiewicza'];
  const lista = [];
  const baza = 45000;
  for (let i = 0; i < baza; i++) {
    // skupiska wokół 300 „miast” – gęściej niż w rzeczywistości
    const m = Math.floor(los() * 300);
    const lat = 49.3 + ((m * 7919) % 500) / 100 + (los() - 0.5) * 0.08;
    const lon = 14.5 + ((m * 104729) % 900) / 100 + (los() - 0.5) * 0.12;
    lista.push({ _id: 'p:' + i, _zrodlo: 'zr' + (i % 5), _kodZrodla: 'PLIK-0' + (i % 5), id_aed: 'id-' + i, id_lokalne: String(i),
      nazwa: 'Obiekt ' + (i % 997) + ' ' + ulice[i % 10], ulica: ulice[(i * 3) % 10], numer_budynku: String(1 + i % 120), miejscowosc: 'Miasto ' + m,
      szerokosc_geograficzna: lat, dlugosc_geograficzna: lon, licencja_rekordu: 'CC0-1.0' });
  }
  for (let i = 0; i < 5000; i++) {
    const r = lista[Math.floor(los() * baza)];
    const p = przesun(r.szerokosc_geograficzna, r.dlugosc_geograficzna, 3 + los() * 30, los() * 360);
    lista.push({ _id: 'osm:' + i, _zrodlo: 'osm', _kodZrodla: 'OSM-01', id_aed: 'osm-' + i, nazwa: r.nazwa, ulica: r.ulica, numer_budynku: r.numer_budynku,
      miejscowosc: r.miejscowosc, szerokosc_geograficzna: p.lat, dlugosc_geograficzna: p.lon, licencja_rekordu: 'ODbL-1.0' });
  }
  const t0 = Date.now();
  const w = D.znajdz(lista, { zrodla: [{ id: 'osm', priorytet: 3 }] });
  const czas = Date.now() - t0;
  const t1 = Date.now();
  const s = D.scal(lista, w.grupy, {});
  const czasScal = Date.now() - t1;
  const t2 = Date.now();
  const c = E.csv(s.rekordy);
  const czasCsv = Date.now() - t2;
  statystyki.push(['wydajność 50k', 'znajdz ' + czas + ' ms, scal ' + czasScal + ' ms, csv ' + czasCsv + ' ms (' + Math.round(c.length / 1048576) + ' MB); grupy: ' +
    w.podsumowanie.grupy + ' (wysoka ' + w.podsumowanie.wysoka + ', srednia ' + w.podsumowanie.srednia + ', niska ' + w.podsumowanie.niska + '), odstające: ' + w.odstajace.length]);
  assert.ok(czas < 3000, 'znajdz trwało ' + czas + ' ms');
  assert.ok(w.podsumowanie.wysoka > 4000, 'większość wstawionych duplikatów wykryta jako pewna: ' + w.podsumowanie.wysoka);
  assert.ok(czasScal < 2000);
});

// ================================================================ uruchomienie
(async function () {
  let ok = 0;
  const bledy = [];
  for (const t of testy) {
    try {
      await t.fn();
      ok++;
      console.log('  ✓ ' + t.nazwa);
    } catch (e) {
      bledy.push(t.nazwa);
      console.log('  ✗ ' + t.nazwa + '\n    ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n    ') : e));
    }
  }
  console.log('\nStatystyki:');
  statystyki.forEach(function (s) { console.log('  ' + s[0] + ': ' + s[1]); });
  console.log('\n' + ok + '/' + testy.length + ' testów zaliczonych');
  if (bledy.length) process.exit(1);
})();
