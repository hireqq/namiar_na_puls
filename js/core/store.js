/* Stan aplikacji: rejestr źródeł danych.
   Źródło = { id, kod, nazwa, typ, dysponent, licencja, priorytet, kolumny[], wiersze[], meta{}, dataPobrania }
   Zmiany ogłaszane zdarzeniem 'zrodla:zmiana'. */
(function (AED) {
  'use strict';

  const state = { zrodla: [], licznik: { PLIK: 0, OSM: 0, DGP: 0, FORMULARZ: 0 } };

  // Domyślny priorytet z rejestru źródeł we wzorcu (1 = najwyższy)
  const PRIORYTET = { PLIK: 1, DGP: 1, FORMULARZ: 2, OSM: 3 };
  const TYP_OPIS = { PLIK: 'plik lokalny', DGP: 'zbiór dane.gov.pl', OSM: 'OpenStreetMap', FORMULARZ: 'formularz' };

  function nowyKod(typ) {
    state.licznik[typ] = (state.licznik[typ] || 0) + 1;
    return typ + '-' + String(state.licznik[typ]).padStart(2, '0');
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
      return z;
    },

    get liczbaRekordow() {
      return state.zrodla.reduce(function (s, z) { return s + z.wiersze.length; }, 0);
    }
  };
})(window.AED);
