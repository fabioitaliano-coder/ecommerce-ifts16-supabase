// Ilustraciones planas de productos con un estilo común. Salida: PNG 800x600.
// Uso: npm install --no-save sharp && node assets/generador/generar-imagenes.mjs assets/productos
// Genera una imagen por producto y una hoja de contacto (_hoja.png) para revisar la consistencia.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] ?? './out';
fs.mkdirSync(OUT, { recursive: true });

// Una paleta por categoría: fondo, círculo decorativo y tres tonos del objeto.
const P = {
  Ropa:       { bg1: '#EEF2FD', bg2: '#DCE5FB', circ: '#C9D6F6', main: '#3B5BDB', dark: '#2B44A8', light: '#8CA2F2' },
  Calzado:    { bg1: '#EAF7EF', bg2: '#D5EFDF', circ: '#BFE5CE', main: '#2F9E62', dark: '#1F7447', light: '#7ACB9C' },
  Accesorios: { bg1: '#FFF6E0', bg2: '#FCEAB8', circ: '#F9DE98', main: '#E8A317', dark: '#B77A0B', light: '#F6CB6A' },
  'Tecnología': { bg1: '#F3EDFC', bg2: '#E5DAF7', circ: '#D6C6F2', main: '#7048D8', dark: '#4F2FA8', light: '#A58BEB' },
  Hogar:      { bg1: '#FEEDEB', bg2: '#FADAD6', circ: '#F6C5BF', main: '#E5574B', dark: '#B83A30', light: '#F19389' },
};
const INK = '#2B2F3A', WHITE = '#FFFFFF';

const wrap = (cat, inner) => {
  const p = P[cat];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg1}"/><stop offset="1" stop-color="${p.bg2}"/></linearGradient></defs>
<rect width="800" height="600" fill="url(#bg)"/>
<circle cx="650" cy="120" r="150" fill="${p.circ}" opacity=".55"/>
<circle cx="120" cy="510" r="105" fill="${p.circ}" opacity=".45"/>
<ellipse cx="400" cy="486" rx="236" ry="22" fill="#1b2030" opacity=".14"/>
<g transform="translate(400 482) scale(1.2) translate(-400 -470)">${inner}</g>
</svg>`;
};

const art = {
  // ---------------------------------------------------------------- ROPA
  remera: (p) => `
<path d="M240 205 L330 162 Q400 208 470 162 L560 205 L525 280 L480 258 L480 452 L320 452 L320 258 L275 280 Z" fill="${p.main}"/>
<path d="M320 258 L320 452 L346 452 L346 270 Z" fill="${p.dark}" opacity=".18"/>
<path d="M240 205 L275 280 L300 268 L282 196Z" fill="${p.dark}" opacity=".22"/>
<path d="M330 162 Q400 218 470 162" fill="none" stroke="${p.dark}" stroke-width="15" stroke-linecap="round"/>
<circle cx="400" cy="330" r="34" fill="${p.light}"/><circle cx="400" cy="330" r="14" fill="${WHITE}" opacity=".9"/>`,

  buzo: (p) => `
<path d="M250 235 L335 178 L465 178 L550 235 L585 405 L522 414 L492 305 L492 452 L308 452 L308 305 L278 414 L215 405 Z" fill="${p.main}"/>
<path d="M335 180 Q400 108 465 180 Q400 222 335 180Z" fill="${p.dark}"/>
<path d="M352 184 Q400 210 448 184" fill="none" stroke="${p.main}" stroke-width="10" stroke-linecap="round"/>
<path d="M382 210 L379 262 M418 210 L421 262" stroke="${WHITE}" stroke-width="6" stroke-linecap="round"/>
<path d="M345 355 L455 355 L478 415 L322 415 Z" fill="${p.dark}" opacity=".42"/>
<path d="M217 404 L279 414 L276 436 L214 426Z M583 404 L521 414 L524 436 L586 426Z" fill="${p.dark}"/>
<path d="M308 305 L308 452 L334 452 L334 318Z" fill="${p.dark}" opacity=".16"/>`,

  jean: (p) => `
