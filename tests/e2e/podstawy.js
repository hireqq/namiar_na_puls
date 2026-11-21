/* Podstawy: wczytanie bibliotek, klawiatura (link „Przejdź do treści”, menu), 320 px bez przewijania w poziomie. */
'use strict';
module.exports = async function (t) {
  const { b, adres, ok } = t;
  await b.czekaj("document.readyState === 'complete' && !!window.AED && !!AED.router");
  ok(await b.ocen("typeof Papa !== 'undefined' && typeof XLSX !== 'undefined' && typeof L !== 'undefined' && L.version === '1.9.4'"),
    'biblioteki wczytane (PapaParse, SheetJS, Leaflet 1.9.4)');
  ok(await b.ocen("!!(AED.ui.mapa && AED.ui.formularz && AED.ui.wynik && AED.ui.duplikaty)"), 'moduły interfejsu wczytane');
  ok(await b.ocen("!/openstreetmap|overpass|odbl/i.test(document.documentElement.outerHTML)"), 'strona nie wspomina OpenStreetMap / Overpass / ODbL');

  // klawiatura: pierwszy Tab – link „Przejdź do treści”, Enter – fokus na nagłówku ekranu
  await b.ocen("document.activeElement && document.activeElement.blur(); window.scrollTo(0,0); true");
  await b.klawisz('Tab');
  ok(await b.ocen("document.activeElement.classList.contains('skip-link')"), 'pierwszy Tab: link „Przejdź do treści”',
    await b.ocen("document.activeElement.outerHTML.slice(0,80)"));
  await b.klawisz('Enter');
  ok(await b.ocen("document.activeElement.id === 'h-start'"), 'Enter na linku przenosi fokus na nagłówek H1', await b.ocen('document.activeElement.id'));
  // Tab dalej prowadzi do elementów treści (kolejność zgodna z układem)
  await b.klawisz('Tab');
  ok(await b.ocen("!!document.activeElement.closest('main')"), 'kolejny Tab – element w treści głównej');

  // menu: przejście do formularza z klawiatury
  await b.ocen("document.querySelector('.top-nav a[href=\"#formularz\"]').focus()");
  await b.klawisz('Enter');
  await b.czekaj("location.hash === '#formularz' && document.activeElement.id === 'h-formularz'");
  ok(true, 'menu główne działa z klawiatury, fokus na H1 formularza');

  // krok 1: karta formularza prowadzi do #formularz, bez zaślepki „część 5”
  await b.idz(adres + 'index.html#zrodla');
  ok(await b.ocen("!!document.querySelector('#zrodla, section[data-route=zrodla]') && !!document.querySelector('section[data-route=zrodla] a[href=\"#formularz\"]')"),
    'krok 1: karta „Formularz” ma link do formularza');
  ok(await b.ocen("!/Dostępne w części 5/.test(document.body.textContent)"), 'krok 1: brak odznaki „Dostępne w części 5”');

  // 320 px (WCAG 1.4.10) na ekranach bez danych
  await b.szerokosc(320);
  for (const trasa of ['start', 'zrodla', 'formularz']) {
    await b.ocen("location.hash = '#" + trasa + "'; true");
    await b.pauza(250);
    const w = await b.ocen('document.documentElement.scrollWidth');
    ok(w <= 320, '320 px – ekran „' + trasa + '” bez przewijania w poziomie', w);
  }
  await t.zrzut('formularz-320');
  await b.szerokosc(1280);
};
