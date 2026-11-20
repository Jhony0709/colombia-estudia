import sys, sherpa_onnx, soundfile as sf
d="tools/kokoro-multi-lang-v1_0"
sid, text, out = int(sys.argv[1]), sys.argv[2], sys.argv[3]
speed = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=f"{d}/model.onnx", voices=f"{d}/voices.bin", tokens=f"{d}/tokens.txt", data_dir=f"{d}/espeak-ng-data", dict_dir=f"{d}/dict", lexicon=f"{d}/lexicon-us-en.txt,{d}/lexicon-zh.txt", lang="es"), num_threads=4))
tts = sherpa_onnx.OfflineTts(cfg)
a = tts.generate(text, sid=sid, speed=speed)
sf.write(out, a.samples, a.sample_rate)
print(out, len(a.samples)/a.sample_rate)