<path d="M325 160 L475 160 L498 458 L416 458 L400 288 L384 458 L302 458 Z" fill="${p.main}"/>
<rect x="325" y="160" width="150" height="28" fill="${p.dark}"/>
<rect x="340" y="154" width="12" height="40" rx="3" fill="${p.dark}"/><rect x="448" y="154" width="12" height="40" rx="3" fill="${p.dark}"/>
<path d="M338 200 Q350 252 388 246 M462 200 Q450 252 412 246" fill="none" stroke="${WHITE}" stroke-width="4" stroke-dasharray="9 7" stroke-linecap="round"/>
<path d="M400 190 L400 288" stroke="${WHITE}" stroke-width="4" stroke-dasharray="9 7"/>
<circle cx="400" cy="174" r="7" fill="${p.light}"/>
<path d="M302 458 L384 458 L384 436 L306 436Z M416 458 L498 458 L494 436 L416 436Z" fill="${p.dark}" opacity=".3"/>
<path d="M325 188 L309 440 L330 440 L343 196Z" fill="${p.light}" opacity=".25"/>`,

  campera: (p) => `
<path d="M292 192 L508 192 L538 444 L262 444 Z" fill="${p.main}"/>
<path d="M292 192 L230 402 L286 414 L332 244 Z M508 192 L570 402 L514 414 L468 244 Z" fill="${p.dark}"/>
<path d="M350 178 Q400 160 450 178 L456 206 L344 206 Z" fill="${p.dark}"/>
<path d="M278 252 L522 252 M272 318 L528 318 M266 384 L534 384" stroke="${p.dark}" stroke-width="7" opacity=".4" stroke-linecap="round"/>
<path d="M400 206 L400 444" stroke="${p.light}" stroke-width="7"/><rect x="391" y="214" width="18" height="30" rx="5" fill="${WHITE}"/>
<path d="M232 400 L284 412 L281 432 L229 420Z M568 400 L516 412 L519 432 L571 420Z" fill="${INK}" opacity=".35"/>`,

  // ------------------------------------------------------------- CALZADO
  zapatillas: (p) => `
<path d="M236 408 L576 408 Q592 408 590 428 Q586 454 560 454 L256 454 Q232 454 236 428Z" fill="${WHITE}"/>
<path d="M250 408 L250 332 Q250 300 286 298 L340 270 Q372 302 420 302 Q512 308 566 382 Q578 398 578 408 Z" fill="${p.main}"/>
<path d="M500 324 Q552 348 578 396 L578 408 L488 408 Q512 366 500 324Z" fill="${p.light}"/>
<ellipse cx="346" cy="276" rx="30" ry="14" fill="${p.dark}"/>
<path d="M362 304 L394 322 M382 298 L414 316 M402 296 L434 314" stroke="${WHITE}" stroke-width="7" stroke-linecap="round"/>
<path d="M300 384 Q382 342 478 376" fill="none" stroke="${WHITE}" stroke-width="12" stroke-linecap="round"/>
<path d="M250 340 L250 408 L290 408 L282 340Z" fill="${p.dark}"/>`,

  botas: (p) => `
<path d="M326 152 L436 152 L442 336 Q548 346 578 398 L578 438 L318 438 Z" fill="${p.main}"/>
<path d="M310 436 L586 436 L586 456 Q586 464 576 464 L320 464 Q310 464 310 456Z" fill="${p.dark}"/>
<rect x="322" y="152" width="118" height="38" rx="8" fill="${p.light}"/>
<path d="M352 214 L418 214 M352 246 L420 246 M352 278 L422 278 M354 310 L424 310" stroke="${WHITE}" stroke-width="7" stroke-linecap="round"/>
<path d="M470 360 Q548 366 576 404 L576 438 L452 438Z" fill="${p.dark}" opacity=".35"/>
<path d="M318 190 L318 436 L342 436 L342 200Z" fill="${p.dark}" opacity=".2"/>`,

  sandalias: (p) => `
<path d="M232 444 Q232 408 270 402 L520 380 Q574 378 580 414 Q584 450 522 454 L272 462 Q232 464 232 444Z" fill="${p.dark}"/>
<path d="M240 436 Q240 416 272 412 L520 392 Q562 392 566 416 Q568 440 520 442 L272 450 Q240 452 240 436Z" fill="${p.light}"/>
<path d="M330 408 Q398 296 476 394" fill="none" stroke="${p.main}" stroke-width="38" stroke-linecap="round"/>
<path d="M262 400 Q246 322 330 306" fill="none" stroke="${p.main}" stroke-width="24" stroke-linecap="round"/>
<rect x="318" y="294" width="28" height="26" rx="6" fill="${WHITE}"/>
<path d="M352 366 Q398 318 444 372" fill="none" stroke="${WHITE}" stroke-width="5" stroke-dasharray="8 7" stroke-linecap="round"/>`,

  mocasines: (p) => `
