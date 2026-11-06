import { utcFarki, gunNotu, gunesKonumu, golge, golgeYonu, yukseklikBul, utc, yerBul, sehirPuanlari, gunlukEgri, gunOlaylari, saatYaz, yonAdi, SEHIRLER, ORNEK } from './core.mjs';

const $ = id => document.getElementById(id);
const ANAHTAR = 'golge-izi-v1';
const sayi = (n, d = 1) => n.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
const kacama = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enlemYaz = e => `${sayi(Math.abs(e), 0)}°${e >= 0 ? 'K' : 'G'}`;
const boylamYaz = b => `${sayi(Math.abs(b), 0)}°${b >= 0 ? 'D' : 'B'}`;

let ayar = { ...ORNEK, yonBiliniyor: true, yTol: 1, aTol: 6, hSehir: 'İstanbul', hTarih: '2026-06-21', hFark: 3, hEnlem: 41.01, hBoylam: 28.98, hBoy: 100 };
try { const s = JSON.parse(localStorage.getItem(ANAHTAR)); if (s && !new URLSearchParams(location.search).has('ornek')) ayar = { ...ayar, ...s }; } catch { /* yok */ }
const kaydet = () => { try { localStorage.setItem(ANAHTAR, JSON.stringify(ayar)); } catch { /* özel pencere */ } };

// ---------- Sekmeler ----------
let mod = new URLSearchParams(location.search).get('mod') === 'hesap' ? 'hesap' : 'bul';
function modGoster() {
  document.querySelectorAll('[data-mod]').forEach(b => b.classList.toggle('secili', b.dataset.mod === mod));
  $('bul').hidden = mod !== 'bul'; $('hesap').hidden = mod !== 'hesap';
  if (mod === 'bul') bulHesapla(); else gunHesapla();
}
document.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => { mod = b.dataset.mod; modGoster(); });

// ---------- Girdiler ----------
const ALAN_BUL = { tarih: 'tarih', saat: 'saat', fark: 'sayi', boy: 'sayi', golgeBoy: 'sayi', golgeYon: 'sayi', yTol: 'sayi', aTol: 'sayi' };
function doldur() {
  for (const k of Object.keys(ALAN_BUL)) $(k).value = ayar[k];
  $('yonBiliniyor').checked = ayar.yonBiliniyor;
  $('golgeYon').disabled = !ayar.yonBiliniyor;
  $('yTolYazi').textContent = `±${sayi(ayar.yTol)}°`; $('aTolYazi').textContent = `±${sayi(ayar.aTol, 0)}°`;
  $('hSehir').innerHTML = SEHIRLER.map(s => `<option>${s.ad}</option>`).join('') + '<option value="">Kendi koordinatım</option>';
  $('hSehir').value = ayar.hSehir;
  for (const k of ['hTarih', 'hFark', 'hEnlem', 'hBoylam', 'hBoy']) $(k).value = ayar[k];
}
for (const [k, tur] of Object.entries(ALAN_BUL)) {
  $(k).addEventListener('input', () => {
    const v = $(k).value;
    let iyi = v !== '';
    if (tur === 'sayi') iyi = iyi && Number.isFinite(+v);
    if (k === 'boy' || k === 'golgeBoy') iyi = iyi && +v > 0;
    if (k === 'fark') iyi = iyi && +v >= -12 && +v <= 14;
    $(k).classList.toggle('hatali', !iyi);
    if (!iyi) return;
    ayar[k] = tur === 'sayi' ? +v : v;
    if (k === 'yTol' || k === 'aTol') { $('yTolYazi').textContent = `±${sayi(ayar.yTol)}°`; $('aTolYazi').textContent = `±${sayi(ayar.aTol, 0)}°`; }
    kaydet(); bulHesapla();
  });
}
$('yonBiliniyor').onchange = () => { ayar.yonBiliniyor = $('yonBiliniyor').checked; $('golgeYon').disabled = !ayar.yonBiliniyor; kaydet(); bulHesapla(); };
$('ornek').onclick = () => { ayar = { ...ayar, ...ORNEK, yonBiliniyor: true, yTol: 1, aTol: 6 }; kaydet(); doldur(); bulHesapla(); };

