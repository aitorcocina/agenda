/* AM · Agenda personal de Aitor */
(function () {
  'use strict';
  var VERSION = '1.0.0';
  var SUPA = 'https://bzjzedwbahgitunoksps.supabase.co';
  var KEY = 'sb_publishable_GwXGrJorusdd94VeHBH4Lg_C657Knj5';
  var VAPID = 'BFAca9d8b3HvZyWwM7kfq1yLbGTVAV5Gw3O8giHDvVRE8X4LePR9bLKK095mwSwaLbygZDu-2jqP5PW3Fm5XF_E';
  var DEMO = /[?&]demo\b/.test(location.search); // vista previa sin servidor

  // ---------- categorías ----------
  var CAT = {
    salud:   { n: 'Salud',   cb: '#D7F1E5', ct: '#2F8B66', c: '#55B88F', e: '🩺' },
    familia: { n: 'Familia', cb: '#FBDCE7', ct: '#B53F69', c: '#E77A9F', e: '💛' },
    casa:    { n: 'Casa',    cb: '#FDE3D3', ct: '#B8602D', c: '#F0A274', e: '🏠' },
    papeleo: { n: 'Papeleo', cb: '#E8E0FC', ct: '#6545C4', c: '#9C84E8', e: '📄' },
    coche:   { n: 'Coche',   cb: '#F7ECCD', ct: '#94701A', c: '#DDB549', e: '🚗' },
    futbol:  { n: 'Fútbol',  cb: '#D9E8FB', ct: '#2F67B3', c: '#6EA2E6', e: '⚽' },
    otros:   { n: 'Otros',   cb: '#EEEBF2', ct: '#6B6380', c: '#B7AFC4', e: '📌' }
  };
  var AV_HORA = [[0, 'A la hora'], [10, '10 min'], [30, '30 min'], [60, '1 hora'], [120, '2 horas'], [1440, '1 día'], [2880, '2 días'], [10080, '1 semana']];
  var AV_DIA = [[0, 'Ese día, 9:00'], [780, 'El día antes, 20:00'], [9420, 'Una semana antes']];
  var REP = [['no', 'No se repite'], ['diario', 'Cada día'], ['semanal', 'Cada semana'], ['mensual', 'Cada mes'], ['anual', 'Cada año']];
  var DSEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // ---------- utilidades ----------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function aFecha(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function hoyD() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function difDias(a, b) { return Math.round((aFecha(a) - aFecha(b)) / 864e5); }
  function hhmm(h) { return h ? h.slice(0, 5) : ''; }
  function uid() { return (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); })); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fechaLarga(s) {
    var d = aFecha(s), dd = difDias(s, ymd(hoyD()));
    var base = DSEM[d.getDay()] + ' ' + d.getDate() + ' de ' + MES[d.getMonth()];
    if (dd === 0) return 'Hoy, ' + base; if (dd === 1) return 'Mañana, ' + base; if (dd === -1) return 'Ayer, ' + base;
    if (d.getFullYear() !== hoyD().getFullYear()) base += ' de ' + d.getFullYear();
    return cap(base);
  }
  function fechaCorta(s) {
    var d = aFecha(s), dd = difDias(s, ymd(hoyD()));
    if (dd === 0) return 'Hoy'; if (dd === 1) return 'Mañana'; if (dd === -1) return 'Ayer';
    return cap(DSEM[d.getDay()].slice(0, 3)) + ' ' + d.getDate() + ' ' + MES[d.getMonth()].slice(0, 3);
  }
  function avTexto(min, conHora) {
    var l = (conHora ? AV_HORA : AV_DIA).filter(function (a) { return a[0] === min; })[0];
    if (l) return l[1];
    if (min % 1440 === 0) return (min / 1440) + ' días'; if (min % 60 === 0) return (min / 60) + ' h'; return min + ' min';
  }

  // ---------- almacenamiento local ----------
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  var llave = null;
  (function () {
    var m = /[?&]k=([^&]+)/.exec(location.search);
    if (m) ls('am_llave', decodeURIComponent(m[1]));
    llave = ls('am_llave');
  })();
  var items = ls('am_items') || [];
  var cola = ls('am_cola') || [];   // operaciones pendientes si no hay red
  var ajustes = ls('am_ajustes') || { avisosCita: [1440, 60] };
  function guardaLocal() { ls('am_items', items); }

  // ---------- servidor ----------
  function api(path, opt) {
    opt = opt || {};
    var h = { apikey: KEY, 'x-agenda-key': llave || '', 'Content-Type': 'application/json' };
    if (opt.prefer) h.Prefer = opt.prefer;
    return fetch(SUPA + '/rest/v1/' + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined })
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { var e = new Error(t || r.status); e.status = r.status; throw e; });
        return r.status === 204 ? null : r.text().then(function (t) { return t ? JSON.parse(t) : null; });
      });
  }
  function limpio(it) {
    return { id: it.id, tipo: it.tipo, titulo: it.titulo || '', notas: it.notas || '', fecha: it.fecha || null, hora: it.hora || null,
      categoria: it.categoria || null, avisos: it.avisos || [], repetir: it.repetir || 'no', hecho: !!it.hecho,
      hecho_at: it.hecho_at || null, fijada: !!it.fijada, updated_at: new Date().toISOString() };
  }
  function encola(op) { if (DEMO) return; cola.push(op); ls('am_cola', cola); vaciaCola(); }
  var vaciando = false;
  function vaciaCola() {
    if (vaciando || !cola.length || !llave || DEMO) return;
    vaciando = true;
    var op = cola[0], p;
    if (op.t === 'up') {
      var it = items.filter(function (x) { return x.id === op.id; })[0];
      p = it ? api('agenda_items?on_conflict=id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: [limpio(it)] })
        .then(function () { return sincAvisos(it); }) : Promise.resolve();
    } else if (op.t === 'del') {
      p = api('agenda_items?id=eq.' + op.id, { method: 'DELETE' });
    } else p = Promise.resolve();
    p.then(function () { cola.shift(); ls('am_cola', cola); vaciando = false; vaciaCola(); })
      .catch(function (e) {
        vaciando = false;
        if (e.status && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 408 && e.status !== 429) { cola.shift(); ls('am_cola', cola); console.warn(e); vaciaCola(); }
        else setTimeout(vaciaCola, 15000);
      });
  }
  window.addEventListener('online', vaciaCola);

  function cargar() {
    if (DEMO || !llave) return Promise.resolve();
    return api('agenda_items?select=*&order=fecha.asc.nullslast,hora.asc.nullsfirst').then(function (rows) {
      var pendientes = {}; cola.forEach(function (o) { pendientes[o.id] = 1; });
      var locales = items.filter(function (x) { return pendientes[x.id]; });
      items = rows.filter(function (r) { return !pendientes[r.id]; }).concat(locales);
      items.forEach(function (it) { it.hora = it.hora ? it.hora.slice(0, 5) : null; });
      guardaLocal(); pinta(); refrescaRepetidos();
    }).catch(function (e) { if (e.status === 401 || e.status === 403) toast('La llave no vale'); });
  }

  // ---------- avisos (se calculan aquí y el servidor los envía) ----------
  function siguiente(d, rep) {
    var x = new Date(d);
    if (rep === 'diario') x.setDate(x.getDate() + 1);
    else if (rep === 'semanal') x.setDate(x.getDate() + 7);
    else if (rep === 'mensual') x.setMonth(x.getMonth() + 1);
    else if (rep === 'anual') x.setFullYear(x.getFullYear() + 1);
    return x;
  }
  function momentos(it) {
    if (!it.fecha || it.hecho || !it.avisos || !it.avisos.length || it.tipo === 'nota' || it.tipo === 'compra') return [];
    var ahora = Date.now(), hasta = ahora + (it.repetir === 'anual' || it.repetir === 'mensual' ? 400 : 120) * 864e5;
    var hm = (it.hora || '09:00').split(':');
    var occ = new Date(aFecha(it.fecha).getTime()); occ.setHours(+hm[0], +hm[1], 0, 0);
    var out = [], guard = 0;
    while (occ.getTime() - 0 <= hasta + 10080 * 6e4 && guard++ < 400) {
      it.avisos.forEach(function (mn) {
        var f = occ.getTime() - mn * 6e4;
        if (f > ahora - 60e3 && f <= hasta) out.push({ fire: new Date(f), occ: new Date(occ) });
      });
      if (!it.repetir || it.repetir === 'no') break;
      occ = siguiente(occ, it.repetir);
    }
    return out;
  }
  function textoAviso(it, fire, occ) {
    var dF = ymd(fire), dO = ymd(occ), dd = difDias(dO, dF);
    var cuando = dd === 0 ? 'Hoy' : dd === 1 ? 'Mañana' : cap(DSEM[occ.getDay()]) + ' ' + occ.getDate();
    if (it.hora) {
      var mins = Math.round((occ - fire) / 6e4);
      cuando += ' a las ' + it.hora;
      if (mins > 0 && mins < 180) cuando = (mins < 60 ? 'En ' + mins + ' min' : 'En ' + (mins / 60 === 1 ? '1 hora' : (mins / 60) + ' horas')) + ' · ' + it.hora;
      if (mins === 0) cuando = 'Ahora · ' + it.hora;
    }
    var c = CAT[it.categoria] || null;
    return { titulo: (c ? c.e + ' ' : (it.tipo === 'tarea' ? '✅ ' : '🗓️ ')) + it.titulo, cuerpo: cuando + (it.notas ? ' · ' + it.notas.split('\n')[0].slice(0, 80) : '') };
  }
  function sincAvisos(it) {
    var b = api('agenda_avisos?item_id=eq.' + it.id + '&enviado=is.false', { method: 'DELETE' });
    var lista = momentos(it).map(function (m) { var t = textoAviso(it, m.fire, m.occ); return { item_id: it.id, fire_at: m.fire.toISOString(), titulo: t.titulo, cuerpo: t.cuerpo }; });
    return b.then(function () {
      if (!lista.length) return;
      return api('agenda_avisos?on_conflict=item_id,fire_at', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: lista });
    });
  }
  function refrescaRepetidos() {
    var ult = ls('am_refresco') || 0;
    if (Date.now() - ult < 864e5) return;
    ls('am_refresco', Date.now());
    items.filter(function (i) { return i.repetir && i.repetir !== 'no' && !i.hecho; }).forEach(function (i) { encola({ t: 'up', id: i.id }); });
  }

  // ---------- operaciones ----------
  function guardar(it) {
    var i = items.findIndex(function (x) { return x.id === it.id; });
    if (i >= 0) items[i] = it; else items.push(it);
    guardaLocal(); pinta(); encola({ t: 'up', id: it.id });
  }
  function borrar(it) {
    items = items.filter(function (x) { return x.id !== it.id; });
    guardaLocal(); pinta(); encola({ t: 'del', id: it.id });
    toast('Borrado', function () { guardar(it); });
  }
  function alternarHecho(it) {
    if (!it.hecho && it.repetir && it.repetir !== 'no' && it.fecha) {
      // repetido: pasa a la siguiente vez
      var n = siguiente(aFecha(it.fecha), it.repetir); var antes = it.fecha;
      it.fecha = ymd(n); guardar(it);
      toast('Hecho. Próxima: ' + fechaCorta(it.fecha).toLowerCase(), function () { it.fecha = antes; guardar(it); });
      return;
    }
    it.hecho = !it.hecho; it.hecho_at = it.hecho ? new Date().toISOString() : null;
    guardar(it);
    if (it.hecho) toast(it.tipo === 'compra' ? 'Al carro' : 'Hecho', function () { it.hecho = false; it.hecho_at = null; guardar(it); });
  }
  function nuevo(datos) {
    var it = Object.assign({ id: uid(), tipo: 'tarea', titulo: '', notas: '', fecha: null, hora: null, categoria: null, avisos: [], repetir: 'no', hecho: false, fijada: false, created_at: new Date().toISOString() }, datos);
    if (!it.avisos || !it.avisos.length) it.avisos = avisosPorDefecto(it);
    return it;
  }
  function avisosPorDefecto(it) {
    if (!it.fecha || it.tipo === 'nota' || it.tipo === 'compra') return [];
    if (it.tipo === 'cita') return it.hora ? ajustes.avisosCita.slice() : [780];
    return it.hora ? [0] : [0];
  }

  // ---------- toast ----------
  var tT;
  function toast(msg, deshacer) {
    var t = $('#toast'); $('span', t).textContent = msg;
    var b = $('button', t); b.classList.toggle('hide', !deshacer);
    b.onclick = function () { t.classList.remove('on'); if (deshacer) deshacer(); };
    t.classList.add('on'); clearTimeout(tT); tT = setTimeout(function () { t.classList.remove('on'); }, deshacer ? 4500 : 2500);
  }

  // ---------- pintar ----------
  var vista = 'hoy', calMes = new Date(hoyD().getFullYear(), hoyD().getMonth(), 1), calSel = ymd(hoyD());

  function tarjeta(it, opt) {
    opt = opt || {};
    var c = CAT[it.categoria] || null;
    var color = c ? c.c : (it.tipo === 'cita' ? '#A893E8' : '#C9C1D6');
    var meta = [];
    if (opt.conFecha && it.fecha) meta.push('<span class="chip"><svg class="i"><use href="#i-fecha"/></svg>' + fechaCorta(it.fecha) + '</span>');
    if (c) meta.push('<span class="chip" style="--cb:' + c.cb + ';--ct:' + c.ct + '">' + c.n + '</span>');
    if (it.repetir && it.repetir !== 'no') meta.push('<span class="chip"><svg class="i"><use href="#i-repetir"/></svg>' + REP.filter(function (r) { return r[0] === it.repetir; })[0][1] + '</span>');
    if (it.avisos && it.avisos.length && it.fecha && !it.hecho) meta.push('<span class="chip"><svg class="i"><use href="#i-campana"/></svg>' + it.avisos.map(function (a) { return avTexto(a, !!it.hora); }).join(', ') + '</span>');
    var izq = it.tipo === 'cita'
      ? '<div class="barra"></div><div class="hora">' + (it.hora ? hhmm(it.hora) : '<small>Todo<br>el día</small>') + '</div>'
      : '<button class="check" data-check="' + it.id + '" aria-label="Hecho"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>';
    return '<div class="item' + (it.hecho ? ' hecho' : '') + '" style="--c:' + color + '" data-id="' + it.id + '">' + izq +
      '<div class="cuerpo"><div class="tit">' + esc(it.titulo) + '</div>' + (meta.length ? '<div class="meta">' + meta.join('') + '</div>' : '') +
      (it.notas && opt.notas ? '<div class="sub" style="font-size:13px;margin-top:4px">' + esc(it.notas.split('\n')[0]) + '</div>' : '') + '</div></div>';
  }
  function ordenar(a, b) {
    var fa = a.fecha || '9999', fb = b.fecha || '9999';
    if (fa !== fb) return fa < fb ? -1 : 1;
    var ha = a.hora || (a.tipo === 'cita' ? '00:00' : '99'), hb = b.hora || (b.tipo === 'cita' ? '00:00' : '99');
    return ha < hb ? -1 : ha > hb ? 1 : 0;
  }
  // ocurrencias de repetidos dentro de un rango (para calendario y próximos días)
  function enDia(it, dia) {
    if (!it.fecha || it.tipo === 'nota' || it.tipo === 'compra') return false;
    if (it.fecha === dia) return true;
    if (!it.repetir || it.repetir === 'no' || dia < it.fecha) return false;
    var a = aFecha(it.fecha), d = aFecha(dia);
    if (it.repetir === 'diario') return true;
    if (it.repetir === 'semanal') return a.getDay() === d.getDay();
    if (it.repetir === 'mensual') return a.getDate() === d.getDate();
    if (it.repetir === 'anual') return a.getDate() === d.getDate() && a.getMonth() === d.getMonth();
    return false;
  }
  function delDia(dia) { return items.filter(function (it) { return enDia(it, dia) && !(it.tipo === 'tarea' && it.hecho && it.fecha !== dia); }).sort(ordenar); }

  var diaSel = ymd(hoyD());
  function emoji(it) { var c = CAT[it.categoria]; return c ? c.e : (it.tipo === 'cita' ? '🗓️' : '✏️'); }
  function colorDe(it) { var c = CAT[it.categoria]; return c ? c.c : (it.tipo === 'cita' ? '#A893E8' : '#C9C1D6'); }
  function fondoDe(it) { var c = CAT[it.categoria]; return c ? c.cb : (it.tipo === 'cita' ? '#ECE5FD' : '#F1EEF4'); }
  function hm(s) { var p = s.split(':'); return +p[0] * 60 + +p[1]; }
  function durTxt(min) { var h = Math.floor(min / 60), m = min % 60; return h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min'; }
  function metaDe(it) {
    var meta = [], c = CAT[it.categoria];
    if (c) meta.push('<span class="chip" style="--cb:' + c.cb + ';--ct:' + c.ct + '">' + c.n + '</span>');
    if (it.repetir && it.repetir !== 'no') meta.push('<span class="chip"><svg class="i"><use href="#i-repetir"/></svg>' + REP.filter(function (r) { return r[0] === it.repetir; })[0][1] + '</span>');
    if (it.avisos && it.avisos.length && it.fecha && !it.hecho) meta.push('<span class="chip"><svg class="i"><use href="#i-campana"/></svg>' + it.avisos.map(function (a) { return avTexto(a, !!it.hora); }).join(', ') + '</span>');
    return meta.length ? '<div class="meta">' + meta.join('') + '</div>' : '';
  }
  // línea del día: sin hora arriba, luego las horas con la marca de "ahora" y los huecos libres
  function lineaDia(dia) {
    var l = delDia(dia), hoy = ymd(hoyD()), esHoy = dia === hoy;
    if (!l.length) return '<div class="vacio">' + (esHoy ? 'Nada para hoy. Día libre.' : 'Día libre') + '</div>';
    var ahora = new Date(), mAhora = ahora.getHours() * 60 + ahora.getMinutes();
    var sinHora = l.filter(function (i) { return !i.hora; }), conHora = l.filter(function (i) { return i.hora; });
    function fila(it, hh) {
      var pasado = esHoy && it.hora && hm(it.hora) < mAhora || dia < hoy;
      var bur = it.tipo === 'tarea'
        ? '<button class="burbuja bur-check' + (it.hecho ? ' hecho' : '') + '" style="--cb:' + fondoDe(it) + '" data-check="' + it.id + '" aria-label="Hecho">' + emoji(it) + '</button>'
        : '<div class="burbuja" style="--cb:' + fondoDe(it) + '">' + emoji(it) + '</div>';
      return '<div class="tl-fila' + (it.hecho ? ' hecho' : '') + (pasado ? ' pasado' : '') + '"><div class="hh">' + hh + '</div>' + bur +
        '<button class="tl-card" data-id="' + it.id + '"><div class="tit">' + esc(it.titulo) + '</div>' + metaDe(it) +
        (it.notas ? '<div class="nt">' + esc(it.notas.split('\n')[0]) + '</div>' : '') + '</button></div>';
    }
    var h = '<div class="tl">';
    sinHora.forEach(function (it) { h += fila(it, '<small>' + (it.tipo === 'cita' ? 'Todo el<br>día' : 'Sin<br>hora') + '</small>'); });
    var puesto = !esHoy, prev = null;
    conHora.forEach(function (it) {
      var m = hm(it.hora);
      if (!puesto && m > mAhora) { h += '<div class="tl-ahora"><div class="hh">' + pad(ahora.getHours()) + ':' + pad(ahora.getMinutes()) + '</div><div class="pt"></div><div class="ln"></div></div>'; puesto = true; prev = mAhora; }
      if (prev != null && m - prev >= 120) h += '<div class="tl-hueco"><span>' + durTxt(m - prev) + ' libres</span></div>';
      h += fila(it, hhmm(it.hora)); prev = m;
    });
    if (!puesto && conHora.length) h += '<div class="tl-ahora"><div class="hh">' + pad(ahora.getHours()) + ':' + pad(ahora.getMinutes()) + '</div><div class="pt"></div><div class="ln"></div></div>';
    return h + '</div>';
  }
  function saludo() { var h = new Date().getHours(); return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'; }
  function lunesDe(s) { var d = aFecha(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; }
  function pintaTira() {
    var l = lunesDe(diaSel), hoy = ymd(hoyD()), h = '';
    for (var k = 0; k < 7; k++) {
      var d = new Date(l); d.setDate(l.getDate() + k); var s = ymd(d);
      var p = delDia(s).filter(function (i) { return !i.hecho; })[0];
      h += '<button data-sel="' + s + '" class="' + (s === hoy ? 'hoy ' : '') + (s === diaSel ? 'sel' : '') + '"><small>' + 'DLMXJVS'[d.getDay()] + '</small><b>' + d.getDate() + '</b><i style="--c:' + (p ? colorDe(p) : 'transparent') + '"></i></button>';
    }
    $('#hoyTira').innerHTML = h;
  }
  function proximo() {
    var ahora = new Date(), hoy = hoyD(), mejor = null;
    for (var k = 0; k < 8 && !mejor; k++) {
      var d = new Date(hoy); d.setDate(d.getDate() + k); var s = ymd(d);
      delDia(s).forEach(function (it) {
        if (it.tipo !== 'cita' || it.hecho || !it.hora) return;
        var t = aFecha(s); var p = it.hora.split(':'); t.setHours(+p[0], +p[1]);
        if (t > ahora && (!mejor || t < mejor.t)) mejor = { it: it, t: t, dia: s };
      });
    }
    return mejor;
  }

  function pintaHoy() {
    var h = hoyD(), hoy = ymd(h), sel = aFecha(diaSel), esHoy = diaSel === hoy;
    $('#hoySaludo').textContent = esHoy ? saludo() + ', Aitor' : (difDias(diaSel, hoy) > 0 ? 'Más adelante' : 'Ya pasó');
    $('#hoyDia').textContent = esHoy ? 'Hoy, ' + h.getDate() + ' de ' + MES[h.getMonth()] : cap(DSEM[sel.getDay()]) + ' ' + sel.getDate();
    var deDia = delDia(diaSel), pend = deDia.filter(function (i) { return !i.hecho; });
    var ncitas = pend.filter(function (i) { return i.tipo === 'cita'; }).length, ntar = pend.length - ncitas;
    $('#hoySub').textContent = (esHoy ? cap(DSEM[h.getDay()]) : MES[sel.getMonth()].replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + sel.getFullYear()) + ' · ' +
      (!pend.length ? 'nada pendiente' : [ncitas ? ncitas + (ncitas === 1 ? ' cita' : ' citas') : '', ntar ? ntar + (ntar === 1 ? ' recado' : ' recados') : ''].filter(Boolean).join(' y '));
    pintaTira();

    var px = esHoy ? proximo() : null, hp = '';
    if (px) {
      var min = Math.round((px.t - new Date()) / 6e4), c = CAT[px.it.categoria];
      var cuando = min < 60 ? 'en <b>' + min + ' min</b>' : min < 24 * 60 ? 'en <b>' + durTxt(Math.round(min / 15) * 15) + '</b>' : '<b>' + fechaCorta(px.dia).toLowerCase() + '</b>';
      hp = '<button class="proximo" data-id="' + px.it.id + '" style="width:100%;text-align:left;' + (c ? '--pc:' + c.cb + ';' : '') + '"><div class="burbuja">' + emoji(px.it) + '</div><div class="txt"><div class="et">Lo próximo</div><div class="t">' + esc(px.it.titulo) + '</div><div class="cd">' + cuando + ' · a las ' + px.it.hora + '</div></div></button>';
    }
    $('#hoyProximo').innerHTML = hp;

    var html = '';
    if (esHoy) {
      var atras = items.filter(function (i) { return i.tipo === 'tarea' && !i.hecho && i.fecha && i.fecha < hoy; }).sort(ordenar);
      if (atras.length) html += '<h2 class="sec"><span>Se te pasó</span></h2><div class="lista">' + atras.map(function (i) { return tarjeta(i, { conFecha: true }); }).join('') + '</div>';
    }
    html += '<h2 class="sec"><span>' + (esHoy ? 'Tu día' : fechaLarga(diaSel)) + '</span>' + (esHoy ? '' : '<button data-sel="' + hoy + '">Volver a hoy</button>') + '</h2>' + lineaDia(diaSel);

    if (esHoy) {
      var prox = '';
      for (var k = 1; k <= 7; k++) {
        var d = new Date(h); d.setDate(d.getDate() + k); var s = ymd(d);
        var l = delDia(s).filter(function (i) { return !i.hecho; });
        if (l.length) prox += '<button class="prox-dia" data-sel="' + s + '"><div class="fch"><small>' + (k === 1 ? 'Mañ' : DSEM[d.getDay()].slice(0, 3)) + '</small><b>' + d.getDate() + '</b></div><div class="lst">' +
          l.slice(0, 3).map(function (i) { return '<div><span>' + (i.hora || '·') + '</span>' + emoji(i) + ' ' + esc(i.titulo) + '</div>'; }).join('') + (l.length > 3 ? '<div style="color:var(--muted)">y ' + (l.length - 3) + ' más</div>' : '') + '</div></button>';
      }
      if (prox) html += '<h2 class="sec"><span>Esta semana</span></h2>' + prox;
      var nCom = items.filter(function (i) { return i.tipo === 'compra' && !i.hecho; }).length;
      var nSin = items.filter(function (i) { return i.tipo === 'tarea' && !i.hecho && !i.fecha; }).length;
      html += '<h2 class="sec"><span>De un vistazo</span></h2><div class="mini"><button data-tab-go="compra"><b>' + nCom + '</b><span>en la compra</span></button><button data-tab-go="tareas"><b>' + nSin + '</b><span>recados sin fecha</span></button><button data-tab-go="notas"><b>' + items.filter(function (i) { return i.tipo === 'nota'; }).length + '</b><span>notas</span></button></div>';
    }
    $('#hoyLista').innerHTML = html;
    var pendHoy = delDia(hoy).filter(function (i) { return !i.hecho; }).length;
    try { if (navigator.setAppBadge) { pendHoy ? navigator.setAppBadge(pendHoy) : navigator.clearAppBadge(); } } catch (e) {}
  }

  function pintaCal() {
    var y = calMes.getFullYear(), m = calMes.getMonth();
    $('#calMes').textContent = MES[m] + (y !== hoyD().getFullYear() ? ' ' + y : '');
    var ini = new Date(y, m, 1), off = (ini.getDay() + 6) % 7, d0 = new Date(y, m, 1 - off), hoy = ymd(hoyD()), html = '';
    for (var k = 0; k < 42; k++) {
      var d = new Date(d0); d.setDate(d0.getDate() + k); var s = ymd(d);
      if (k === 35 && d.getMonth() !== m) break;
      var l = delDia(s).filter(function (i) { return !i.hecho; }).slice(0, 4);
      var puntos = l.map(function (i) { var c = CAT[i.categoria]; return '<i style="--c:' + (c ? c.c : (i.tipo === 'cita' ? '#A893E8' : '#C9C1D6')) + '"></i>'; }).join('');
      html += '<button class="d' + (d.getMonth() !== m ? ' fuera' : '') + (s === hoy ? ' hoy' : '') + (s === calSel ? ' sel' : '') + '" data-dia="' + s + '"><span>' + d.getDate() + '</span><div class="puntos">' + puntos + '</div></button>';
    }
    $('#calRej').innerHTML = html;
    $('#calSelLbl').textContent = fechaLarga(calSel);
    $('#calLista').innerHTML = lineaDia(calSel);
  }

  function pintaTareas() {
    var hoy = ymd(hoyD());
    var t = items.filter(function (i) { return i.tipo === 'tarea'; });
    var pend = t.filter(function (i) { return !i.hecho; }).sort(ordenar);
    var grupos = [
      ['Se te pasó', pend.filter(function (i) { return i.fecha && i.fecha < hoy; })],
      ['Hoy', pend.filter(function (i) { return i.fecha === hoy; })],
      ['Más adelante', pend.filter(function (i) { return i.fecha && i.fecha > hoy; })],
      ['Cuando puedas', pend.filter(function (i) { return !i.fecha; })]
    ];
    var html = '';
    grupos.forEach(function (g) { if (g[1].length) html += '<h2 class="sec"><span>' + g[0] + '</span></h2><div class="lista">' + g[1].map(function (i) { return tarjeta(i, { conFecha: g[0] !== 'Hoy' }); }).join('') + '</div>'; });
    var hechas = t.filter(function (i) { return i.hecho; }).sort(function (a, b) { return (b.hecho_at || '') < (a.hecho_at || '') ? -1 : 1; }).slice(0, 15);
    if (!pend.length) html += '<div class="vacio" style="margin-top:18px">Todo hecho. Ni un recado pendiente.</div>';
    if (hechas.length) html += '<h2 class="sec"><span>Hechos</span>' + '<button id="limpiaHechas">Quitar</button></h2><div class="lista">' + hechas.map(function (i) { return tarjeta(i); }).join('') + '</div>';
    $('#tarLista').innerHTML = html;
    $('#tarSub').textContent = pend.length ? pend.length + (pend.length === 1 ? ' pendiente' : ' pendientes') : 'Al día';
  }

  function pintaCompra() {
    var c = items.filter(function (i) { return i.tipo === 'compra'; });
    var pend = c.filter(function (i) { return !i.hecho; }).sort(function (a, b) { return (a.created_at || '') < (b.created_at || '') ? -1 : 1; });
    var carro = c.filter(function (i) { return i.hecho; });
    var html = '<div class="lista" style="margin-top:14px">' + (pend.length ? pend.map(function (i) { return tarjeta(i); }).join('') : '<div class="vacio">La lista está vacía</div>') + '</div>';
    if (carro.length) html += '<h2 class="sec"><span>En el carro</span><button id="vaciaCarro">Vaciar</button></h2><div class="lista">' + carro.map(function (i) { return tarjeta(i); }).join('') + '</div>';
    $('#comLista').innerHTML = html;
    $('#comSub').textContent = pend.length ? pend.length + (pend.length === 1 ? ' cosa' : ' cosas') + ' por comprar' : 'Nada que comprar';
  }

  function pintaNotas() {
    var n = items.filter(function (i) { return i.tipo === 'nota'; }).sort(function (a, b) { if (a.fijada !== b.fijada) return a.fijada ? -1 : 1; return (b.updated_at || b.created_at || '') < (a.updated_at || a.created_at || '') ? -1 : 1; });
    var colores = ['#FFFFFF', '#F3EEFF', '#FFF0F4', '#EEF7F2', '#FFF6EA', '#EEF4FE'];
    $('#notLista').innerHTML = n.length ? n.map(function (i, k) {
      var c = CAT[i.categoria]; var bg = c ? c.cb : colores[k % colores.length];
      return '<button class="nota" style="--cb:' + bg + '" data-id="' + i.id + '">' + (i.fijada ? '<span class="pin"><svg class="i" style="width:16px;height:16px"><use href="#i-pin"/></svg></span>' : '') + '<h3>' + esc(i.titulo || 'Sin título') + '</h3>' + (i.notas ? '<p>' + esc(i.notas) + '</p>' : '') + '</button>';
    }).join('') : '<div class="vacio" style="column-span:all">Sin notas. Di «nota:» y lo que quieras guardar.</div>';
  }

  function pinta() {
    if (vista === 'hoy') pintaHoy(); else if (vista === 'cal') pintaCal(); else if (vista === 'tareas') pintaTareas(); else if (vista === 'compra') pintaCompra(); else if (vista === 'notas') pintaNotas();
  }
  function irA(v) {
    vista = v;
    $$('section[data-v]').forEach(function (s) { s.classList.toggle('hide', s.dataset.v !== v); });
    $$('nav.tabs [data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === v); });
    cierraHojas(); pinta(); window.scrollTo(0, 0);
  }

  // ---------- hojas ----------
  function abreHoja(id) { $('#velo').classList.add('on'); $(id).classList.add('on'); }
  if (IOS) { var pi = document.getElementById('pista'); if (pi) pi.innerHTML = 'Toca el <b>🎙️ del teclado</b> y dilo como te salga: <b>«médico el jueves a las 10»</b>, <b>«comprar leche y pan»</b>, <b>«nota: …»</b>'; }
  function cierraHojas() { $('#velo').classList.remove('on'); $$('.hoja').forEach(function (h) { h.classList.remove('on'); }); paraMic(); }
  $('#velo').onclick = cierraHojas;
  $$('.hoja').forEach(function (h) { // deslizar hacia abajo para cerrar
    var y0 = null;
    h.addEventListener('touchstart', function (e) { y0 = h.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    h.addEventListener('touchmove', function (e) { if (y0 != null) { var dy = e.touches[0].clientY - y0; if (dy > 0) h.style.transform = 'translateY(' + dy + 'px)'; } }, { passive: true });
    h.addEventListener('touchend', function (e) { if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; h.style.transform = ''; y0 = null; if (dy > 110) cierraHojas(); });
  });

  // ---------- apuntar rápido ----------
  var borrador = null; // resultado interpretado + retoques del usuario
  var retoques = {};
  var IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function abreApuntar(texto, fecha) {
    $('#txt').value = texto || ''; retoques = fecha ? { fecha: fecha } : {};
    interpretar(); abreHoja('#hApuntar');
    // en el iPhone el teclado solo sale si el foco se pone en el mismo toque
    try { $('#txt').focus({ preventScroll: true }); } catch (e) { $('#txt').focus(); }
    if (!IOS) setTimeout(function () { $('#txt').focus(); }, 330);
  }
  function resaltar(r) {
    var raw = $('#txt').value, hl = $('#hl');
    var lead = raw.length - raw.replace(/^\s+/, '').length, core = raw.trim();
    if (!r || !r.rangos || !r.rangos.length || core.replace(/\s+/g, ' ') !== core) { hl.textContent = raw + '\n'; return; }
    var out = '', pos = 0, rs = r.rangos.slice().sort(function (a, b) { return a.ini - b.ini; });
    rs.forEach(function (z) {
      var a = z.ini, b = z.fin; if (a < pos) a = pos; if (b <= a) return;
      // no resaltar espacios ni comas sueltas en los bordes
      while (a < b && /[\s,]/.test(core[a])) a++; while (b > a && /[\s,]/.test(core[b - 1])) b--;
      out += esc(core.slice(pos, a)) + '<mark class="' + z.k + '">' + esc(core.slice(a, b)) + '</mark>'; pos = b;
    });
    out += esc(core.slice(pos));
    hl.innerHTML = esc(raw.slice(0, lead)) + out + esc(raw.slice(lead + core.length)) + '\n';
  }
  function interpretar() {
    var t = $('#txt').value.trim();
    $('#bGuardar').disabled = !t;
    if (!t) { resaltar(null); borrador = null; $('#interp').innerHTML = ''; $('#pista').classList.remove('hide'); return; }
    $('#pista').classList.add('hide');
    var r = NLP.parse(t);
    Object.keys(retoques).forEach(function (k) { r[k] = retoques[k]; });
    if (retoques.fecha && !('tipo' in retoques) && r.tipo === 'tarea' && r.hora) r.tipo = 'cita';
    if (!r.avisos || retoques.avisos === undefined && !NLP.parse(t).avisos) r.avisos = r.avisos && NLP.parse(t).avisos ? r.avisos : avisosPorDefecto(r);
    borrador = r;
    resaltar(r);
    pintaInterp();
  }
  function pintaInterp() {
    var r = borrador, h = '';
    var tipos = { cita: 'Cita', tarea: 'Recado', nota: 'Nota', compra: 'Compra' };
    h += '<div class="interpreta"><div class="fila"><svg class="i"><use href="#i-tipo"/></svg><div class="v"><div class="chips" id="iTipo">' +
      Object.keys(tipos).map(function (k) { return '<button data-t="' + k + '"' + (r.tipo === k ? ' class="on"' : '') + '>' + tipos[k] + '</button>'; }).join('') + '</div></div></div>';
    if (r.tipo === 'compra') {
      h += '<div class="fila"><svg class="i"><use href="#i-bolsa"/></svg><div class="v">' + (r.items && r.items.length ? r.items.map(esc).join(' · ') : esc(r.titulo)) + '</div></div>';
    } else {
      h += '<div class="fila"><svg class="i"><use href="#i-etiqueta"/></svg><div class="v" style="font-weight:600">' + esc(r.titulo || '…') + '</div></div>';
    }
    if (r.tipo === 'cita' || r.tipo === 'tarea') {
      h += '<div class="fila"><svg class="i"><use href="#i-fecha"/></svg><div class="v' + (r.fecha ? '' : ' vacio-v') + '">' + (r.fecha ? fechaLarga(r.fecha) : 'Sin fecha (toca para poner)') + '</div><input type="date" id="iFecha" value="' + (r.fecha || '') + '"></div>';
      h += '<div class="fila"><svg class="i"><use href="#i-reloj"/></svg><div class="v' + (r.hora ? '' : ' vacio-v') + '">' + (r.hora ? 'A las ' + r.hora : 'Sin hora') + '</div>' + (r.hora ? '<button class="chip" id="iSinHora" style="position:relative;z-index:2">Quitar</button>' : '') + '<input type="time" id="iHora" value="' + (r.hora || '') + '"></div>';
      if (r.fecha) {
        var ops = r.hora ? AV_HORA : AV_DIA;
        h += '<div class="fila" style="align-items:flex-start"><svg class="i" style="margin-top:6px"><use href="#i-campana"/></svg><div class="v"><div class="chips" id="iAv">' + ops.map(function (o) { return '<button data-m="' + o[0] + '"' + (r.avisos.indexOf(o[0]) >= 0 ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div></div></div>';
      }
      h += '<div class="fila" style="align-items:flex-start"><svg class="i" style="margin-top:6px"><use href="#i-etiqueta"/></svg><div class="v"><div class="chips" id="iCat">' + Object.keys(CAT).map(function (k) { var c = CAT[k]; return '<button data-c="' + k + '" style="--cb:' + c.cb + ';--ct:' + c.ct + '"' + (r.categoria === k ? ' class="on"' : '') + '>' + c.n + '</button>'; }).join('') + '</div></div></div>';
      if (r.repetir && r.repetir !== 'no') h += '<div class="fila"><svg class="i"><use href="#i-repetir"/></svg><div class="v">' + REP.filter(function (x) { return x[0] === r.repetir; })[0][1] + '</div></div>';
    }
    h += '</div>';
    $('#interp').innerHTML = h;
  }
  $('#txt').addEventListener('input', function () { retoques = retoques.fecha && Object.keys(retoques).length === 1 ? retoques : {}; interpretar(); });
  $('#interp').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !borrador) return;
    if (b.dataset.t) { retoques.tipo = b.dataset.t; if (b.dataset.t === 'cita' && !borrador.fecha) retoques.fecha = ymd(hoyD()); }
    else if (b.dataset.m != null) {
      var m = +b.dataset.m, a = borrador.avisos.slice(), k = a.indexOf(m);
      if (k >= 0) a.splice(k, 1); else a.push(m);
      retoques.avisos = a.sort(function (x, y) { return y - x; });
    }
    else if (b.dataset.c) retoques.categoria = borrador.categoria === b.dataset.c ? null : b.dataset.c;
    else if (b.id === 'iSinHora') { retoques.hora = null; retoques.avisos = undefined; delete retoques.avisos; }
    interpretar();
  });
  $('#interp').addEventListener('change', function (e) {
    if (e.target.id === 'iFecha') { retoques.fecha = e.target.value || null; delete retoques.avisos; }
    if (e.target.id === 'iHora') { retoques.hora = e.target.value || null; if (e.target.value && !borrador.fecha) retoques.fecha = ymd(hoyD()); if (e.target.value && borrador.tipo === 'tarea' && !retoques.tipo) retoques.tipo = 'cita'; delete retoques.avisos; }
    interpretar();
  });
  function guardarBorrador() {
    var r = borrador; if (!r) return;
    if (r.tipo === 'compra') {
      var lista = r.items && r.items.length ? r.items : [r.titulo];
      lista.forEach(function (t) { if (t) guardar(nuevo({ tipo: 'compra', titulo: t })); });
      toast(lista.length === 1 ? 'Añadido a la compra' : lista.length + ' cosas a la compra');
    } else if (r.tipo === 'nota') {
      var txt = $('#txt').value.trim().replace(/^(apunta(r|me)?\s+)?(una\s+)?(nota|idea)\s*[:,.]?\s*/i, '');
      var lin = txt.split('\n'); var tit = lin[0].length > 60 ? lin[0].slice(0, 57) + '…' : lin[0];
      guardar(nuevo({ tipo: 'nota', titulo: tit, notas: lin[0].length > 60 || lin.length > 1 ? txt : '', categoria: r.categoria }));
      toast('Nota guardada');
    } else {
      var it = nuevo({ tipo: r.tipo, titulo: r.titulo || $('#txt').value.trim(), fecha: r.fecha, hora: r.hora, categoria: r.categoria, repetir: r.repetir || 'no', avisos: r.fecha ? (r.avisos || []) : [] });
      guardar(it);
      toast(r.fecha ? 'Apuntado para ' + fechaCorta(r.fecha).toLowerCase() + (r.hora ? ' a las ' + r.hora : '') : 'Apuntado');
      if (r.fecha && !ls('am_pidio_push') && !pushActivo) { ls('am_pidio_push', 1); setTimeout(function () { abreAjustes(); }, 900); }
    }
    cierraHojas();
    if (r.tipo === 'compra' && vista !== 'compra') return;
  }
  $('#bGuardar').onclick = guardarBorrador;
  $('#txt').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (borrador) guardarBorrador(); } });
  $('#bMas').onclick = function () {
    var r = borrador;
    var base = r ? { tipo: r.tipo, titulo: r.tipo === 'compra' ? (r.items || [r.titulo]).join(', ') : r.titulo, fecha: r.fecha, hora: r.hora, categoria: r.categoria, repetir: r.repetir, avisos: r.avisos } : { tipo: 'cita', fecha: ymd(hoyD()) };
    cierraHojas(); setTimeout(function () { abreEditar(nuevo(base), true); }, 120);
  };

  // ---------- dictado ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null;
  function paraMic() { if (rec) { try { rec.stop(); } catch (e) {} } rec = null; $('#bMic').classList.remove('on'); }
  function ayudaTeclado(ver) { var a = $('#dictaAyuda'); if (a) a.classList.toggle('hide', !ver); }
  $('#txt').addEventListener('input', function () { ayudaTeclado(false); });
  $('#bMic').onclick = function () {
    var ta = $('#txt');
    if (rec) { paraMic(); return; }
    // En el iPhone, dentro de una app de la pantalla de inicio, el dictado de la web no funciona:
    // se abre el teclado y se usa su micrófono, que es el de Siri y va muy bien.
    if (IOS || !SR) { ta.focus(); ayudaTeclado(true); return; }
    try {
      rec = new SR(); rec.lang = 'es-ES'; rec.interimResults = true; rec.continuous = false;
      var base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
      rec.onresult = function (ev) {
        var t = ''; for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
        ta.value = base + t; interpretar();
      };
      rec.onerror = function (ev) { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { ayudaTeclado(true); } paraMic(); };
      rec.onend = function () { paraMic(); };
      rec.start(); $('#bMic').classList.add('on');
    } catch (e) { paraMic(); ta.focus(); ayudaTeclado(true); }
  };

  // ---------- editar ----------
  var editando = null, esNuevo = false;
  function abreEditar(it, nuevoItem) {
    editando = JSON.parse(JSON.stringify(it)); esNuevo = !!nuevoItem;
    $('#eTit').value = editando.titulo || ''; $('#eNotas').value = editando.notas || '';
    $('#eBorrar').classList.toggle('hide', esNuevo);
    pintaEditar(); abreHoja('#hEditar');
  }
  function pintaEditar() {
    var e = editando;
    $$('#eTipo button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === e.tipo); });
    var h = '';
    if (e.tipo === 'cita' || e.tipo === 'tarea') {
      h += '<div class="interpreta">';
      h += '<div class="fila"><svg class="i"><use href="#i-fecha"/></svg><div class="v' + (e.fecha ? '' : ' vacio-v') + '">' + (e.fecha ? fechaLarga(e.fecha) : 'Sin fecha') + '</div>' + (e.fecha && e.tipo === 'tarea' ? '<button class="chip" data-x="sinFecha" style="position:relative;z-index:2">Quitar</button>' : '') + '<input type="date" data-f="fecha" value="' + (e.fecha || '') + '"></div>';
      h += '<div class="fila"><svg class="i"><use href="#i-reloj"/></svg><div class="v' + (e.hora ? '' : ' vacio-v') + '">' + (e.hora ? 'A las ' + e.hora : (e.tipo === 'cita' ? 'Todo el día' : 'Sin hora')) + '</div>' + (e.hora ? '<button class="chip" data-x="sinHora" style="position:relative;z-index:2">Quitar</button>' : '') + '<input type="time" data-f="hora" value="' + (e.hora || '') + '"></div>';
      h += '</div>';
      if (e.fecha) {
        h += '<div class="lbl-s">Avisarme</div><div class="chips" id="eAv">' + (e.hora ? AV_HORA : AV_DIA).map(function (o) { return '<button data-m="' + o[0] + '"' + (e.avisos.indexOf(o[0]) >= 0 ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div>';
        h += '<div class="lbl-s">Repetir</div><div class="chips" id="eRep">' + REP.map(function (o) { return '<button data-r="' + o[0] + '"' + ((e.repetir || 'no') === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div>';
      }
    }
    if (e.tipo !== 'compra') {
      h += '<div class="lbl-s">Categoría</div><div class="chips" id="eCat">' + Object.keys(CAT).map(function (k) { var c = CAT[k]; return '<button data-c="' + k + '" style="--cb:' + c.cb + ';--ct:' + c.ct + '"' + (e.categoria === k ? ' class="on"' : '') + '>' + c.n + '</button>'; }).join('') + '</div>';
    }
    if (e.tipo === 'nota') h += '<div class="campo" style="margin-top:14px"><div class="toggle"><span>Fijar arriba</span><button class="sw' + (e.fijada ? ' on' : '') + '" data-x="fijar"></button></div></div>';
    $('#eCuando').innerHTML = h;
    $('#eNotas').rows = e.tipo === 'nota' ? 8 : 3;
  }
  $('#eTipo').onclick = function (ev) { var b = ev.target.closest('button'); if (!b) return; editando.tipo = b.dataset.t; if (b.dataset.t === 'cita' && !editando.fecha) editando.fecha = ymd(hoyD()); editando.avisos = avisosPorDefecto(editando); pintaEditar(); };
  $('#eCuando').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return; var e = editando;
    if (b.dataset.m != null) { var m = +b.dataset.m, k = e.avisos.indexOf(m); if (k >= 0) e.avisos.splice(k, 1); else e.avisos.push(m); e.avisos.sort(function (x, y) { return y - x; }); }
    else if (b.dataset.r) e.repetir = b.dataset.r;
    else if (b.dataset.c) e.categoria = e.categoria === b.dataset.c ? null : b.dataset.c;
    else if (b.dataset.x === 'sinHora') { e.hora = null; e.avisos = avisosPorDefecto(e); }
    else if (b.dataset.x === 'sinFecha') { e.fecha = null; e.hora = null; e.avisos = []; e.repetir = 'no'; }
    else if (b.dataset.x === 'fijar') e.fijada = !e.fijada;
    pintaEditar();
  });
  $('#eCuando').addEventListener('change', function (ev) {
    var f = ev.target.dataset.f; if (!f) return; var e = editando, tenia = !!e[f];
    e[f] = ev.target.value || null;
    if (f === 'hora' && e.hora && !e.fecha) e.fecha = ymd(hoyD());
    if (!tenia || f === 'hora') e.avisos = avisosPorDefecto(e);
    pintaEditar();
  });
  $('#eGuardar').onclick = function () {
    var e = editando; e.titulo = $('#eTit').value.trim(); e.notas = $('#eNotas').value.trim();
    if (!e.titulo && !e.notas) { $('#eTit').focus(); return; }
    if (!e.titulo) e.titulo = e.notas.split('\n')[0].slice(0, 60);
    if (e.tipo === 'nota' || e.tipo === 'compra') { e.fecha = null; e.hora = null; e.avisos = []; e.repetir = 'no'; }
    if (!e.fecha) { e.avisos = []; e.repetir = 'no'; }
    if (e.tipo === 'compra' && esNuevo && /,/.test(e.titulo)) {
      e.titulo.split(/\s*,\s*/).filter(Boolean).forEach(function (t) { guardar(nuevo({ tipo: 'compra', titulo: cap(t) })); });
    } else guardar(e);
    cierraHojas(); toast('Guardado');
  };
  $('#eCancelar').onclick = cierraHojas;
  $('#eBorrar').onclick = function () { var e = items.filter(function (x) { return x.id === editando.id; })[0]; cierraHojas(); if (e) borrar(e); };

  // ---------- clics en listas ----------
  document.addEventListener('click', function (ev) {
    var c = ev.target.closest('[data-check]');
    if (c) { var it = items.filter(function (x) { return x.id === c.dataset.check; })[0]; if (it) alternarHecho(it); return; }
    var go = ev.target.closest('[data-tab-go]'); if (go) { irA(go.dataset.tabGo); return; }
    var tab = ev.target.closest('[data-tab]'); if (tab) { if (tab.dataset.tab === 'hoy') diaSel = ymd(hoyD()); irA(tab.dataset.tab); return; }
    var ab = ev.target.closest('[data-abrir]'); if (ab) { abreApuntar('', vista === 'cal' ? calSel : (vista === 'hoy' && diaSel !== ymd(hoyD()) ? diaSel : null)); return; }
    var sl = ev.target.closest('[data-sel]'); if (sl) { diaSel = sl.dataset.sel; if (vista !== 'hoy') irA('hoy'); else { pintaHoy(); } window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var dia = ev.target.closest('[data-dia]'); if (dia) { calSel = dia.dataset.dia; var d = aFecha(calSel); if (d.getMonth() !== calMes.getMonth()) calMes = new Date(d.getFullYear(), d.getMonth(), 1); pintaCal(); return; }
    var card = ev.target.closest('.item[data-id], .nota[data-id], .tl-card[data-id], .proximo[data-id]');
    if (card && !ev.target.closest('.hoja')) { var it2 = items.filter(function (x) { return x.id === card.dataset.id; })[0]; if (it2) abreEditar(it2); return; }
    if (ev.target.id === 'vaciaCarro') { items.filter(function (i) { return i.tipo === 'compra' && i.hecho; }).forEach(function (i) { items = items.filter(function (x) { return x.id !== i.id; }); encola({ t: 'del', id: i.id }); }); guardaLocal(); pinta(); }
    if (ev.target.id === 'limpiaHechas') { items.filter(function (i) { return i.tipo === 'tarea' && i.hecho; }).forEach(function (i) { items = items.filter(function (x) { return x.id !== i.id; }); encola({ t: 'del', id: i.id }); }); guardaLocal(); pinta(); }
  });
  (function () {
    var x0 = null, tira = $('#hoyTira');
    tira.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    tira.addEventListener('touchend', function (e) {
      if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) { var d = aFecha(diaSel); d.setDate(d.getDate() + (dx < 0 ? 7 : -7)); diaSel = ymd(d); pintaHoy(); }
    });
  })();
  $('#calAnt').onclick = function () { calMes = new Date(calMes.getFullYear(), calMes.getMonth() - 1, 1); pintaCal(); };
  $('#calSig').onclick = function () { calMes = new Date(calMes.getFullYear(), calMes.getMonth() + 1, 1); pintaCal(); };
  $('#calAdd').onclick = function () { abreApuntar('', calSel); };
  $('#comForm').onsubmit = function (e) {
    e.preventDefault(); var v = $('#comInput').value.trim(); if (!v) return;
    v.split(/\s*(?:,|;|\sy\s)\s*/).filter(Boolean).forEach(function (t) { guardar(nuevo({ tipo: 'compra', titulo: cap(t) })); });
    $('#comInput').value = '';
  };
  $('#notaNueva').onclick = function () { abreEditar(nuevo({ tipo: 'nota' }), true); };

  // ---------- notificaciones push ----------
  var pushActivo = false;
  function b64(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var r = atob(s), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
  var esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  function estadoPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return Promise.resolve(esIOS && !standalone ? 'instalar' : 'nosoporta');
    if (Notification.permission === 'denied') return Promise.resolve('denegado');
    return navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) { pushActivo = !!s; return s ? 'on' : 'off'; });
  }
  function activaPush() {
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error('permiso');
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) }); });
    }).then(function (sub) {
      var j = sub.toJSON();
      return api('agenda_push?on_conflict=endpoint', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: [{ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }] });
    }).then(function () { pushActivo = true; toast('Avisos activados'); });
  }
  function desactivaPush() {
    return navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) {
      if (!s) return; var ep = s.endpoint;
      return s.unsubscribe().then(function () { return api('agenda_push?endpoint=eq.' + encodeURIComponent(ep), { method: 'DELETE' }); });
    }).then(function () { pushActivo = false; toast('Avisos desactivados'); });
  }
  function pintaAjustes() {
    estadoPush().then(function (st) {
      var txt = { on: 'Activados en este móvil', off: 'Desactivados', denegado: 'Bloqueados. Actívalos en Ajustes del iPhone › Notificaciones › Agenda', instalar: 'Primero añade la app a la pantalla de inicio', nosoporta: 'Este navegador no admite avisos' }[st];
      $('#ajEstado').textContent = txt; $('#ajPush').classList.toggle('on', st === 'on');
      $('#ajPush').disabled = st === 'denegado' || st === 'instalar' || st === 'nosoporta';
      $('#ajProbar').disabled = st !== 'on';
    });
    $('#ajDef').innerHTML = AV_HORA.map(function (o) { return '<button data-m="' + o[0] + '"' + (ajustes.avisosCita.indexOf(o[0]) >= 0 ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('');
    $('#ajLlave').textContent = llave || '—';
    $('#ajVer').textContent = 'Agenda AM · versión ' + VERSION;
  }
  function abreAjustes() { pintaAjustes(); abreHoja('#hAjustes'); }
  $('#bAjustes').onclick = abreAjustes;
  $('#ajPush').onclick = function () {
    var p = pushActivo ? desactivaPush() : activaPush();
    p.catch(function (e) { toast(e.message === 'permiso' ? 'Sin permiso para avisar' : 'No se pudo activar'); console.warn(e); }).then(pintaAjustes);
  };
  $('#ajDef').onclick = function (ev) {
    var b = ev.target.closest('button'); if (!b) return; var m = +b.dataset.m, a = ajustes.avisosCita, k = a.indexOf(m);
    if (k >= 0) a.splice(k, 1); else a.push(m); a.sort(function (x, y) { return y - x; }); ls('am_ajustes', ajustes); pintaAjustes();
  };
  $('#ajCopiar').onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText(llave || '').then(function () { toast('Llave copiada'); }); };
  $('#ajRecargar').onclick = function () { cargar().then(function () { toast('Datos al día'); }); };
  $('#ajProbar').onclick = function () {
    var prueba = nuevo({ tipo: 'tarea', titulo: 'Aviso de prueba', notas: 'Si ves esto, funciona', categoria: 'otros' });
    var cuando = new Date(Date.now() + 30e3);
    api('agenda_items', { method: 'POST', prefer: 'return=minimal', body: [limpio(prueba)] })
      .then(function () { return api('agenda_avisos', { method: 'POST', prefer: 'return=minimal', body: [{ item_id: prueba.id, fire_at: cuando.toISOString(), titulo: '🔔 Aviso de prueba', cuerpo: 'Si ves esto, los avisos funcionan. Ya puedes cerrar la app.' }] }); })
      .then(function () { toast('Te llega en menos de un minuto. Cierra la app si quieres'); setTimeout(function () { api('agenda_items?id=eq.' + prueba.id, { method: 'DELETE' }).catch(function () {}); }, 150e3); })
      .catch(function () { toast('No se pudo programar la prueba'); });
  };
  function bannerAvisos() {
    var el = $('#bannerAvisos');
    if (DEMO) { el.innerHTML = ''; return; }
    estadoPush().then(function (st) {
      if (st === 'instalar') el.innerHTML = '<div class="banner"><svg class="i"><use href="#i-campana"/></svg><div><b>Instálala para recibir avisos.</b><br>En Safari toca Compartir y luego «Añadir a pantalla de inicio». Ábrela desde ese icono.</div></div>';
      else if (st === 'off' && !ls('am_banner_no')) el.innerHTML = '<div class="banner"><svg class="i"><use href="#i-campana"/></svg><div><b>Activa los avisos</b> para que te salte el globo antes de cada cita.<br><button id="bannerSi">Activar</button> &nbsp; <button id="bannerNo" style="color:var(--muted)">Ahora no</button></div></div>';
      else el.innerHTML = '';
      var si = $('#bannerSi'), no = $('#bannerNo');
      if (si) si.onclick = function () { activaPush().catch(function () { toast('Sin permiso para avisar'); }).then(bannerAvisos); };
      if (no) no.onclick = function () { ls('am_banner_no', 1); el.innerHTML = ''; };
    });
  }

  // ---------- llave ----------
  function pideLlave() {
    $('#llave').classList.remove('hide');
    $('#llaveOk').onclick = function () {
      var v = $('#llaveIn').value.trim(); if (!v) return;
      llave = v;
      api('agenda_items?select=id&limit=1').then(function () {
        // comprobamos que la llave abre la puerta escribiendo y borrando una nota vacía
        var t = uid();
        return api('agenda_items', { method: 'POST', prefer: 'return=minimal', body: [{ id: t, tipo: 'nota', titulo: '·' }] })
          .then(function () { return api('agenda_items?id=eq.' + t, { method: 'DELETE' }); });
      }).then(function () { ls('am_llave', llave); $('#llave').classList.add('hide'); arranca(); })
        .catch(function () { llave = null; toast('Esa llave no vale'); });
    };
  }

  // ---------- arranque ----------
  function datosDemo() {
    var h = hoyD(); function d(n) { var x = new Date(h); x.setDate(x.getDate() + n); return ymd(x); }
    items = [
      nuevo({ tipo: 'cita', titulo: 'Médico de cabecera', fecha: d(0), hora: '10:30', categoria: 'salud', notas: 'Llevar la tarjeta y los análisis' }),
      nuevo({ tipo: 'tarea', titulo: 'Llamar al seguro del coche', fecha: d(0), categoria: 'coche' }),
      nuevo({ tipo: 'cita', titulo: 'Entreno Juvenil', fecha: d(0), hora: '19:30', categoria: 'futbol', repetir: 'semanal' }),
      nuevo({ tipo: 'tarea', titulo: 'Pagar recibo de la comunidad', fecha: d(-1), categoria: 'papeleo' }),
      nuevo({ tipo: 'cita', titulo: 'ITV del Passat', fecha: d(2), hora: '09:15', categoria: 'coche' }),
      nuevo({ tipo: 'cita', titulo: 'Cena con los suegros', fecha: d(3), hora: '21:00', categoria: 'familia' }),
      nuevo({ tipo: 'tarea', titulo: 'Recoger el traje', fecha: d(4), categoria: 'casa' }),
      nuevo({ tipo: 'cita', titulo: 'Notaría · firma Salamanca', fecha: d(9), hora: '12:00', categoria: 'papeleo' }),
      nuevo({ tipo: 'tarea', titulo: 'Mirar bicis eléctricas', categoria: 'casa' }),
      nuevo({ tipo: 'compra', titulo: 'Leche' }), nuevo({ tipo: 'compra', titulo: 'Pan' }), nuevo({ tipo: 'compra', titulo: 'Huevos' }),
      nuevo({ tipo: 'compra', titulo: 'Café', hecho: true }),
      nuevo({ tipo: 'nota', titulo: 'Código del trastero', notas: '4521', fijada: true }),
      nuevo({ tipo: 'nota', titulo: 'Ideas para el entreno del jueves', notas: 'Rondo 5x2 con transiciones\nPartido condicionado a 2 toques\nFinalización por bandas', categoria: 'futbol' }),
      nuevo({ tipo: 'nota', titulo: 'Placas solares', notas: 'Pedir presupuesto con batería para la casa de Martín de Yeltes' })
    ];
    items[2].hecho = false;
  }
  function arranca() {
    pinta(); bannerAvisos();
    cargar().then(vaciaCola);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { pinta(); cargar(); } });
  }
  if ('serviceWorker' in navigator && !DEMO) navigator.serviceWorker.register('sw.js').catch(function () {});
  if (DEMO) { datosDemo(); arranca(); var v = /[?&]v=(\w+)/.exec(location.search); if (v) irA(v[1]); if (/[?&]apuntar=([^&]+)/.test(location.search)) abreApuntar(decodeURIComponent(/[?&]apuntar=([^&]+)/.exec(location.search)[1])); }
  else if (!llave) pideLlave();
  else arranca();
  // abrir desde un aviso
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.abrir) { cargar(); } });
})();
