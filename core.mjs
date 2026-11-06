// Gölge İzi: güneşin konumu, gölge boyu ve gölgeden yer tahmini.
// Güneş konumu NOAA'nın güneş hesaplayıcısındaki formüllerle (Jean Meeus'un kitabına dayanan) hesaplanıyor.

const R = Math.PI / 180;
const sin = d => Math.sin(d * R), cos = d => Math.cos(d * R), tan = d => Math.tan(d * R);
const asin = x => Math.asin(Math.max(-1, Math.min(1, x))) / R;
const acos = x => Math.acos(Math.max(-1, Math.min(1, x))) / R;
const mod = (a, n) => ((a % n) + n) % n;

// Güneşin o andaki temel değerleri (konumdan bağımsız)
export function gunes(utcMs) {
  const JD = utcMs / 86400000 + 2440587.5;
  const T = (JD - 2451545) / 36525;
  const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + sin(2 * M) * (0.019993 - 0.000101 * T) + sin(3 * M) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * sin(omega);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * cos(omega);
  const egim = asin(sin(eps) * sin(lambda));                  // deklinasyon
  const y = tan(eps / 2) ** 2;
  const zamanDenklemi = 4 / R * (y * sin(2 * L0) - 2 * e * sin(M) + 4 * e * y * sin(M) * cos(2 * L0)
    - 0.5 * y * y * sin(4 * L0) - 1.25 * e * e * sin(2 * M));    // dakika
  return { egim, zamanDenklemi };
}

// Atmosferin kırma etkisi (NOAA'nın yaklaşık formülü), derece
export function kirilma(h) {
  if (h > 85) return 0;
  const t = tan(h);
  let s;
  if (h > 5) s = 58.1 / t - 0.07 / t ** 3 + 0.000086 / t ** 5;
  else if (h > -0.575) s = 1735 + h * (-518.2 + h * (103.4 + h * (-12.79 + h * 0.711)));
  else s = -20.774 / t;
  return s / 3600;
}

// Bir yerde güneşin yüksekliği (ufuktan derece) ve azimutu (kuzeyden saat yönünde derece)
export function gunesKonumu(utcMs, enlem, boylam) {
  const { egim, zamanDenklemi } = gunes(utcMs);
  const gunDakika = mod(utcMs / 60000, 1440);
  const gercekGunes = mod(gunDakika + zamanDenklemi + 4 * boylam, 1440);
  let saatAcisi = gercekGunes / 4 - 180;
  const cz = sin(enlem) * sin(egim) + cos(enlem) * cos(egim) * cos(saatAcisi);
  const zenit = acos(cz);
  const geometrik = 90 - zenit;
  let azimut;
  const payda = cos(enlem) * sin(zenit);
  if (Math.abs(payda) < 1e-9) azimut = enlem > 0 ? 180 : 0;
  else {
    const a = acos((sin(enlem) * cz - sin(egim)) / payda);
    azimut = saatAcisi > 0 ? mod(a + 180, 360) : mod(540 - a, 360);
  }
  return { yukseklik: geometrik + kirilma(geometrik), geometrik, azimut, egim, zamanDenklemi };
}

// --- Gölge ---
// Cismin boyu h ise gölgesi h / tan(yükseklik). Gölge güneşin tam tersini gösterir.
export function golge(boy, yukseklik) {
  if (yukseklik <= 0) return { uzunluk: Infinity, oran: Infinity };
  const oran = 1 / tan(yukseklik);
  return { uzunluk: boy * oran, oran };
}
export const golgeYonu = azimut => mod(azimut + 180, 360);
// Fotoğraftaki ölçüden güneşin yüksekliği
export const yukseklikBul = (boy, golgeBoyu) => (boy > 0 && golgeBoyu > 0 ? Math.atan(boy / golgeBoyu) / R : null);

