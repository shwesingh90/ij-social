"""Original, royalty-free background music for reels, synthesised from scratch.
usage: python3 tools/music.py out.wav <seconds> <seed>
A warm electric-piano/pad progression with a soft beat. The seed picks key, progression and tempo,
so each reel sounds a little different but always calm and on-brand.
"""
import sys, wave, zlib
import numpy as np

out, dur, seed = sys.argv[1], float(sys.argv[2]), sys.argv[3]
rng = np.random.default_rng(zlib.crc32(seed.encode()))
SR = 44100
n = int(SR * (dur + 0.5))
t = np.arange(n) / SR
mix = np.zeros(n)

PROGS = [  # semitone offsets of chord roots + chord shapes (maj7, m7, etc.)
    [(0, 'maj7'), (9, 'm7'), (5, 'maj7'), (7, 'add9')],
    [(0, 'add9'), (7, 'add9'), (9, 'm7'), (5, 'maj7')],
    [(9, 'm7'), (5, 'maj7'), (0, 'add9'), (7, 'add9')],
    [(5, 'maj7'), (7, 'add9'), (4, 'm7'), (9, 'm7')],
]
SHAPES = {'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'add9': [0, 4, 7, 14]}
key = int(rng.integers(0, 7)) - 3           # around C
bpm = float(rng.choice([88, 92, 96]))
prog = PROGS[int(rng.integers(0, len(PROGS)))]
beat = 60 / bpm
bar = beat * 4

def hz(semi):  # semitones from C4
    return 261.63 * 2 ** (semi / 12)

def ep(f, start, length, vel):
    """electric-piano-ish tone: sine + soft 2nd harmonic with a bell attack, exponential decay"""
    i0 = int(start * SR); i1 = min(n, i0 + int(length * SR))
    if i0 >= n: return
    tt = np.arange(i1 - i0) / SR
    env = np.exp(-tt * 2.2) * (1 - np.exp(-tt * 120))
    tone = np.sin(2*np.pi*f*tt) + 0.25*np.sin(2*np.pi*2*f*tt)*np.exp(-tt*6) + 0.08*np.sin(2*np.pi*3.01*f*tt)*np.exp(-tt*9)
    mix[i0:i1] += vel * env * tone

def pad(f, start, length, vel):
    i0 = int(start * SR); i1 = min(n, i0 + int(length * SR))
    if i0 >= n: return
    tt = np.arange(i1 - i0) / SR
    env = np.minimum(1, tt / 0.6) * np.minimum(1, (length - tt) / 0.6).clip(0)
    tone = sum(np.sin(2*np.pi*f*d*tt + p) for d, p in [(1, 0), (1.003, 1.1), (0.997, 2.3)]) / 3
    mix[i0:i1] += vel * env * tone

def kick(start, vel):
    i0 = int(start * SR); i1 = min(n, i0 + int(0.35 * SR))
    if i0 >= n: return
    tt = np.arange(i1 - i0) / SR
    f = 50 + 70 * np.exp(-tt * 30)
    mix[i0:i1] += vel * np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-tt * 9)

def hat(start, vel):
    i0 = int(start * SR); i1 = min(n, i0 + int(0.06 * SR))
    if i0 >= n: return
    tt = np.arange(i1 - i0) / SR
    noise = rng.standard_normal(i1 - i0)
    noise = np.diff(noise, prepend=0)  # crude high-pass
    mix[i0:i1] += vel * noise * np.exp(-tt * 70)

bars = int(np.ceil(dur / bar)) + 1
for b in range(bars):
    root, shape = prog[b % len(prog)]
    s = b * bar
    notes = [key + root + x for x in SHAPES[shape]]
    for x in notes:
        pad(hz(x - 12), s, bar + 0.3, 0.05)
    pad(hz(key + root - 24), s, bar + 0.2, 0.09)         # bass
    pattern = [0, 2, 1, 3, 2, 1, 3, 2]                   # arpeggio, eighth notes
    for k, p in enumerate(pattern):
        ep(hz(notes[p] + (12 if k == 6 else 0)), s + k * beat / 2, beat * 1.6, 0.11 if k % 2 == 0 else 0.08)
    if b > 0:                                            # beat comes in after the first bar
        for q in range(4):
            if q in (0, 2): kick(s + q * beat, 0.32)
            hat(s + q * beat + beat / 2, 0.035)

# soft low-pass (one-pole) to warm it up, then fades and normalise
from scipy.signal import lfilter
alpha = 0.35
y = lfilter([alpha], [1, alpha - 1], mix)
L = int(SR * dur)
y = y[:L]
fade_in, fade_out = int(SR * 0.4), int(SR * 1.8)
y[:fade_in] *= np.linspace(0, 1, fade_in)
y[-fade_out:] *= np.linspace(1, 0, fade_out)
y = y / (np.max(np.abs(y)) + 1e-9) * 0.5
# small stereo widening: delay right channel by 9 ms
r = np.concatenate([np.zeros(int(SR * 0.009)), y])[:L]
st = np.stack([y, 0.92 * y + 0.08 * r], axis=1)
pcm = (st * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
