"""Free, local voice-over for reels (Kokoro, open-source, runs on this machine; no account or credits).
usage: python3 tools/voice.py <reel dir> [--voice bf_emma] [--speed 1.0]
Reads reel.json "narration" (one line per scene: hook, each point, outro), writes vo-0.wav ... and sets
reel.json "voice" to those files, so tools/reel.mjs times each scene to its line and mixes the music under it.
Model files: tools/kokoro/ (downloaded on first use from the kokoro-onnx GitHub release).
Voices: bf_emma, bf_isabella, bf_alice, bf_lily (British female), af_heart, af_bella (American female).
"""
import json, os, subprocess, sys

d = sys.argv[1]
voice = sys.argv[sys.argv.index('--voice') + 1] if '--voice' in sys.argv else 'bf_emma'
speed = float(sys.argv[sys.argv.index('--speed') + 1]) if '--speed' in sys.argv else 1.0
here = os.path.dirname(os.path.abspath(__file__))
mdir = os.environ.get('KOKORO_DIR', os.path.join(here, 'kokoro'))
os.makedirs(mdir, exist_ok=True)
REL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'
for f in ('kokoro-v1.0.onnx', 'voices-v1.0.bin'):
    p = os.path.join(mdir, f)
    if not os.path.exists(p) or os.path.getsize(p) < 1_000_000:
        subprocess.run(['curl', '-sSL', '--fail', '--max-time', '600', '-o', p, REL + f], check=True)

try:
    from kokoro_onnx import Kokoro
    import soundfile as sf
except ImportError:
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '--break-system-packages', 'kokoro-onnx', 'soundfile'], check=True)
    from kokoro_onnx import Kokoro
    import soundfile as sf

rp = os.path.join(d, 'reel.json')
reel = json.load(open(rp))
lines = reel.get('narration') or []
need = len(reel['points']) + 2
if len(lines) != need:
    sys.exit(f'narration: need {need} lines (hook, each point, outro), got {len(lines)}')
k = Kokoro(os.path.join(mdir, 'kokoro-v1.0.onnx'), os.path.join(mdir, 'voices-v1.0.bin'))
lang = 'en-gb' if voice.startswith('b') else 'en-us'
files = []
for i, text in enumerate(lines):
    samples, sr = k.create(text, voice=voice, speed=speed, lang=lang)
    name = f'vo-{i}.wav'
    sf.write(os.path.join(d, name), samples, sr)
    files.append(name)
    print(f'{name} {len(samples) / sr:.1f}s')
reel['voice'] = files
reel['voice_name'] = voice
json.dump(reel, open(rp, 'w'), indent=2)
