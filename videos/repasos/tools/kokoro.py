# Borrador offline con Kokoro (sherpa-onnx 1.12.40). Uso: python3 tools/kokoro.py <tema> <carpeta> <sid> [velocidad]
import glob, json, os, sys, sherpa_onnx, soundfile as sf
d = "tools/kokoro-multi-lang-v1_0"
tema, name, sid = sys.argv[1], sys.argv[2], int(sys.argv[3])
speed = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
guion = next(g for g in (json.load(open(f)) for f in glob.glob("temas/*/*.json")) if g["tema"] == tema)
cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=f"{d}/model.onnx", voices=f"{d}/voices.bin", tokens=f"{d}/tokens.txt", data_dir=f"{d}/espeak-ng-data", dict_dir=f"{d}/dict", lexicon=f"{d}/lexicon-us-en.txt,{d}/lexicon-zh.txt", lang="es"), num_threads=2))
tts = sherpa_onnx.OfflineTts(cfg)
out = f"public/voz/{tema}/{name}"
os.makedirs(out, exist_ok=True)
for s in guion["escenas"]:
    a = tts.generate(s["voz"], sid=sid, speed=speed)
    sf.write(f"{out}/{s['id']}.wav", a.samples, a.sample_rate)
    print(s["id"], round(len(a.samples) / a.sample_rate, 1))