// --- Yerel saat <-> UTC ---
// tarih "YYYY-MM-DD", saat "HH:MM", fark: UTC'den kaç saat ileri (İstanbul +3)
export function utc(tarih, saat, fark) {
  const [Y, A, G] = tarih.split('-').map(Number);
  const [s, d] = saat.split(':').map(Number);
  return Date.UTC(Y, A - 1, G, s, d) - fark * 3600000;
}

// --- Gölgeden yer bulma ---
// Bütün dünyayı 1 derecelik ızgarayla tarıyorum. Her noktada güneşin o andaki yüksekliğini
// (ve verildiyse azimutunu) ölçüyle karşılaştırıyorum. Hata tolerans içindeyse aday.
const azFark = (a, b) => { const d = Math.abs(mod(a, 360) - mod(b, 360)); return Math.min(d, 360 - d); };

export function yerBul(utcMs, olcum, { adim = 1, yTol = 1, aTol = 6, enlemAlt = -60, enlemUst = 72 } = {}) {
  const adaylar = [];
  for (let en = enlemAlt; en <= enlemUst; en += adim) {
    for (let bo = -180; bo < 180; bo += adim) {
      const g = gunesKonumu(utcMs, en, bo);
      if (g.yukseklik <= 0) continue;
      const dY = Math.abs(g.yukseklik - olcum.yukseklik) / yTol;
      const dA = olcum.azimut == null ? 0 : azFark(g.azimut, olcum.azimut) / aTol;
      const puan = Math.max(dY, dA);
      if (puan <= 1) adaylar.push({ enlem: en, boylam: bo, puan });
    }
  }
  adaylar.sort((a, b) => a.puan - b.puan);
  return adaylar;
}

// İki nokta arası büyük çember uzaklığı (km)
export function uzaklik(e1, b1, e2, b2) {
  const a = sin((e2 - e1) / 2) ** 2 + cos(e1) * cos(e2) * sin((b2 - b1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Şehirlerin her birinde o anki güneşle ölçü ne kadar uyuşuyor?
export function sehirPuanlari(utcMs, olcum, sehirler = SEHIRLER, { yTol = 1, aTol = 6 } = {}) {
  return sehirler.map(s => {
    const g = gunesKonumu(utcMs, s.enlem, s.boylam);
    const dY = Math.abs(g.yukseklik - olcum.yukseklik);
    const dA = olcum.azimut == null ? 0 : azFark(g.azimut, olcum.azimut);
    return { ...s, yukseklik: g.yukseklik, azimut: g.azimut, dY, dA, puan: Math.max(dY / yTol, dA / aTol), gunduz: g.yukseklik > 0 };
  }).sort((a, b) => a.puan - b.puan);
}

// --- Bir günün gölge eğrisi ---
export function gunlukEgri(tarih, fark, enlem, boylam, boy = 1, adimDk = 10) {
  const bas = utc(tarih, '00:00', fark);
  const out = [];
  for (let dk = 0; dk <= 1440; dk += adimDk) {
    const g = gunesKonumu(bas + dk * 60000, enlem, boylam);
    out.push({ dk, yukseklik: g.yukseklik, azimut: g.azimut, golge: g.yukseklik > 0 ? golge(boy, g.yukseklik).uzunluk : null });
  }
  return out;
}

// Gün doğumu / batımı (geometrik yükseklik -0,833°) ve öğle — yerel dakika
// Doğuş ve batışı öğlenin 12 saat öncesinde ve sonrasında arıyorum; kuzeyde güneş gece yarısından
// sonra batabiliyor (Reykjavik'te Haziran'da). Değer 1440'tan büyükse ertesi gün, eksiyse önceki gün.
export function gunOlaylari(tarih, fark, enlem, boylam) {
  const bas = utc(tarih, '00:00', fark);
  const h = dk => gunesKonumu(bas + dk * 60000, enlem, boylam).geometrik + 0.833;
  const kok = (a, b) => { for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (Math.sign(h(m)) === Math.sign(h(a))) a = m; else b = m; } return (a + b) / 2; };
  let ogle = 0, enY = -99;
  for (let dk = 0; dk <= 1440; dk += 5) { const y = h(dk); if (y > enY) { enY = y; ogle = dk; } }
  let a = Math.max(0, ogle - 5), b = Math.min(1440, ogle + 5);
  for (let i = 0; i < 40; i++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3; if (h(m1) < h(m2)) a = m1; else b = m2; }
  ogle = (a + b) / 2;
  const tepe = h(ogle);
  // Öğleden geriye ve ileriye 10'ar dakika yürüyüp işaret değişimini arıyorum
  const ara = yon => {
    if (tepe <= 0) return null;
    for (let d = 10; d <= 720; d += 10) {
      const t1 = ogle + yon * (d - 10), t2 = ogle + yon * d;
      if (h(t2) < 0) return yon < 0 ? kok(t2, t1) : kok(t1, t2);
    }
    return null;
  };
  const dogus = ara(-1), batis = ara(1);
  const enYuksek = gunesKonumu(bas + ogle * 60000, enlem, boylam).yukseklik;
  const gunduz = tepe <= 0 ? 0 : dogus == null || batis == null ? 1440 : batis - dogus;
  return { dogus, ogle, batis, enYuksek, gunduz };
}

// Bir saat diliminin o tarihteki UTC farkı (saat), tarayıcının saat dilimi verisinden
export function utcFarki(tz, tarih) {
  const [Y, A, G] = tarih.split('-').map(Number);
  const an = Date.UTC(Y, A - 1, G, 12);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(an).map(x => [x.type, x.value]));
  return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - an) / 3600000;
}

