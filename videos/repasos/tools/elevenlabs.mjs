// Voz de cada escena con ElevenLabs (audio + alineación para subtítulos y animaciones).
// Uso: ELEVENLABS_API_KEY=… node tools/elevenlabs.mjs [tema …] [--voz=<voiceId>] [--force]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { temas } from './temas.mjs';

const VOICES = ['JcWDFG8DiES2OzGhZJUJ']; // elegida por Jhonny el 19/11
const MODEL = 'eleven_multilingual_v2';

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error('Falta ELEVENLABS_API_KEY en el entorno.');
  process.exit(1);
}
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => a.startsWith('--voz=')).map((a) => a.slice(6));
const voices = only.length ? only : VOICES;

for (const guion of temas(args.filter((a) => !a.startsWith('--')))) {
  const { escenas } = guion;
  for (const voice of voices) {
    const dir = `public/voz/${guion.tema}/${voice}`;
    mkdirSync(dir, { recursive: true });
    for (const [i, s] of escenas.entries()) {
      const mp3 = `${dir}/${s.id}.mp3`;
      if (existsSync(mp3) && !force) continue;
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: { 'xi-api-key': key, 'content-type': 'application/json' },
          body: JSON.stringify({
            text: s.voz,
            model_id: MODEL,
            // El texto vecino mantiene la entonación entre escenas.
            previous_text: escenas[i - 1]?.voz,
            next_text: escenas[i + 1]?.voz,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.15,
              use_speaker_boost: true,
            },
          }),
        }
      );
      if (!res.ok) {
        console.error(`${guion.tema}/${voice}/${s.id}: ${res.status} ${await res.text()}`);
        process.exit(1);
      }
      const body = await res.json();
      writeFileSync(mp3, Buffer.from(body.audio_base64, 'base64'));
      writeFileSync(`${dir}/${s.id}.json`, JSON.stringify(body.alignment));
      console.log(`${guion.tema}/${voice}/${s.id} listo`);
    }
  }
}
