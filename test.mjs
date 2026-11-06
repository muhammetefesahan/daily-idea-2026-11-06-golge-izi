import assert from 'node:assert/strict';
import { utcFarki, gunNotu, gunes, kirilma, gunesKonumu, golge, golgeYonu, yukseklikBul, utc, yerBul, uzaklik, sehirPuanlari, gunlukEgri, gunOlaylari, saatYaz, yonAdi, SEHIRLER, ORNEK } from './core.mjs';

let checks = 0;
const ok = fn => { fn(); checks++; };
const near = (a, b, e) => assert.ok(Math.abs(a - b) <= e, `${a} ≠ ${b} (±${e})`);
const IST = [41.01, 28.98];

// 1. Zaman ve tarih
ok(() => assert.equal(utc('2026-06-15', '16:00', 3), Date.UTC(2026, 5, 15, 13, 0)));
ok(() => assert.equal(utc('2026-01-01', '01:30', 3), Date.UTC(2025, 11, 31, 22, 30)));
ok(() => assert.equal(saatYaz(332), '05:32'));
ok(() => assert.equal(saatYaz(null), '—'));

// 2. Güneşin eğimi (deklinasyon): gün dönümlerinde ±23,44°, ekinokslarda ~0
ok(() => near(gunes(Date.UTC(2026, 5, 21, 12)).egim, 23.44, 0.02));
ok(() => near(gunes(Date.UTC(2026, 11, 21, 12)).egim, -23.44, 0.02));
ok(() => near(gunes(Date.UTC(2026, 2, 20, 14)).egim, 0, 0.1));
// Zaman denklemi: Kasım başında en büyük (~+16,4 dk), Şubat ortasında en küçük (~-14,2 dk)
ok(() => near(gunes(Date.UTC(2026, 10, 3, 12)).zamanDenklemi, 16.4, 0.2));
ok(() => near(gunes(Date.UTC(2026, 1, 11, 12)).zamanDenklemi, -14.2, 0.2));

// 3. İstanbul'un gün olayları (yerel saat, UTC+3)
const haz = gunOlaylari('2026-06-21', 3, ...IST);
ok(() => near(haz.dogus, 5 * 60 + 31, 3));          // ~05:31
ok(() => near(haz.batis, 20 * 60 + 40, 3));         // ~20:40
ok(() => near(haz.enYuksek, 90 - 41.01 + 23.44, 0.1));   // öğlen yüksekliği = 90 − enlem + eğim
const ara = gunOlaylari('2026-12-21', 3, ...IST);
ok(() => near(ara.enYuksek, 90 - 41.01 - 23.44, 0.15));
ok(() => assert.ok(haz.batis - haz.dogus > 15 * 60 && ara.batis - ara.dogus < 9.5 * 60));
// Öğlende güneş tam güneyde
ok(() => near(gunesKonumu(utc('2026-06-21', saatYaz(haz.ogle), 3), ...IST).azimut, 180, 1));
// Ekvatorda ekinoks öğlesinde güneş neredeyse tepede
const ekv = gunOlaylari('2026-03-20', 0, 0, 0);
ok(() => assert.ok(ekv.enYuksek > 89.5));
// Kutup yazı: Kuzey Kutbu'na yakın, Haziran'da güneş batmıyor
ok(() => assert.equal(gunOlaylari('2026-06-21', 0, 80, 0).batis, null));

// 4. Güney yarım kürede öğlen güneşi kuzeyde
const sid = gunOlaylari('2026-06-21', 10, -33.87, 151.21);
const sidAz = gunesKonumu(utc('2026-06-21', saatYaz(sid.ogle), 10), -33.87, 151.21).azimut;
ok(() => assert.ok(sidAz < 2 || sidAz > 358));
// Sabah doğu, akşam batı
ok(() => assert.ok(gunesKonumu(utc('2026-06-21', '08:00', 3), ...IST).azimut < 100));
ok(() => assert.ok(gunesKonumu(utc('2026-06-21', '18:00', 3), ...IST).azimut > 260));

// 5. Kırılma: ufukta yarım dereceden fazla, tepede sıfır
ok(() => near(kirilma(0), 0.48, 0.03));
ok(() => assert.equal(kirilma(89), 0));
ok(() => assert.ok(kirilma(10) < kirilma(1)));

// 6. Gölge
ok(() => near(golge(100, 45).uzunluk, 100, 1e-9));           // 45°de gölge boy kadar
ok(() => near(golge(100, 30).uzunluk, 100 * Math.sqrt(3), 1e-9));
ok(() => assert.equal(golge(100, -2).uzunluk, Infinity));
ok(() => near(yukseklikBul(100, 100), 45, 1e-9));
ok(() => assert.equal(yukseklikBul(0, 5), null));
ok(() => assert.equal(golgeYonu(250), 70));
ok(() => assert.equal(golgeYonu(90), 270));
ok(() => assert.equal(yonAdi(0), 'K'));
ok(() => assert.equal(yonAdi(260), 'B'));
ok(() => assert.equal(yonAdi(78), 'DKD'));   // 67,5° (DKD) 90°'den (D) daha yakın
ok(() => assert.equal(yonAdi(85), 'D'));

