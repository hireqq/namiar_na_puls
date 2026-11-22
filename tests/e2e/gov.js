/* Krok 4: „Zatwierdź i wyślij do bazy gov.pl (Symulacja)”.
   Przycisk zablokowany (aria-disabled, w kolejności Tab, lista braków) → kroki 1→4 + metadane → wysyłka (stan ładowania,
   aria-busy) → potwierdzenie z liczbą 1 → druga wysyłka → liczba 2 → „Pobierz plik wyniki.gov” = plik SQLite.
   Tryb serwera (serwer.py z bazą tymczasową), a potem tryb przeglądarkowy (sql.js + IndexedDB, bez API). 320 px. */
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = async function (t) {
  const { b, adres, ok, korzen } = t;
  const FIX = path.join(korzen, 'tests', 'fixtures');
  fs.rmSync(t.pobrane, { recursive: true, force: true });
  await b.pobierania(t.pobrane);

  await b.idz(adres + 'index.html#start');
  await b.przeladuj(); // czysty stan aplikacji (poprzednie testy zostawiają źródła w pamięci strony)
  await b.czekaj("document.readyState === 'complete' && !!window.AED && !!AED.router");
  // bez prawdziwego modułu (BACK) – atrapa kontraktu
  if (!(await b.ocen('!!(AED.gov && AED.gov.wyslij)'))) {
    await b.ocen("new Promise(function (ok, nie) { const s = document.createElement('script'); s.src = 'tests/mock-czesc6.js'; s.onload = ok; s.onerror = nie; document.body.appendChild(s); })");
    ok(true, 'brak js/core/gov.js – używam atrapy tests/mock-czesc6.js');
  }
  const atrapa = await b.ocen('!!AED.gov.atrapa');

  // ---- przed ukończeniem kroków: przycisk zablokowany, ale osiągalny klawiaturą i z opisem
  await b.ocen("location.hash = '#wynik'; true");
  await b.czekaj("!!document.getElementById('gov-wyslij') && !!document.querySelector('#gov-gotowosc .gov-braki')");
  ok(await b.ocen("(function(){ const x = document.getElementById('gov-wyslij'); return x.textContent.trim() === 'Zatwierdź i wyślij do bazy gov.pl (Symulacja)' && x.getAttribute('aria-disabled') === 'true' && !x.disabled && x.tabIndex === 0; })()"),
    'przed krokami: przycisk z właściwym tekstem, aria-disabled (nie disabled), w kolejności Tab');
  ok(await b.ocen("/nieaktywny/.test(document.getElementById(document.getElementById('gov-wyslij').getAttribute('aria-describedby')).textContent)"),
    'opis przycisku mówi, dlaczego jest nieaktywny');
  ok(await b.ocen("!!document.querySelector('#gov-gotowosc a[href=\"#zrodla\"]')"), 'lista braków z linkiem do kroku 1');
  ok(await b.ocen("/symulacja/i.test(document.getElementById('gov-wysylka').textContent) && /nie trafiają do żadnego prawdziwego\\s+systemu/.test(document.getElementById('gov-info').textContent)"),
    'jasna informacja: to symulacja');
  await b.ocen("document.getElementById('gov-wyslij').click()");
  await b.pauza(200);
  ok(await b.ocen("document.activeElement.id === 'gov-braki-tytul' && document.getElementById('gov-postep').textContent === ''"),
    'klik w zablokowany przycisk: fokus na liście braków, bez wysyłki');

  // ---- kroki 1 → 4 (jeden plik)
  await b.ocen("location.hash = '#zrodla'; true");
  await b.pliki('#plik-input', [path.join(FIX, 'krosno_dgp3624.csv')]);
  await b.czekaj('AED.store.zrodla.length === 1 && AED.store.zrodla[0].wiersze.length > 0', 30000);
  await b.ocen("AED.store.aktualizujZrodlo(AED.store.zrodla[0].id, { licencja: 'CC0-1.0', dysponent: 'Urząd Miasta Krosna' }); true");
  await b.ocen("document.getElementById('dalej-mapowanie').click()");
  await b.czekaj("location.hash === '#mapowanie'");
  await b.ocen("document.getElementById('dalej-walidacja').click()");
  await b.czekaj("location.hash === '#walidacja' && !document.getElementById('wal-tresc').hidden", 60000);
  await b.ocen("document.getElementById('dup-szukaj').click(); true");
  await b.czekaj('!!AED.store.duplikaty', 60000);
  await b.ocen("location.hash = '#wynik'; true");
  await b.czekaj("!document.getElementById('wyn-tresc').hidden && !!document.getElementById('wyn-m-form')");
  // metadane: podpowiedzi + własny tytuł (zmiana pola odświeża gotowość)
  await b.ocen("(function(){ const el = document.getElementById('wyn-m-tytul'); el.value = 'Defibrylatory AED – Krosno (test e2e)'; el.dispatchEvent(new Event('change', { bubbles: true })); })()");
  try {
    await b.czekaj("document.getElementById('gov-wyslij').getAttribute('aria-disabled') !== 'true'", 15000);
    ok(true, 'po krokach 1–4 i metadanych przycisk jest aktywny');
  } catch (e) {
    ok(false, 'po krokach 1–4 i metadanych przycisk jest aktywny', await b.ocen("document.getElementById('gov-gotowosc').textContent"));
    return;
  }
  ok(await b.ocen("!!document.querySelector('#gov-gotowosc .gov-gotowe')"), 'komunikat „wszystkie 4 kroki gotowe”');
  // brak w metadanych → przycisk znów zablokowany, link prowadzi do pola
  await b.ocen("(function(){ const el = document.getElementById('wyn-m-tytul'); el.value = ''; el.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await b.czekaj("document.getElementById('gov-wyslij').getAttribute('aria-disabled') === 'true' && !!document.querySelector('#gov-gotowosc a[href^=\"#wyn-m-\"], #gov-gotowosc a[href=\"#h-wyn-metadane\"]')");
  ok(true, 'pusty tytuł: przycisk zablokowany, brak w kroku 4 z linkiem do metadanych');
  await b.ocen("(function(){ const el = document.getElementById('wyn-m-tytul'); el.value = 'Defibrylatory AED – Krosno (test e2e)'; el.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await b.czekaj("document.getElementById('gov-wyslij').getAttribute('aria-disabled') !== 'true'");

  /** Wysyłka: stan ładowania, blokada podwójnego kliknięcia, potwierdzenie. Zwraca liczbę zgłoszeń z potwierdzenia. */
  async function wyslij(opis) {
    await b.ocen("document.getElementById('gov-wyslij').focus()");
    await b.klawisz('Enter');
    await b.czekaj("document.getElementById('gov-wysylka').getAttribute('aria-busy') === 'true'", 5000);
    const postep = await b.ocen("document.getElementById('gov-postep').textContent");
    ok(/^Trwa weryfikacja i wysyłka danych do systemu gov\.pl\.\.\.$|gov\.pl/.test(postep) && await b.ocen("document.getElementById('gov-postep').getAttribute('aria-live') === 'polite'"),
      opis + ': stan ładowania z komunikatem (aria-live)', postep);
    ok(await b.ocen("document.getElementById('gov-wyslij').getAttribute('aria-disabled') === 'true'"), opis + ': w trakcie przycisk zablokowany');
    // podwójne kliknięcie nie tworzy drugiego zgłoszenia
    await b.ocen("document.getElementById('gov-wyslij').click(); true");
    let widziano = false;
    for (let i = 0; i < 60; i++) {
      const tx = await b.ocen("document.getElementById('gov-postep').textContent");
      if (tx === 'Trwa weryfikacja i wysyłka danych do systemu gov.pl...') widziano = true;
      if (await b.ocen("!!document.getElementById('gov-wynik-tytul') || !!document.getElementById('gov-blad-tytul')")) break;
      await b.pauza(50);
    }
    ok(widziano, opis + ': dokładny komunikat „Trwa weryfikacja i wysyłka danych do systemu gov.pl...”');
    await b.czekaj("!!document.getElementById('gov-wynik-tytul') || !!document.getElementById('gov-blad-tytul')", 30000);
    if (await b.ocen("!!document.getElementById('gov-blad-tytul')")) {
      ok(false, opis + ': wysyłka zakończona sukcesem', await b.ocen("document.getElementById('gov-wynik').textContent"));
      return -1;
    }
    ok(await b.ocen("document.activeElement.id === 'gov-wynik-tytul' && document.getElementById('gov-wysylka').getAttribute('aria-busy') === 'false'"),
      opis + ': potwierdzenie z fokusem, aria-busy=false');
    ok(await b.ocen("document.querySelector('.gov-potwierdzenie').getAttribute('role') === 'status' && document.getElementById('gov-status').textContent === 'zatwierdzono_gov' && document.getElementById('gov-numer').textContent.trim().length > 0"),
      opis + ': numer zgłoszenia i status „zatwierdzono_gov”');
    return Number((await b.ocen("document.getElementById('gov-liczba').textContent")).replace(/\D/g, ''));
  }

  async function pobierzBaze(opis) {
    // Chrome nadpisuje plik o tej samej nazwie – czyścimy katalog, by wykryć nowe pobranie
    if (fs.existsSync(t.pobrane)) fs.readdirSync(t.pobrane).forEach(function (f) { fs.rmSync(path.join(t.pobrane, f), { force: true }); });
    const przed = [];
    // prawdziwy klawisz (nie click()) – Chrome dopuszcza kolejne pobranie z tej samej strony tylko po działaniu użytkownika
    await b.ocen("document.getElementById('gov-pobierz').focus()");
    await b.klawisz('Enter');
    let plik = null;
    for (let i = 0; i < 60 && !plik; i++) {
      await b.pauza(150);
      if (fs.existsSync(t.pobrane)) plik = fs.readdirSync(t.pobrane).find(function (f) { return /^wyniki.*\.gov$/.test(f) && przed.indexOf(f) < 0; }) || null;
    }
    ok(!!plik, opis + ': pobrano plik wyniki.gov', plik || { pliki: fs.existsSync(t.pobrane) ? fs.readdirSync(t.pobrane) : [], stan: await b.ocen("(document.getElementById('gov-pobierz-stan') || {}).textContent + ' | ' + document.activeElement.id") });
    if (plik) {
      await b.pauza(200);
      const naglowek = fs.readFileSync(path.join(t.pobrane, plik)).subarray(0, 16).toString('latin1');
      ok(naglowek === 'SQLite format 3\u0000', opis + ': plik zaczyna się od „SQLite format 3”', naglowek);
    }
  }

  const tryb = await b.ocen('AED.gov.tryb()');
  ok(atrapa || tryb === (t.api ? 'serwer' : 'przegladarka'), 'tryb bazy: ' + tryb + (t.api ? ' (serwer.py z API)' : ''), tryb);
  const n1 = await wyslij('1. wysyłka');
  ok(n1 === 1, '1. wysyłka: w pliku wyniki.gov jest 1 zgłoszenie', n1);
  ok(await b.ocen("!!document.querySelector('#gov-wynik .gov-stat') && /wyniki\\.gov/.test(document.getElementById('gov-tryb').textContent)"),
    'mini-statystyki bazy i informacja o trybie');
  const n2 = await wyslij('2. wysyłka');
  ok(n2 === 2, '2. wysyłka: liczba zgłoszeń rośnie do 2', n2);
  ok(await b.ocen("document.querySelectorAll('#gov-wynik table tbody tr').length === 2"), 'tabela ostatnich zgłoszeń ma 2 wiersze');
  // wyjście z kroku 4 w trakcie symulacji: wysyłka przerwana, nic nie zapisano, komunikat po powrocie
  await b.ocen("document.getElementById('gov-wyslij').click(); true");
  await b.czekaj("document.getElementById('gov-wysylka').getAttribute('aria-busy') === 'true'", 5000);
  await b.ocen("location.hash = '#walidacja'; true");
  await b.czekaj("location.hash === '#walidacja'");
  await b.pauza(300);
  await b.ocen("location.hash = '#wynik'; true");
  await b.czekaj("!!document.getElementById('gov-blad-tytul')", 10000);
  ok(await b.ocen("/przerwana/i.test(document.getElementById('gov-blad-tytul').textContent) && /Nic nie zapisano/.test(document.getElementById('gov-wynik').textContent) && document.getElementById('gov-wysylka').getAttribute('aria-busy') === 'false'"),
    'wyjście z kroku 4 przerywa wysyłkę; po powrocie komunikat „Wysyłka przerwana”');
  ok((await b.ocen('AED.gov.statystyki().then(function (s) { return s.liczba; })')) === 2, 'przerwana wysyłka niczego nie zapisała (nadal 2)');
  const n3 = await wyslij('3. wysyłka (po przerwaniu)');
  ok(n3 === 3, 'po przerwaniu można wysłać ponownie – liczba 3', n3);
  await pobierzBaze('tryb ' + tryb);
  if (t.api && !atrapa) ok(fs.existsSync(t.plikBazy) && fs.statSync(t.plikBazy).size > 0, 'serwer zapisał bazę w pliku tymczasowym', t.plikBazy);

  // 320 px
  await b.szerokosc(320);
  await b.pauza(300);
  const w = await b.ocen('document.documentElement.scrollWidth');
  ok(w <= 320, '320 px – sekcja wysyłki bez przewijania w poziomie', w);
  await t.zrzut('gov-320');
  await b.szerokosc(1280);

  // ---- tryb przeglądarkowy (sql.js + IndexedDB) – bez API serwera
  if (!atrapa && await b.ocen('typeof AED.gov.konfiguruj === "function"')) {
    await b.ocen("AED.gov.konfiguruj({ tryb: 'przegladarka' }); AED.ui.gov.stan.tryb = null; AED.ui.gov.stan.wynik = null; document.getElementById('gov-tresc').textContent = ''; AED.ui.gov.renderuj(); true");
    await b.czekaj("document.getElementById('gov-wyslij').getAttribute('aria-disabled') !== 'true'");
    const p1 = await wyslij('przeglądarka');
    ok(p1 === 1, 'przeglądarka: osobna baza w tej przeglądarce – 1 zgłoszenie', p1);
    ok(await b.ocen("/przeglądarka/.test(document.getElementById('gov-tryb').textContent) && typeof initSqlJs === 'function'"), 'przeglądarka: sql.js wczytany leniwie, opis trybu');
    await pobierzBaze('tryb przeglądarki');
    await b.ocen("AED.gov.konfiguruj({ tryb: null }); true");
  }
  await t.zrzut('gov');
};
