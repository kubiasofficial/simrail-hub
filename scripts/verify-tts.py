import urllib.request,zipfile,subprocess,json,hashlib
from pathlib import Path
p=Path('.tts-verify');p.mkdir(exist_ok=True)
files={
 'piper.zip':'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip',
 'voice.onnx':'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx',
 'voice.onnx.json':'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx.json'}
for name,url in files.items():
 if not (p/name).exists(): urllib.request.urlretrieve(url,p/name)
assert hashlib.sha256((p/'piper.zip').read_bytes()).hexdigest()=='f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea'
with zipfile.ZipFile(p/'piper.zip') as z:z.extractall(p)
exe=(p/'piper/piper.exe').resolve();voice=(p/'voice.onnx').resolve();out=(p/'test.wav').resolve()
r=subprocess.run([str(exe),'--model',str(voice),'--output_file',str(out)],input='Vážení cestující, příští stanice Katovice.\n'.encode('utf8'),cwd=exe.parent,capture_output=True,timeout=40,creationflags=0x08000000)
print('exit',r.returncode,'wav',out.stat().st_size if out.exists() else 0,'stderr',r.stderr.decode('utf8',errors='replace')[-1600:])