// ---------- Harita ----------
const W = 1080, H = 420, ENUST = 75, ENALT = -60;
const px = b => (b + 180) / 360 * W;
const py = e => (ENUST - e) / (ENUST - ENALT) * H;

function haritaCiz(t, adaylar, enIyiSehirler) {
  const c = $('harita').getContext('2d');
  c.clearRect(0, 0, W, H);
  // Gece ve gündüz
  for (let e = ENUST; e > ENALT; e -= 3) for (let b = -180; b < 180; b += 3) {
    const g = gunesKonumu(t, e - 1.5, b + 1.5);
    c.fillStyle = g.yukseklik > 0 ? `rgba(95,215,255,${0.05 + 0.1 * Math.sin(g.yukseklik * Math.PI / 180)})` : 'rgba(0,0,0,0.35)';
    c.fillRect(px(b), py(e), 3 * W / 360 + 0.5, 3 * H / (ENUST - ENALT) + 0.5);
  }
  // Izgara
  c.strokeStyle = 'rgba(255,241,210,0.12)'; c.lineWidth = 1;
  c.font = '14px Rubik, sans-serif'; c.fillStyle = 'rgba(201,185,160,0.7)';
  for (let b = -150; b <= 150; b += 30) { c.beginPath(); c.moveTo(px(b), 0); c.lineTo(px(b), H); c.stroke(); }
  for (let e = -60; e <= 60; e += 30) { c.beginPath(); c.moveTo(0, py(e)); c.lineTo(W, py(e)); c.stroke(); c.fillText(e ? enlemYaz(e) : 'Ekvator', 6, py(e) - 4); }
  // Adaylar
  for (const a of adaylar) {
    c.fillStyle = a.puan < 0.5 ? 'rgba(255,207,58,0.95)' : 'rgba(255,138,61,0.55)';
    c.fillRect(px(a.boylam) - 0.5, py(a.enlem) - H / (ENUST - ENALT) + 0.5, W / 360 + 0.5, H / (ENUST - ENALT) + 0.5);
  }
  // Güneşin tepede olduğu nokta
  const g0 = gunesKonumu(t, 0, 0);
  let gb = -180, enY = -99;
  for (let b = -180; b < 180; b += 0.5) { const y = gunesKonumu(t, g0.egim, b).yukseklik; if (y > enY) { enY = y; gb = b; } }
  c.font = '26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('☀️', px(gb), py(g0.egim));
  // Şehirler
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const vurgulu = new Set(enIyiSehirler.slice(0, 1).filter(s => s.puan <= 1.5).map(s => s.ad));
  for (const s of SEHIRLER) {
    c.fillStyle = vurgulu.has(s.ad) ? '#fff1d2' : 'rgba(95,215,255,0.8)';
    c.beginPath(); c.arc(px(s.boylam), py(s.enlem), vurgulu.has(s.ad) ? 4 : 2.5, 0, 7); c.fill();
    if (vurgulu.has(s.ad)) { c.font = '700 18px Rubik, sans-serif'; c.strokeStyle = '#0d0709'; c.lineWidth = 4; c.strokeText(s.ad, px(s.boylam) + 14, py(s.enlem) - 12); c.fillText(s.ad, px(s.boylam) + 14, py(s.enlem) - 12); }
  }
  // En iyi nokta
  if (adaylar[0]) {
    c.strokeStyle = '#fff1d2'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(px(adaylar[0].boylam), py(adaylar[0].enlem), 11, 0, 7); c.stroke();
  }
}

