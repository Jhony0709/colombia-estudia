# Video: API de WhatsApp (ALBA)

Vertical 1080×1920, 30 fps, ~62 s. Remotion 4, independiente del monorepo (no está en `pnpm-workspace.yaml`).

- Guion y subtítulos: `script.json` (`sub` se ve en pantalla, `tts` es lo que se lee).
- Escenas: `src/scenes.tsx`. Tiempos: `src/timings.json`, generado por `timings.py` a partir de las voces.

## Voz (Kokoro, offline)

1. Descargar `kokoro-multi-lang-v1_0.tar.bz2` de las releases `tts-models` de k2-fsa/sherpa-onnx y descomprimir en `tools/`.
2. `pip install sherpa-onnx==1.12.40 soundfile`
3. `python3 tools/gen.py 28 1.05` (28 = ef_dora, 29 = em_alex) y luego `python3 timings.py`.

## Render

```bash
npm install
npx remotion studio src/index.ts
npx remotion render src/index.ts WhatsappApi out/whatsapp-api.mp4 --crf=18
```