<path d="M246 440 L582 440 L582 460 Q582 466 574 466 L254 466 Q246 466 246 460Z" fill="${p.dark}"/>
<path d="M252 440 L252 372 Q252 346 274 346 Q294 362 332 358 Q374 354 402 320 Q474 308 542 364 Q580 396 580 440Z" fill="${p.main}"/>
<ellipse cx="302" cy="354" rx="40" ry="10" fill="${p.dark}"/>
<path d="M412 324 Q434 362 420 402" fill="none" stroke="${p.dark}" stroke-width="24" stroke-linecap="round"/>
<path d="M404 348 L432 352" stroke="${p.light}" stroke-width="6" stroke-linecap="round"/>
<ellipse cx="506" cy="392" rx="48" ry="12" fill="${WHITE}" opacity=".25" transform="rotate(22 506 392)"/>
<rect x="252" y="440" width="64" height="26" rx="4" fill="${INK}" opacity=".4"/>`,


  // --------------------------------------------------------- ACCESORIOS
  mochila: (p) => `
<path d="M366 196 Q366 152 400 152 Q434 152 434 196" fill="none" stroke="${p.dark}" stroke-width="16" stroke-linecap="round"/>
<path d="M300 262 Q262 330 300 424 M500 262 Q538 330 500 424" fill="none" stroke="${p.dark}" stroke-width="20" stroke-linecap="round"/>
<rect x="300" y="190" width="200" height="266" rx="72" fill="${p.main}"/>
<path d="M312 262 Q400 286 488 262" fill="none" stroke="${p.dark}" stroke-width="6" opacity=".55" stroke-linecap="round"/>
<rect x="326" y="332" width="148" height="108" rx="30" fill="${p.light}"/>
<path d="M336 350 L464 350" stroke="${WHITE}" stroke-width="6" stroke-linecap="round" stroke-dasharray="3 9"/>
<rect x="388" y="226" width="24" height="24" rx="6" fill="${WHITE}" opacity=".9"/>`,

  gorra: (p) => `