function bulHesapla() {
  if (mod !== 'bul') return;
  const yuk = yukseklikBul(ayar.boy, ayar.golgeBoy);
  if (yuk === null || !/^\d{4}-\d{2}-\d{2}$/.test(ayar.tarih) || !/^\d{2}:\d{2}$/.test(ayar.saat)) return;
  const t = utc(ayar.tarih, ayar.saat, ayar.fark);
  const olcum = { yukseklik: yuk, azimut: ayar.yonBiliniyor ? golgeYonu(ayar.golgeYon) : null };
  $('gunesYazi').innerHTML = `Gölge boyunun ${sayi(ayar.golgeBoy / ayar.boy, 2)} katı → güneş ufuktan <b>${sayi(yuk)}°</b> yüksekte.`
    + (ayar.yonBiliniyor ? ` Gölge ${yonAdi(ayar.golgeYon)} yönünde (${ayar.golgeYon}°) → güneş <b>${yonAdi(olcum.azimut)}</b> tarafında (${sayi(olcum.azimut, 0)}°).` : ' Yön bilinmediği için aday yerler bir şerit oluşturuyor.');
  const adaylar = yerBul(t, olcum, { yTol: ayar.yTol, aTol: ayar.aTol });
  const sehir = sehirPuanlari(t, olcum, SEHIRLER, { yTol: ayar.yTol, aTol: ayar.aTol });
  haritaCiz(t, adaylar, sehir);
  $('enIyi').textContent = adaylar.length
    ? `${adaylar.length} olası nokta (1°'lik kareler). En uyumlu nokta: ${enlemYaz(adaylar[0].enlem)}, ${boylamYaz(adaylar[0].boylam)}.`
    : 'Bu ölçüyle dünyada uyan bir yer bulamadım. Saati, UTC farkını ya da ölçüleri kontrol etmeliyim; payı biraz büyütebilirim.';
  $('sehirler').innerHTML = sehir.filter(s => s.gunduz).slice(0, 6).map((s, i) => `<li class="${s.puan <= 1 ? 'uyar' : ''}"><span class="no">${i + 1}</span>
    <span class="ad">${kacama(s.ad)}</span><span class="fark">yükseklik ±${sayi(s.dY)}°${olcum.azimut != null ? ` · yön ±${sayi(s.dA, 0)}°` : ''}</span></li>`).join('')
    || '<li>O anda bu listedeki hiçbir şehirde güneş yukarıda değil.</li>';
}

// ---------- Gölge hesapla ----------
for (const k of ['hTarih', 'hFark', 'hEnlem', 'hBoylam', 'hBoy']) {
  $(k).addEventListener('input', () => {
    const v = $(k).value;
    const iyi = v !== '' && (k === 'hTarih' ? /^\d{4}-\d{2}-\d{2}$/.test(v) : Number.isFinite(+v)) && (k !== 'hBoy' || +v > 0) && (k !== 'hEnlem' || Math.abs(+v) < 89.5) && (k !== 'hBoylam' || Math.abs(+v) <= 180);
    $(k).classList.toggle('hatali', !iyi);
    if (!iyi) return;
    ayar[k] = k === 'hTarih' ? v : +v;
    // Tarih değişince seçili şehrin UTC farkı yaz saati yüzünden değişebilir
    const sec = SEHIRLER.find(x => x.ad === ayar.hSehir);
    if (k === 'hTarih' && sec) { ayar.hFark = utcFarki(sec.tz, v); $('hFark').value = ayar.hFark; }
    if (k === 'hEnlem' || k === 'hBoylam') { ayar.hSehir = ''; $('hSehir').value = ''; }
    kaydet(); gunHesapla();
  });
}
$('hSehir').onchange = () => {
  const s = SEHIRLER.find(x => x.ad === $('hSehir').value);
  ayar.hSehir = $('hSehir').value;
  if (s) {
    ayar.hEnlem = s.enlem; ayar.hBoylam = s.boylam; ayar.hFark = utcFarki(s.tz, ayar.hTarih);
    $('hEnlem').value = s.enlem; $('hBoylam').value = s.boylam; $('hFark').value = ayar.hFark;
  }
  kaydet(); gunHesapla();
};