// 7. Gölgeden yer bulma: örnek İstanbul'dan hesaplandı
const t = utc(ORNEK.tarih, ORNEK.saat, ORNEK.fark);
const olcum = { yukseklik: yukseklikBul(ORNEK.boy, ORNEK.golgeBoy), azimut: golgeYonu(ORNEK.golgeYon) };
const aday = yerBul(t, olcum);
ok(() => assert.ok(aday.length > 0));
ok(() => assert.ok(uzaklik(aday[0].enlem, aday[0].boylam, ...IST) < 150, `${aday[0].enlem},${aday[0].boylam}`));
ok(() => assert.equal(sehirPuanlari(t, olcum)[0].ad, 'İstanbul'));
// Yön bilinmezse çok daha fazla aday (şerit)
const yonsuz = yerBul(t, { yukseklik: olcum.yukseklik, azimut: null });
ok(() => assert.ok(yonsuz.length > aday.length * 5));
// Şeritteki her noktada güneş gerçekten o yükseklikte
ok(() => assert.ok(yonsuz.every(a => Math.abs(gunesKonumu(t, a.enlem, a.boylam).yukseklik - olcum.yukseklik) <= 1 + 1e-9)));
// Rastgele 15 yer ve zamanda: kendi hesapladığım gölgeden kendi yerimi buluyor muyum?
let tohum = 21; const rnd = () => (tohum = (tohum * 48271) % 2147483647) / 2147483647;
let buldu = 0, denenen = 0;
for (let k = 0; k < 30 && denenen < 15; k++) {
  const en = Math.round(-50 + rnd() * 110), bo = Math.round(-180 + rnd() * 359);
  const tt = Date.UTC(2026, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27), Math.floor(rnd() * 24), 0);
  const g = gunesKonumu(tt, en, bo);
  if (g.yukseklik < 10 || g.yukseklik > 80) continue;          // çok alçak/tepede ölçü anlamsız
  denenen++;
  const a = yerBul(tt, { yukseklik: g.yukseklik, azimut: g.azimut });
  if (a.length && uzaklik(a[0].enlem, a[0].boylam, en, bo) < 200) buldu++;
}
ok(() => assert.ok(denenen >= 10));
ok(() => assert.equal(buldu, denenen));

// Reykjavik, Haziran: güneş gece yarısından sonra batıyor ama batıyor (ilk denememde "hiç batmıyor" diyordu)
const rey = gunOlaylari('2026-06-21', 0, 64.15, -21.94);
ok(() => assert.ok(rey.dogus !== null && rey.batis !== null));
ok(() => assert.ok(rey.batis >= 1440));                       // ertesi gün
ok(() => near(rey.dogus, 2 * 60 + 55, 10));                  // ~02:55
ok(() => near(rey.gunduz, 21 * 60 + 8, 15));                  // ~21 sa
ok(() => assert.equal(gunNotu(rey.batis), ' (ertesi gün)'));
ok(() => assert.equal(gunOlaylari('2026-06-21', 0, 80, 0).gunduz, 1440));
ok(() => assert.equal(gunOlaylari('2026-12-21', 0, 80, 0).gunduz, 0));
// Saat dilimleri (yaz saati dahil)
ok(() => assert.equal(utcFarki('Atlantic/Reykjavik', '2026-06-21'), 0));
ok(() => assert.equal(utcFarki('Europe/London', '2026-06-21'), 1));
ok(() => assert.equal(utcFarki('Europe/London', '2026-12-21'), 0));
ok(() => assert.equal(utcFarki('Asia/Kolkata', '2026-06-21'), 5.5));
ok(() => assert.ok(SEHIRLER.every(s => typeof s.tz === 'string' && Number.isFinite(utcFarki(s.tz, '2026-06-21')))));

// 8. Uzaklık ve günlük eğri
ok(() => near(uzaklik(41.01, 28.98, 39.93, 32.86), 350, 10));   // İstanbul–Ankara kuş uçuşu ~350 km
ok(() => near(uzaklik(0, 0, 0, 180), Math.PI * 6371, 1));
const egri = gunlukEgri('2026-06-21', 3, ...IST, 1);
ok(() => assert.equal(egri.length, 145));
const enKisa = egri.filter(x => x.golge !== null).reduce((a, b) => (b.golge < a.golge ? b : a));
ok(() => near(enKisa.dk, haz.ogle, 10));
ok(() => assert.ok(SEHIRLER.every(s => Math.abs(s.enlem) <= 90 && Math.abs(s.boylam) <= 180)));

console.log(`${checks} kontrol geçti.`);