<path d="M268 338 Q268 206 400 206 Q532 206 532 338 Z" fill="${p.main}"/>
<path d="M400 206 Q360 270 350 338 M400 206 Q440 270 450 338" fill="none" stroke="${p.dark}" stroke-width="6" opacity=".45"/>
<path d="M268 338 L532 338 L532 358 L268 358Z" fill="${p.dark}"/>
<path d="M276 332 L536 332 Q654 338 676 396 Q572 414 470 378 Q384 354 276 348Z" fill="${p.dark}"/>
<circle cx="400" cy="206" r="12" fill="${p.dark}"/>
<circle cx="400" cy="290" r="30" fill="${WHITE}" opacity=".92"/><path d="M386 290 L396 300 L416 278" fill="none" stroke="${p.main}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,

  lentes: (p) => `
<path d="M240 300 L206 272 M560 300 L594 272" stroke="${p.main}" stroke-width="14" stroke-linecap="round"/>
<path d="M412 304 Q400 282 388 304" fill="none" stroke="${p.main}" stroke-width="14" stroke-linecap="round"/>
<ellipse cx="322" cy="334" rx="90" ry="72" fill="${INK}" stroke="${p.main}" stroke-width="16"/>
<ellipse cx="478" cy="334" rx="90" ry="72" fill="${INK}" stroke="${p.main}" stroke-width="16"/>
<path d="M270 312 Q292 286 330 292" fill="none" stroke="${WHITE}" stroke-width="9" stroke-linecap="round" opacity=".5"/>
<path d="M426 312 Q448 286 486 292" fill="none" stroke="${WHITE}" stroke-width="9" stroke-linecap="round" opacity=".5"/>`,

  reloj: (p) => `
<rect x="354" y="146" width="92" height="120" rx="24" fill="${p.dark}"/>
<rect x="354" y="342" width="92" height="120" rx="24" fill="${p.dark}"/>
<circle cx="400" cy="400" r="6" fill="${p.light}"/><circle cx="400" cy="428" r="6" fill="${p.light}"/>
<rect x="490" y="290" width="16" height="26" rx="5" fill="${p.dark}"/>
<circle cx="400" cy="304" r="98" fill="${p.main}"/>
<circle cx="400" cy="304" r="78" fill="${WHITE}"/>
${[...Array(12)].map((_, i) => { const a = (i * 30 - 90) * Math.PI / 180; const r1 = i % 3 === 0 ? 58 : 64; return `<line x1="${400 + Math.cos(a) * r1}" y1="${304 + Math.sin(a) * r1}" x2="${400 + Math.cos(a) * 72}" y2="${304 + Math.sin(a) * 72}" stroke="${INK}" stroke-width="${i % 3 === 0 ? 6 : 3}" stroke-linecap="round"/>`; }).join('')}
<path d="M400 304 L400 254" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M400 304 L436 322" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
<path d="M400 304 L372 340" stroke="${p.main}" stroke-width="3" stroke-linecap="round"/><circle cx="400" cy="304" r="7" fill="${p.main}"/>`,

  // ---------------------------------------------------------- TECNOLOGÍA
  auriculares: (p) => `
<path d="M292 330 Q292 166 400 166 Q508 166 508 330" fill="none" stroke="${p.dark}" stroke-width="28" stroke-linecap="round"/>
<path d="M292 330 Q292 186 400 186 Q508 186 508 330" fill="none" stroke="${p.light}" stroke-width="6" stroke-linecap="round" opacity=".6"/>
<rect x="240" y="298" width="80" height="140" rx="38" fill="${p.main}"/>
<rect x="480" y="298" width="80" height="140" rx="38" fill="${p.main}"/>
<rect x="300" y="316" width="26" height="104" rx="13" fill="${p.dark}"/><rect x="474" y="316" width="26" height="104" rx="13" fill="${p.dark}"/>
<circle cx="272" cy="368" r="14" fill="${p.light}"/><circle cx="528" cy="368" r="14" fill="${p.light}"/>`,

  mouse: (p) => `
<path d="M400 160 Q504 160 508 270 L508 358 Q508 452 400 452 Q292 452 292 358 L292 270 Q296 160 400 160Z" fill="${p.main}"/>
<path d="M400 160 L400 290" stroke="${p.dark}" stroke-width="6"/>
<path d="M293 290 Q400 312 507 290" fill="none" stroke="${p.dark}" stroke-width="6" opacity=".6"/>
<rect x="387" y="212" width="26" height="54" rx="13" fill="${WHITE}"/>
<path d="M312 300 Q304 380 332 430" fill="none" stroke="${p.light}" stroke-width="12" stroke-linecap="round" opacity=".55"/>
<circle cx="400" cy="400" r="14" fill="${p.dark}" opacity=".35"/>`,

  cargador: (p) => `
<rect x="360" y="176" width="18" height="60" rx="5" fill="${INK}" opacity=".75"/><rect x="422" y="176" width="18" height="60" rx="5" fill="${INK}" opacity=".75"/>
<rect x="326" y="226" width="148" height="188" rx="28" fill="${p.main}"/>
<rect x="326" y="226" width="148" height="46" rx="28" fill="${p.dark}" opacity=".35"/>
<rect x="364" y="318" width="72" height="32" rx="16" fill="${p.dark}"/><rect x="376" y="328" width="48" height="12" rx="6" fill="${WHITE}" opacity=".9"/>
<circle cx="400" cy="382" r="8" fill="${p.light}"/>
<path d="M400 414 Q400 462 470 462 L520 462" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round" opacity=".8"/>
<rect x="514" y="450" width="40" height="24" rx="12" fill="${p.dark}"/>`,

  parlante: (p) => `
<path d="M330 214 Q330 168 400 168 Q470 168 470 214" fill="none" stroke="${p.dark}" stroke-width="14" stroke-linecap="round"/>
<rect x="288" y="206" width="224" height="250" rx="64" fill="${p.main}"/>
<rect x="312" y="232" width="176" height="150" rx="40" fill="${p.dark}" opacity=".55"/>
${[0, 1, 2, 3, 4].flatMap((r) => [0, 1, 2, 3, 4, 5, 6].map((c) => `<circle cx="${328 + c * 24}" cy="${254 + r * 28}" r="6" fill="${p.light}" opacity=".9"/>`)).join('')}
<circle cx="360" cy="420" r="11" fill="${p.light}"/><circle cx="400" cy="420" r="11" fill="${WHITE}" opacity=".9"/><circle cx="440" cy="420" r="11" fill="${p.light}"/>`,

  // --------------------------------------------------------------- HOGAR
  lampara: (p) => `
<ellipse cx="400" cy="450" rx="92" ry="18" fill="${p.dark}"/>
<rect x="391" y="326" width="18" height="124" rx="6" fill="${p.dark}"/>
<path d="M334 186 L466 186 L522 330 L278 330 Z" fill="${p.main}"/>
<path d="M334 186 L360 330 L388 330 L366 186Z" fill="${p.light}" opacity=".5"/>
<ellipse cx="400" cy="186" rx="66" ry="14" fill="${p.dark}"/>
<path d="M300 330 L500 330" stroke="${p.dark}" stroke-width="12" stroke-linecap="round"/>
<ellipse cx="400" cy="344" rx="54" ry="12" fill="#FFE9A8"/>`,

  taza: (p) => `
<path d="M490 292 Q566 292 556 348 Q548 402 482 396" fill="none" stroke="${p.main}" stroke-width="24" stroke-linecap="round"/>
<path d="M304 248 L496 248 L486 402 Q482 458 400 458 Q318 458 314 402Z" fill="${p.main}"/>
<path d="M326 262 L340 262 L350 420 Q352 440 366 446 Q336 440 330 410Z" fill="${p.light}" opacity=".6"/>
<ellipse cx="400" cy="248" rx="96" ry="22" fill="${p.dark}"/>
<ellipse cx="400" cy="250" rx="80" ry="15" fill="#5A3A2A"/>
<rect x="312" y="326" width="176" height="24" fill="${WHITE}" opacity=".85"/>
<path d="M368 214 Q350 188 374 164 M404 214 Q386 188 410 164 M440 214 Q422 188 446 164" fill="none" stroke="${WHITE}" stroke-width="8" stroke-linecap="round" opacity=".9"/>`,

  almohadon: (p) => `
<path d="M286 222 Q400 192 514 222 Q544 332 514 442 Q400 472 286 442 Q256 332 286 222Z" fill="${p.main}"/>
<path d="M300 236 Q400 210 500 236 Q526 332 500 428 Q400 452 300 428 Q274 332 300 236Z" fill="none" stroke="${p.light}" stroke-width="6" stroke-dasharray="3 11" stroke-linecap="round"/>
<path d="M400 332 L318 262 M400 332 L482 262 M400 332 L318 402 M400 332 L482 402" stroke="${p.dark}" stroke-width="6" opacity=".4" stroke-linecap="round"/>
<circle cx="400" cy="332" r="16" fill="${p.dark}"/><circle cx="400" cy="332" r="6" fill="${p.light}"/>
<path d="M286 222 L302 244 M514 222 L498 244 M286 442 L302 420 M514 442 L498 420" stroke="${p.dark}" stroke-width="10" stroke-linecap="round" opacity=".5"/>`,

  maceta: (p) => `
<g transform="translate(400 318)">
  <ellipse rx="30" ry="92" cy="-92" fill="#43B06F" transform="rotate(-42)"/>
  <ellipse rx="30" ry="92" cy="-92" fill="#43B06F" transform="rotate(42)"/>
  <ellipse rx="32" ry="104" cy="-104" fill="#2E9A5C"/>
  <ellipse rx="22" ry="62" cy="-62" fill="#5CC888" transform="rotate(-74)"/>
  <ellipse rx="22" ry="62" cy="-62" fill="#5CC888" transform="rotate(74)"/>
  <path d="M0 -20 L0 -200" stroke="${WHITE}" stroke-width="4" opacity=".55"/>
</g>
<path d="M330 330 L470 330 L452 454 L348 454 Z" fill="${p.main}"/>
<rect x="316" y="312" width="168" height="32" rx="10" fill="${p.dark}"/>
<path d="M346 350 L356 450 L376 450 L368 350Z" fill="${p.light}" opacity=".5"/>`,
};

