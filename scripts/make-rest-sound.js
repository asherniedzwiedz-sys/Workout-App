// Writes assets/sounds/rest-done.wav: three short rising beeps.
// Run with `node scripts/make-rest-sound.js`.
const fs = require('fs');
const path = require('path');

const rate = 44100;
const beeps = [
  { freq: 880, start: 0.0, length: 0.16 },
  { freq: 880, start: 0.25, length: 0.16 },
  { freq: 1320, start: 0.5, length: 0.32 },
];
const total = 0.9;
const samples = Math.round(rate * total);
const data = Buffer.alloc(samples * 2);

for (let i = 0; i < samples; i++) {
  const t = i / rate;
  let v = 0;
  for (const b of beeps) {
    const local = t - b.start;
    if (local < 0 || local > b.length) continue;
    // 5ms attack, exponential-ish release so it doesn't click.
    const attack = Math.min(1, local / 0.005);
    const release = Math.min(1, (b.length - local) / 0.04);
    v += Math.sin(2 * Math.PI * b.freq * local) * attack * release;
  }
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 0.8 * 32767), i * 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // PCM chunk size
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28); // byte rate
header.writeUInt16LE(2, 32); // block align
header.writeUInt16LE(16, 34); // bits per sample
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

const out = path.join(__dirname, '..', 'assets', 'sounds', 'rest-done.wav');
fs.writeFileSync(out, Buffer.concat([header, data]));
console.log(`wrote ${out}`);
