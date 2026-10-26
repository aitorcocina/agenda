/* nlp.js — Interpreta frases en español: "dentista el jueves a las 5 y media",
   "comprar leche, pan y huevos", "nota: ...", "recuérdame llamar a mamá el viernes".
   Devuelve {tipo, titulo, fecha:'YYYY-MM-DD'|null, hora:'HH:MM'|null, categoria,
   repetir, avisos|null, items[] (compra)} */
(function (root) {
  'use strict';

  var NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
    nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16,
    diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22,
    veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
    veintiocho: 28, veintinueve: 29, treinta: 30, treintaiuno: 31, media: 30, cuarto: 15 };
  var NUMW = Object.keys(NUM).filter(function (k) { return k !== 'media' && k !== 'cuarto'; })
    .sort(function (a, b) { return b.length - a.length; }).join('|');
  var N = '(\\d{1,2}|' + NUMW + ')';
  var DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var CATS = [
    ['salud', /\b(medic[oa]s?|doctor[a]?|dentista|ambulatorio|centro de salud|osakidetza|hospital|analisis|analitica|consulta|farmacia|fisio\w*|oculista|optica|pediatra|vacuna|revision medica|ginecolog\w*|dermatolog\w*|traumatolog\w*|enfermer[ao]|receta)\b/],
    ['futbol', /\b(entreno|entrenamiento|partido|futbol|juvenil|cadete|regional|convocatoria|federacion|campo|vestuario|equipo)\b/],
    ['coche', /\b(coche|itv|taller|ruedas?|neumaticos?|aceite|gasolina|seguro del coche|passat|revision del coche)\b/],
    ['papeleo', /\b(banco|hacienda|notari[ao]|gestori[ao]|ayuntamiento|papeles|declaracion|renta|factura|recibo|seguro|abogado|registro|dni|pasaporte|tramite|certificado|firma|hipoteca|piso)\b/],
    ['casa', /\b(casa|limpiar|lavadora|basura|fontanero|electricista|reparar|arreglar|recoger|jardin|plantas|colada|reciclaje|compra)\b/],
    ['familia', /\b(cumple\w*|aniversario|boda|cena|comida|aita|ama|madre|padre|mama|papa|hij[oa]|suegr[oa]s?|familia|abuel[oa]s?|cabezon|urtzi|la nina)\b/]
  ];

  function sinAcentos(s) {
    var a = 'áàäâéèëêíìïîóòöôúùüûñÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑ', b = 'aaaaeeeeiiiioooouuuunAAAAEEEEIIIIOOOOUUUUN';
    var o = '';
    for (var i = 0; i < s.length; i++) { var j = a.indexOf(s[i]); o += j >= 0 ? b[j] : s[i]; }
    return o;
  }
  function num(t) { if (t == null) return null; t = String(t).trim(); return /^\d+$/.test(t) ? parseInt(t, 10) : (NUM[t] != null ? NUM[t] : null); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }

  function parse(texto, ahora) {
    ahora = ahora || new Date();
    var hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    var orig = String(texto || '').replace(/\s+/g, ' ').trim();
    var s = sinAcentos(orig).toLowerCase();
    var quitar = []; // [ini, fin]
    var kind = 'tipo';
    function q(m, offset) { if (m) quitar.push([m.index + (offset || 0), m.index + m[0].length, kind]); }
    var r = { tipo: null, titulo: '', fecha: null, hora: null, categoria: null, repetir: 'no', avisos: null, items: null };
    var m;

    // ---- tipo explícito al inicio
    if ((m = /^(apunta(r|me)?\s+)?(una\s+)?(nota|idea)\s*[:,.]?\s*/.exec(s))) { r.tipo = 'nota'; q(m); }
    else if ((m = /^((hay que |tengo que |tenemos que )?comprar|(anade|apunta|pon|mete)( en| a)? la (lista de la )?compra|lista de la compra|para la compra|compra|falta(n)?)\s*[:,.]?\s*/.exec(s))) {
      var resto = orig.slice(m[0].length).replace(/[.]+$/, '');
      var items = resto.split(/\s*(?:,|;|\by\b|\be\b|\bmas\b|\bmás\b)\s*/i).map(function (x) {
        x = x.replace(/^(un|una|unos|unas|el|la|los|las|de|algo de)\s+/i, '').trim();
        return x.charAt(0).toUpperCase() + x.slice(1);
      }).filter(Boolean);
      return { tipo: 'compra', titulo: items.join(', '), items: items, fecha: null, hora: null, categoria: null, repetir: 'no', avisos: null };
    }
    var recuerda = false;
    if ((m = /^(recuerda(me|le)?( que)?|recordar|recordatorio|avisame( de| que)?|no olvidar|no te olvides de)\s*[:,]?\s*/.exec(s))) { recuerda = true; q(m); }

    kind = 'aviso';
    // ---- avisos dictados: "avísame una hora antes", "con un día de antelación"
    var reAv = new RegExp('(,?\\s*(y\\s+)?(avisame|recuerdamelo|avisa|recuerdame)\\s+)?(con\\s+)?' + N + '?\\s*(un|una|media)?\\s*(minutos?|horas?|dias?|semanas?)\\s+(antes|de antelacion)', 'g');
    while ((m = reAv.exec(s))) {
      var cant = num(m[5]) || (m[6] === 'media' ? 0.5 : 1), u = m[7];
      var mins = /^min/.test(u) ? cant : /^hora/.test(u) ? cant * 60 : /^dia/.test(u) ? cant * 1440 : cant * 10080;
      (r.avisos = r.avisos || []).push(Math.round(mins)); q(m);
    }

    kind = 'rep';
    // ---- repetición
    if ((m = /\b(todos los dias|cada dia|a diario|diariamente)\b/.exec(s))) { r.repetir = 'diario'; q(m); }
    else if ((m = /\b(todos los|todas las|cada)\s+(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)\b/.exec(s))) {
      r.repetir = 'semanal'; var dn = DIAS.indexOf(m[2].replace(/(sabado|domingo)s$/, '$1'));
      var df = (dn - hoy.getDay() + 7) % 7; r.fecha = ymd(addDays(hoy, df)); r._diaRep = true; q(m);
    }
    else if ((m = /\b(todas las semanas|cada semana|semanalmente)\b/.exec(s))) { r.repetir = 'semanal'; q(m); }
    else if ((m = /\b(todos los meses|cada mes|mensualmente|mensual)\b/.exec(s))) { r.repetir = 'mensual'; q(m); }
    else if ((m = /\b(todos los anos|cada ano|anualmente|anual)\b/.exec(s))) { r.repetir = 'anual'; q(m); }

    kind = 'hora';
    // ---- hora
    var hora = null, mi = 0, franja = null;
    var reH = new RegExp('\\b(?:a|sobre|hacia|para|desde|de)\\s+(?:las|la)\\s+' + N + '(?:\\s*[:.h]\\s*(\\d{2}))?' +
      '(?:\\s+(y\\s+media|y\\s+cuarto|menos\\s+cuarto|y\\s+' + N + '(?:\\s+minutos)?|menos\\s+' + N + '))?' +
      '(?:\\s*(?:de\\s+la|por\\s+la|del)\\s+(manana|tarde|noche|mediodia|madrugada)|\\s*(am|pm|h)\\b)?');
    if ((m = reH.exec(s))) {
      hora = num(m[1]); if (m[2]) mi = parseInt(m[2], 10);
      if (m[3]) {
        var t = m[3].replace(/\s+/g, ' ');
        if (t === 'y media') mi = 30; else if (t === 'y cuarto') mi = 15;
        else if (t === 'menos cuarto') { hora -= 1; mi = 45; }
        else if (m[4]) mi = num(m[4]); else if (m[5]) { hora -= 1; mi = 60 - num(m[5]); }
      }
      franja = m[6] || (m[7] === 'pm' ? 'tarde' : m[7] === 'am' ? 'manana' : m[7] === 'h' ? 'h' : null);
      q(m);
    } else if ((m = /\b(\d{1,2})(?::|\.|h)(\d{2})\b|\b(\d{1,2})\s?h\b/.exec(s))) {
      hora = parseInt(m[1] || m[3], 10); mi = m[2] ? parseInt(m[2], 10) : 0; franja = 'h'; q(m);
    } else if ((m = /\b(a|al)\s+mediodia\b/.exec(s))) { hora = 14; franja = 'h'; q(m); }
    else if ((m = /\b(a\s+)?primera hora\b/.exec(s))) { hora = 9; franja = 'h'; q(m); }
    if (hora != null) {
      if (franja === 'tarde' && hora < 12) hora += 12;
      else if (franja === 'noche') { if (hora === 12) hora = 0; else if (hora >= 7 && hora < 12) hora += 12; }
      else if (franja === 'mediodia' && hora < 5) hora += 12;
      else if (franja === 'manana' && hora === 12) hora = 12;
      else if (!franja && hora >= 1 && hora <= 7) hora += 12;
      if (hora > 23 || mi > 59 || hora < 0) hora = null;
      if (hora != null) r.hora = pad(hora) + ':' + pad(mi);
    }

    kind = 'fecha';
    // ---- fecha
    var f = null;
    var reMes = new RegExp('\\b(?:el\\s+)?(?:dia\\s+)?' + N + '\\s+de\\s+(' + MESES.join('|') + ')(?:\\s+(?:de|del)\\s+(\\d{4}))?');
    if ((m = reMes.exec(s))) {
      var d = num(m[1]), mo = MESES.indexOf(m[2]), y = m[3] ? +m[3] : hoy.getFullYear();
      f = new Date(y, mo, d); if (!m[3] && f < hoy) f = new Date(y + 1, mo, d); q(m);
    } else if ((m = /\b(?:el\s+)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/.exec(s))) {
      var y2 = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : hoy.getFullYear();
      f = new Date(y2, +m[2] - 1, +m[1]); if (!m[3] && f < hoy) f = new Date(y2 + 1, +m[2] - 1, +m[1]); q(m);
    } else if ((m = /\bpasado\s+manana\b/.exec(s))) { f = addDays(hoy, 2); q(m); }
    else if ((m = /\b(?:para\s+|de\s+)?manana\b(?!\s+de)/.exec(s)) && !/(de|por|esta)\s+la\s+$/.test(s.slice(0, m.index)) && !/\bla\s+$/.test(s.slice(0, m.index))) { f = addDays(hoy, 1); q(m); }
    else if ((m = /\b(?:para\s+)?(hoy|esta\s+tarde|esta\s+noche|esta\s+manana|ahora)\b/.exec(s))) {
      f = hoy; if (!r.hora) { if (/tarde/.test(m[1])) r.hora = '17:00'; else if (/noche/.test(m[1])) r.hora = '21:00'; }
      q(m);
    }
    else if ((m = new RegExp('\\b(?:dentro\\s+de|en)\\s+' + N + '?\\s*(un|una)?\\s*(dias?|semanas?|mes(?:es)?)\\b').exec(s))) {
      var c2 = num(m[1]) || 1, u2 = m[3];
      if (/^dia/.test(u2)) f = addDays(hoy, c2); else if (/^sem/.test(u2)) f = addDays(hoy, 7 * c2);
      else { f = new Date(hoy.getFullYear(), hoy.getMonth() + c2, hoy.getDate()); }
      q(m);
    }
    else if ((m = /\b(?:la\s+)?(?:semana\s+que\s+viene|proxima\s+semana|semana\s+proxima)\b/.exec(s))) { f = addDays(hoy, 7); q(m); }
    else if ((m = /\b(?:este|el)\s+(?:fin\s+de\s+semana|finde)\b/.exec(s))) { f = addDays(hoy, (6 - hoy.getDay() + 7) % 7 || 7); q(m); }
    else if ((m = new RegExp('\\b(?:el\\s+|este\\s+|el\\s+proximo\\s+|proximo\\s+|para\\s+el\\s+)?(' + DIAS.join('|') + ')(\\s+que\\s+viene|\\s+proximo|\\s+de\\s+la\\s+semana\\s+que\\s+viene)?\\b').exec(s)) && !r._diaRep) {
      var dw = DIAS.indexOf(m[1]); var diff = (dw - hoy.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      if (m[2] && /semana que viene/.test(m[2]) && diff < 7) diff += 7;
      f = addDays(hoy, diff); q(m);
    } else if ((m = new RegExp('\\b(?:el\\s+dia|el|dia)\\s+' + N + '\\b(?!\\s*(?:de\\s+la|minutos|horas|dias))').exec(s)) && !/\b(a|las|la)\s*$/.test(s.slice(0, m.index))) {
      var dd = num(m[1]);
      if (dd >= 1 && dd <= 31) { f = new Date(hoy.getFullYear(), hoy.getMonth(), dd); if (f < hoy) f = new Date(hoy.getFullYear(), hoy.getMonth() + 1, dd); q(m); }
    }
    if (f) r.fecha = ymd(f);
    if (r.hora && !r.fecha) {
      // solo hora: hoy si aún no ha pasado, si no mañana
      var hh = r.hora.split(':'); var cand = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), +hh[0], +hh[1]);
      r.fecha = ymd(cand > ahora ? hoy : addDays(hoy, 1));
    }

    // ---- título: quitar trozos reconocidos
    quitar.sort(function (a, b) { return a[0] - b[0]; });
    var t2 = '', pos = 0;
    quitar.forEach(function (z) { if (z[0] >= pos) { t2 += orig.slice(pos, z[0]) + ' '; pos = z[1]; } else if (z[1] > pos) pos = z[1]; });
    t2 += orig.slice(pos);
    t2 = t2.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
    var limpio = sinAcentos(t2).toLowerCase();
    var cambios = true;
    while (cambios) {
      cambios = false;
      var ini = /^(y|e|que|tengo|tenemos|hay|el|para|de|a|,|\.|:)\s+/.exec(limpio + ' ');
      if (ini && limpio.length > ini[0].length) { t2 = t2.slice(ini[0].length - (ini[0].length > limpio.length ? 1 : 0)).trim(); limpio = sinAcentos(t2).toLowerCase(); cambios = true; }
      var fin = /(\s+(y|e|a|el|la|las|los|de|del|para|en|con|que|,|-))+\s*[,.]?$|[,.;:-]+$/.exec(limpio);
      if (fin && fin[0].length < limpio.length) { t2 = t2.slice(0, limpio.length - fin[0].length).trim(); limpio = sinAcentos(t2).toLowerCase(); cambios = true; }
    }
    if (/^que /.test(limpio)) t2 = t2.slice(4);
    r.titulo = t2 ? t2.charAt(0).toUpperCase() + t2.slice(1) : '';

    // ---- categoría
    var base = sinAcentos(orig).toLowerCase();
    for (var i = 0; i < CATS.length; i++) if (CATS[i][1].test(base)) { r.categoria = CATS[i][0]; break; }

    // ---- tipo
    if (!r.tipo) {
      if (r.hora) r.tipo = 'cita';
      else if (r.fecha && (/\b(cita|consulta|reunion|cumple\w*|boda|cena|comida|partido|aniversario|viaje|vacaciones|fiesta|examen|entrevista)\b/.test(base) || r.categoria === 'salud') && !recuerda) r.tipo = 'cita';
      else r.tipo = 'tarea';
    }
    delete r._diaRep;
    r.rangos = quitar.map(function (z) { return { ini: z[0], fin: z[1], k: z[2] }; });
    return r;
  }

  var api = { parse: parse, sinAcentos: sinAcentos, ymd: ymd };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NLP = api;
})(this);
