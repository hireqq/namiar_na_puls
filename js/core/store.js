/* Stan aplikacji: rejestr źródeł danych i rekordy po mapowaniu.
   Źródło = { id, kod, nazwa, typ, dysponent, licencja, priorytet, kolumny[], wiersze[], meta{}, dataPobrania, mapowanie? }
   Rekord = wynik AED.mapowanie.zastosuj: pola wzorca + _id, _zrodlo, _kodZrodla, _wiersz, _surowy, _naprawy,
            _poprawione (lista pól poprawionych ręcznie), _oryginal ({pole: wartość przed ręczną poprawką}).
   Zmiany ogłaszane zdarzeniami 'zrodla:zmiana' i 'rekordy:zmiana'. */
(function (AED) {
  'use strict';

  const state = {
    zrodla: [], licznik: { PLIK: 0, OSM: 0, DGP: 0, FORMULARZ: 0 },
    rekordy: [], indeks: new Map(),   // _id -> rekord
    poprawki: new Map()               // _id -> { odcisk, pola: { pole: wartość wpisana ręcznie } } – przetrwa przelicz()
  };

  // Domyślny priorytet z rejestru źródeł we wzorcu (1 = najwyższy)
  const PRIORYTET = { PLIK: 1, DGP: 1, FORMULARZ: 2, OSM: 3 };
  const TYP_OPIS = { PLIK: 'plik lokalny', DGP: 'zbiór dane.gov.pl', OSM: 'OpenStreetMap', FORMULARZ: 'formularz' };

  function nowyKod(typ) {
    state.licznik[typ] = (state.licznik[typ] || 0) + 1;
    return typ + '-' + String(state.licznik[typ]).padStart(2, '0');
  }

  /** Nałożenie zapamiętanych ręcznych poprawek na świeżo zbudowany rekord. */
  const WSP = { szerokosc_geograficzna: 1, dlugosc_geograficzna: 1 };

  function nalozPoprawki(r) {
    const zapis = state.poprawki.get(r._id);
    // poprawka należy do wiersza o tej samej treści – po podmianie wierszy źródła (inny plik, arkusz) nie przechodzi na obcy rekord
    if (!zapis || (zapis.odcisk && r._odcisk && zapis.odcisk !== r._odcisk)) return r;
    const p = zapis.pola;
    r._oryginal = {};
    Object.keys(p).forEach(function (pole) {
      r._oryginal[pole] = r[pole] === undefined ? null : r[pole];
      r[pole] = p[pole];
      if (WSP[pole]) delete r._precyzja; // precyzja z tekstu źródła nie dotyczy wpisanej wartości
    });
    r._poprawione = Object.keys(p);
    return r;
  }

  AED.store = {
    TYP_OPIS: TYP_OPIS,

    get zrodla() { return state.zrodla.slice(); },

    zrodlo(id) { return state.zrodla.find(function (z) { return z.id === id; }) || null; },

    dodajZrodlo(dane) {
      const typ = dane.typ || 'PLIK';
      const z = Object.assign({
        id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
        kod: nowyKod(typ),
        typ: typ,
        nazwa: '',
        dysponent: '',
        licencja: '',
        priorytet: PRIORYTET[typ] || 2,
        kolumny: [],
        wiersze: [],
        meta: {},
        dataPobrania: new Date().toISOString().slice(0, 19)
      }, dane);
      state.zrodla.push(z);
      AED.emit('zrodla:zmiana', { akcja: 'dodano', zrodlo: z });
      return z;
    },

    aktualizujZrodlo(id, zmiany) {
      const z = this.zrodlo(id);
      if (!z) return null;
      Object.assign(z, zmiany);
      AED.emit('zrodla:zmiana', { akcja: 'zmieniono', zrodlo: z, pola: Object.keys(zmiany) });
      return z;
    },

    usunZrodlo(id) {
      const i = state.zrodla.findIndex(function (z) { return z.id === id; });
      if (i < 0) return null;
      const [z] = state.zrodla.splice(i, 1);
      AED.emit('zrodla:zmiana', { akcja: 'usunieto', zrodlo: z });
      // rekordy usuniętego źródła znikają od razu
      // ręczne poprawki i nadane ID tego źródła przestają obowiązywać
      const pref = id + ':';
      Array.from(state.poprawki.keys()).forEach(function (k) { if (k.indexOf(pref) === 0) state.poprawki.delete(k); });
      if (AED.mapowanie && AED.mapowanie.zapomnij) AED.mapowanie.zapomnij(id);
      if (state.rekordy.some(function (r) { return r._zrodlo === id; })) {
        this.ustawRekordy(state.rekordy.filter(function (r) { return r._zrodlo !== id; }));
      }
      return z;
    },

    get liczbaRekordow() {
      return state.zrodla.reduce(function (s, z) { return s + z.wiersze.length; }, 0);
    },

    // ------------------------------------------------ mapowanie i rekordy (część 3)

    /** Zapisuje mapowanie źródła (null = wróć do podpowiedzi automatycznej). */
    ustawMapowanie(idZrodla, mapowanie) {
      const z = this.zrodlo(idZrodla);
      if (!z) return null;
      z.mapowanie = mapowanie || null;
      AED.emit('zrodla:zmiana', { akcja: 'zmieniono', zrodlo: z, pola: ['mapowanie'] });
      return z;
    },

    /** UWAGA: zwraca KOPIĘ tablicy (O(n)) – w pętlach używaj liczbaRekordowWynik albo rekord(id). */
    get rekordy() { return state.rekordy.slice(); },

    /** Liczba rekordów po mapowaniu (bez kopiowania tablicy). */
    get liczbaRekordowWynik() { return state.rekordy.length; },

    rekord(id) { return state.indeks.get(id) || null; },

    ustawRekordy(rekordy) {
      state.rekordy = (rekordy || []).slice();
      state.indeks = new Map();
      state.rekordy.forEach(function (r) { state.indeks.set(r._id, r); });
      AED.emit('rekordy:zmiana', { akcja: 'ustawiono', liczba: state.rekordy.length });
      return state.rekordy.length;
    },

    /** Ręczna poprawka pól rekordu (pola zaczynające się od „_” są pomijane). Poprawka przetrwa przelicz(). */
    aktualizujRekord(rekordId, zmiany) {
      const r = state.indeks.get(rekordId);
      if (!r) return null;
      const zapis = state.poprawki.get(rekordId) || { odcisk: r._odcisk || null, pola: {} };
      const p = zapis.pola;
      r._oryginal = r._oryginal || {};
      Object.keys(zmiany || {}).forEach(function (pole) {
        if (pole[0] === '_') return;
        if (!Object.prototype.hasOwnProperty.call(r._oryginal, pole)) r._oryginal[pole] = r[pole] === undefined ? null : r[pole];
        r[pole] = zmiany[pole];
        p[pole] = zmiany[pole];
        if (WSP[pole]) delete r._precyzja;
      });
      state.poprawki.set(rekordId, zapis);
      r._poprawione = Object.keys(p);
      AED.emit('rekordy:zmiana', { akcja: 'zmieniono', rekord: r, pola: Object.keys(zmiany || {}) });
      return r;
    },

    /** Cofnięcie ręcznej poprawki jednego pola (albo wszystkich, gdy pole nie podane). */
    cofnijPoprawke(rekordId, pole) {
      const r = state.indeks.get(rekordId);
      const zapis = state.poprawki.get(rekordId);
      if (!r || !zapis) return null;
      const p = zapis.pola;
      const pola = pole ? [pole] : Object.keys(p);
      pola.forEach(function (k) {
        if (!Object.prototype.hasOwnProperty.call(p, k)) return;
        delete p[k];
        if (r._oryginal && Object.prototype.hasOwnProperty.call(r._oryginal, k)) { r[k] = r._oryginal[k]; delete r._oryginal[k]; }
      });
      if (!Object.keys(p).length) { state.poprawki.delete(rekordId); delete r._poprawione; delete r._oryginal; } else r._poprawione = Object.keys(p);
      AED.emit('rekordy:zmiana', { akcja: 'zmieniono', rekord: r, pola: pola });
      return r;
    },

    /** Mapowanie (zapisane albo automatyczne) -> rekordy dla wszystkich źródeł; zachowuje ręczne poprawki.
        @returns {{rekordy:number, zrodla:Object<string,{rekordy,naprawy,puste}>}} – podsumowania wg kodu źródła */
    przelicz() {
      const wszystkie = [];
      const podsumowania = {};
      state.zrodla.forEach(function (z) {
        const m = z.mapowanie || AED.mapowanie.podpowiedz(z);
        const w = AED.mapowanie.zastosuj(z, m);
        w.rekordy.forEach(function (r) { wszystkie.push(nalozPoprawki(r)); });
        podsumowania[z.kod] = w.podsumowanie;
      });
      this.ustawRekordy(wszystkie);
      return { rekordy: wszystkie.length, zrodla: podsumowania };
    }
  };
})(window.AED);
