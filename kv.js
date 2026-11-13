// Guardado pequeño en el aparato (IndexedDB): datos de la última lectura, cambios pendientes y conexión.
// Lo usan la página y, en el teléfono, el service worker (para subir aunque la app esté cerrada).
var KV = (function () {
  var DB = 'registro-paul', ST = 'kv', memoria = {};
  function abrir() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function get(k) {
    return abrir().then(function (db) {
      return new Promise(function (res, rej) {
        var g = db.transaction(ST, 'readonly').objectStore(ST).get(k);
        g.onsuccess = function () { res(g.result); };
        g.onerror = function () { rej(g.error); };
      });
    }).catch(function () { return memoria[k]; });
  }
  function set(k, v) {
    memoria[k] = v;
    return abrir().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(ST, 'readwrite');
        t.objectStore(ST).put(v, k);
        t.oncomplete = function () { res(); };
        t.onerror = function () { rej(t.error); };
      });
    }).catch(function () {});
  }
  return { get: get, set: set };
})();

// Conexión del teléfono con el programita de la hoja (Apps Script).
var Telefono = {
  llamar: function (cfg, cuerpo) {
    cuerpo.clave = cfg.clave;
    return fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // así el navegador no pide permiso previo
      body: JSON.stringify(cuerpo)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) { var e = new Error(j.error || 'error'); e.code = j.error === 'clave' ? 'clave' : 'hoja'; throw e; }
      return j;
    });
  },
  // Sube los cambios pendientes y los quita de la lista. Lo usa el service worker.
  subirPendientes: function () {
    return Promise.all([KV.get('servidor'), KV.get('pend')]).then(function (r) {
      var cfg = r[0], pend = r[1] || [];
      if (!cfg || !cfg.url || !pend.length) return 0;
      return Telefono.llamar(cfg, { accion: 'escribir', ops: pend }).then(function (j) {
        var hechos = {};
        j.hechos.forEach(function (id) { hechos[id] = 1; });
        return KV.get('pend').then(function (actual) {
          return KV.set('pend', (actual || []).filter(function (o) { return !hechos[o.opId]; }));
        }).then(function () { return j.hechos.length; });
      });
    });
  }
};
