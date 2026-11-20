import json, subprocess
FPS=30
sc=json.load(open('script.json'))
out=[]
for s in sc:
    d=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f"public/voz/{s['id']}.wav"]).decode())
    lead=8  # frames before voice
    tail=14 if s['id']!='s7' else 60
    out.append({**s,'voiceFrames':round(d*FPS),'lead':lead,'frames':lead+round(d*FPS)+tail})
json.dump(out,open('src/timings.json','w'),ensure_ascii=False,indent=1)
print(sum(o['frames'] for o in out)/FPS)