function gunHesapla() {
  if (mod !== 'hesap') return;
  const { hTarih: tr, hFark: f, hEnlem: e, hBoylam: b, hBoy: boy } = ayar;
  const o = gunOlaylari(tr, f, e, b);
  const egri = gunlukEgri(tr, f, e, b, boy, 10);
  const ogleG = o.enYuksek > 0 ? golge(boy, o.enYuksek).uzunluk : null;
  $('olaylar').innerHTML = `<div><b>${saatYaz(o.dogus)}</b><span>gün doğumu${gunNotu(o.dogus)}</span></div>
    <div><b>${saatYaz(o.batis)}</b><span>gün batımı${gunNotu(o.batis)}</span></div>
    <div><b>${saatYaz(o.ogle)}</b><span>öğle (en kısa gölge)</span></div>
    <div><b>${o.enYuksek > 0 ? sayi(o.enYuksek) + '°' : '—'}</b><span>güneşin en yüksek hâli</span></div>
    <div><b>${ogleG !== null ? sayi(ogleG, 0) + ' cm' : '—'}</b><span>öğlen gölgesi (${sayi(boy, 0)} cm cisim)</span></div>
    <div><b>${o.gunduz >= 1440 ? '24 saat' : o.gunduz <= 0 ? '0' : `${Math.floor(o.gunduz / 60)} sa ${Math.round(o.gunduz % 60)} dk`}</b><span>gündüz süresi${o.gunduz >= 1440 ? ' (güneş batmıyor)' : o.gunduz <= 0 ? ' (güneş doğmuyor)' : ''}</span></div>`;

  // Gün içi gölge boyu
  const sv = $('egri'), ust = boy * 5, sol = 44, alt = 24;
  const x = dk => sol + dk / 1440 * (640 - sol - 8), y = L => 10 + (1 - Math.min(L, ust) / ust) * (240 - alt - 10);
  let h = '';
  for (let k = 0; k <= 5; k++) { const L = ust * k / 5; h += `<line x1="${sol}" x2="632" y1="${y(L)}" y2="${y(L)}" stroke="#3a1a1e"/><text x="${sol - 6}" y="${y(L) + 4}" fill="#c9b9a0" font-size="11" text-anchor="end">${sayi(L / 100, 1)} m</text>`; }
  for (let s = 0; s <= 24; s += 3) h += `<text x="${x(s * 60)}" y="236" fill="#c9b9a0" font-size="11" text-anchor="middle">${String(s).padStart(2, '0')}</text>`;
  let yol = '', acik = false;
  for (const p of egri) {
    if (p.golge === null) { acik = false; continue; }
    yol += `${acik ? 'L' : 'M'}${x(p.dk).toFixed(1)},${y(p.golge).toFixed(1)} `; acik = true;
  }
  h += `<path d="${yol}" fill="none" stroke="#ffcf3a" stroke-width="3" stroke-linejoin="round"/>`;
  if (ogleG !== null) h += `<line x1="${x(o.ogle)}" x2="${x(o.ogle)}" y1="10" y2="${240 - alt}" stroke="#5fd7ff" stroke-dasharray="4 4"/><text x="${x(o.ogle) + 4}" y="22" fill="#5fd7ff" font-size="11">öğle</text>`;
  sv.innerHTML = h;

  // Yukarıdan bakış
  const R = 150, olcek = R / (boy * 3);
  let k = `<circle r="${R}" fill="#0a1418" stroke="#3a1a1e"/><circle r="${R / 3}" fill="none" stroke="#3a1a1e" stroke-dasharray="3 4"/><circle r="${2 * R / 3}" fill="none" stroke="#3a1a1e" stroke-dasharray="3 4"/>`;
  for (const [ad, a] of [['K', 0], ['D', 90], ['G', 180], ['B', 270]]) k += `<text x="${Math.sin(a * Math.PI / 180) * (R - 12)}" y="${-Math.cos(a * Math.PI / 180) * (R - 12) + 4}" fill="#c9b9a0" font-size="12" text-anchor="middle" font-weight="800">${ad}</text>`;
  let iz = '', ac = false;
  for (const p of egri) {
    if (p.golge === null || p.golge * olcek > R) { ac = false; continue; }
    const d = golgeYonu(p.azimut) * Math.PI / 180, r = p.golge * olcek;
    iz += `${ac ? 'L' : 'M'}${(Math.sin(d) * r).toFixed(1)},${(-Math.cos(d) * r).toFixed(1)} `; ac = true;
    if (p.dk % 60 === 0) k += `<circle cx="${Math.sin(d) * r}" cy="${-Math.cos(d) * r}" r="3" fill="#ffcf3a"/><text x="${Math.sin(d) * r}" y="${-Math.cos(d) * r - 7}" fill="#fff1d2" font-size="10" text-anchor="middle">${p.dk / 60}</text>`;
  }
  k += `<path d="${iz}" fill="none" stroke="#ff8a3d" stroke-width="2"/><circle r="4" fill="#fff1d2"/>`;
  $('kadran').innerHTML = k;
}

doldur();
modGoster();