// slug -> categoría (la paleta depende de la categoría)
const CATALOGO = {
  remera: 'Ropa', buzo: 'Ropa', jean: 'Ropa', campera: 'Ropa',
  zapatillas: 'Calzado', botas: 'Calzado', sandalias: 'Calzado', mocasines: 'Calzado',
  mochila: 'Accesorios', gorra: 'Accesorios', lentes: 'Accesorios', reloj: 'Accesorios',
  auriculares: 'Tecnología', mouse: 'Tecnología', cargador: 'Tecnología', parlante: 'Tecnología',
  lampara: 'Hogar', taza: 'Hogar', almohadon: 'Hogar', maceta: 'Hogar',
};

const sheet = [];
for (const [slug, cat] of Object.entries(CATALOGO)) {
  const svg = wrap(cat, art[slug](P[cat]));
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(OUT, `${slug}.png`), png);
  sheet.push({ slug, png });
}
// Hoja de contacto 5 x 4 para revisar la consistencia de un vistazo.
const w = 320, h = 240;
const comps = await Promise.all(sheet.map(async (s, i) => ({
  input: await sharp(s.png).resize(w, h).toBuffer(), left: (i % 5) * w, top: Math.floor(i / 5) * h,
})));
await sharp({ create: { width: w * 5, height: h * 4, channels: 3, background: '#fff' } }).composite(comps).png().toFile(path.join(OUT, '_hoja.png'));
const tam = sheet.map((s) => s.png.length);
console.log(`${sheet.length} imágenes | tamaño mínimo ${Math.min(...tam)} B, máximo ${Math.max(...tam)} B`);
