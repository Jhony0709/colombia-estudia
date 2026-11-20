import json, sys, subprocess
sid = int(sys.argv[1]); speed=float(sys.argv[2])
sc = json.load(open('./script.json'))
tot=0
for s in sc:
    out=f"./public/voz/{s['id']}.wav"
    r=subprocess.run(['python3','tools/synth_k.py',str(sid),s['tts'],out,str(speed)],capture_output=True,text=True)
    d=float(r.stdout.split()[-1]); tot+=d; print(s['id'], round(d,2))
print('total', round(tot,2))