export const saatYaz = dk => (dk == null ? '—' : `${String(Math.floor(mod(dk, 1440) / 60)).padStart(2, '0')}:${String(Math.floor(mod(dk, 60))).padStart(2, '0')}`);
export const gunNotu = dk => (dk == null ? '' : dk >= 1440 ? ' (ertesi gün)' : dk < 0 ? ' (önceki gün)' : '');

const YONLER = ['K', 'KKD', 'KD', 'DKD', 'D', 'DGD', 'GD', 'GGD', 'G', 'GGB', 'GB', 'BGB', 'B', 'BKB', 'KB', 'KKB'];
export const yonAdi = az => YONLER[Math.round(mod(az, 360) / 22.5) % 16];

// --- Şehirler (yaklaşık koordinatlar ve saat dilimleri) ---
const SAAT_DILIMI = {"İstanbul": "Europe/Istanbul", "Ankara": "Europe/Istanbul", "İzmir": "Europe/Istanbul", "Antalya": "Europe/Istanbul", "Trabzon": "Europe/Istanbul", "Diyarbakır": "Europe/Istanbul", "Van": "Europe/Istanbul", "Atina": "Europe/Athens", "Sofya": "Europe/Sofia", "Bükreş": "Europe/Bucharest", "Kiev": "Europe/Kyiv", "Moskova": "Europe/Moscow", "Varşova": "Europe/Warsaw", "Berlin": "Europe/Berlin", "Viyana": "Europe/Vienna", "Roma": "Europe/Rome", "Paris": "Europe/Paris", "Madrid": "Europe/Madrid", "Londra": "Europe/London", "Oslo": "Europe/Oslo", "Reykjavik": "Atlantic/Reykjavik", "Kahire": "Africa/Cairo", "Tunus": "Africa/Tunis", "Lagos": "Africa/Lagos", "Nairobi": "Africa/Nairobi", "Johannesburg": "Africa/Johannesburg", "Tahran": "Asia/Tehran", "Bakü": "Asia/Baku", "Dubai": "Asia/Dubai", "Riyad": "Asia/Riyadh", "Karaçi": "Asia/Karachi", "Delhi": "Asia/Kolkata", "Mumbai": "Asia/Kolkata", "Dakka": "Asia/Dhaka", "Bangkok": "Asia/Bangkok", "Singapur": "Asia/Singapore", "Cakarta": "Asia/Jakarta", "Pekin": "Asia/Shanghai", "Şanghay": "Asia/Shanghai", "Seul": "Asia/Seoul", "Tokyo": "Asia/Tokyo", "Manila": "Asia/Manila", "Sidney": "Australia/Sydney", "Perth": "Australia/Perth", "Auckland": "Pacific/Auckland", "Honolulu": "Pacific/Honolulu", "Los Angeles": "America/Los_Angeles", "Mexico City": "America/Mexico_City", "Chicago": "America/Chicago", "New York": "America/New_York", "Toronto": "America/Toronto", "Bogota": "America/Bogota", "Lima": "America/Lima", "São Paulo": "America/Sao_Paulo", "Buenos Aires": "America/Argentina/Buenos_Aires"};
export const SEHIRLER = [
  ['İstanbul', 41.01, 28.98], ['Ankara', 39.93, 32.86], ['İzmir', 38.42, 27.14], ['Antalya', 36.9, 30.7], ['Trabzon', 41.0, 39.72],
  ['Diyarbakır', 37.91, 40.24], ['Van', 38.5, 43.38], ['Atina', 37.98, 23.73], ['Sofya', 42.7, 23.32], ['Bükreş', 44.43, 26.1],
  ['Kiev', 50.45, 30.52], ['Moskova', 55.76, 37.62], ['Varşova', 52.23, 21.01], ['Berlin', 52.52, 13.4], ['Viyana', 48.21, 16.37],
  ['Roma', 41.9, 12.5], ['Paris', 48.86, 2.35], ['Madrid', 40.42, -3.7], ['Londra', 51.51, -0.13], ['Oslo', 59.91, 10.75],
  ['Reykjavik', 64.15, -21.94], ['Kahire', 30.04, 31.24], ['Tunus', 36.81, 10.18], ['Lagos', 6.52, 3.38], ['Nairobi', -1.29, 36.82],
  ['Johannesburg', -26.2, 28.05], ['Tahran', 35.69, 51.39], ['Bakü', 40.41, 49.87], ['Dubai', 25.2, 55.27], ['Riyad', 24.71, 46.68],
  ['Karaçi', 24.86, 67.0], ['Delhi', 28.61, 77.21], ['Mumbai', 19.08, 72.88], ['Dakka', 23.81, 90.41], ['Bangkok', 13.76, 100.5],
  ['Singapur', 1.35, 103.82], ['Cakarta', -6.2, 106.85], ['Pekin', 39.9, 116.4], ['Şanghay', 31.23, 121.47], ['Seul', 37.57, 126.98],
  ['Tokyo', 35.68, 139.69], ['Manila', 14.6, 120.98], ['Sidney', -33.87, 151.21], ['Perth', -31.95, 115.86], ['Auckland', -36.85, 174.76],
  ['Honolulu', 21.31, -157.86], ['Los Angeles', 34.05, -118.24], ['Mexico City', 19.43, -99.13], ['Chicago', 41.88, -87.63], ['New York', 40.71, -74.01],
  ['Toronto', 43.65, -79.38], ['Bogota', 4.71, -74.07], ['Lima', -12.05, -77.04], ['São Paulo', -23.55, -46.63], ['Buenos Aires', -34.6, -58.38],
].map(([ad, enlem, boylam]) => ({ ad, enlem, boylam, tz: SAAT_DILIMI[ad] }));

// --- Uydurma örnek ---
// Ölçüleri kendim hesapladım: İstanbul, 15 Haziran 2026, 16:00 (UTC+3), 2 m'lik direk.
export const ORNEK = { tarih: '2026-06-15', saat: '16:00', fark: 3, boy: 200, golgeBoy: 171, golgeYon: 78 };
