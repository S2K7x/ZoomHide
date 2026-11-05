# Procedural, original soundtrack + SFX for the Zoom Hide promo (royalty-free by construction).
import numpy as np, wave, sys
SR = 44100
DUR = 28.5
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def add(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * (1 - max(0, pan))
    R[i:i + len(sig)] += sig * (1 + min(0, pan))

def env(n, a=0.005, d=0.3, curve=6):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) * np.exp(-curve * t / max(d, 1e-3))
    return e

def note(f): return 440 * 2 ** ((f - 69) / 12)

def pluck(midi, dur=0.35, bright=0.5):
    n = int(SR * dur); t = np.arange(n) / SR; f = note(midi)
    s = np.sin(2*np.pi*f*t) + bright*0.5*np.sin(2*np.pi*2*f*t)*np.exp(-t*18) + 0.25*np.sin(2*np.pi*3*f*t)*np.exp(-t*30)
    return s * env(n, 0.003, dur, 5)

def marimba(midi, dur=0.5):
    n = int(SR * dur); t = np.arange(n) / SR; f = note(midi)
    s = np.sin(2*np.pi*f*t) + 0.35*np.sin(2*np.pi*4*f*t)*np.exp(-t*40)
    return s * env(n, 0.002, dur, 7)

def bass(midi, dur=0.45):
    n = int(SR * dur); t = np.arange(n) / SR; f = note(midi)
    s = np.sin(2*np.pi*f*t) + 0.3*np.sin(2*np.pi*2*f*t)
    return np.tanh(1.5 * s) * env(n, 0.006, dur, 3.5)

def pad(midis, dur):
    n = int(SR * dur); t = np.arange(n) / SR
    s = sum(np.sin(2*np.pi*note(m)*t + np.sin(2*np.pi*0.3*t)) for m in midis) / len(midis)
    e = np.minimum(1, t / 0.25) * np.minimum(1, (dur - t) / 0.4)
    return s * e

def kick():
    n = int(SR * 0.35); t = np.arange(n) / SR
    f = 50 + 110 * np.exp(-t * 35)
    return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 9)

def clap():
    n = int(SR * 0.22); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    # crude band-pass via differencing
    nz = np.diff(np.concatenate([[0], nz]))
    e = np.exp(-t * 22) * (1 + 0.6 * (np.sin(2*np.pi*90*t) > 0) * (t < 0.03))
    return nz * e * 0.5

def hat(open_=False):
    n = int(SR * (0.12 if open_ else 0.05)); t = np.arange(n) / SR
    nz = np.diff(np.concatenate([[0], rng.standard_normal(n)]))
    nz = np.diff(np.concatenate([[0], nz]))
    return nz * np.exp(-t * (18 if open_ else 70)) * 0.18

def pop(f0=900):
    n = int(SR * 0.12); t = np.arange(n) / SR
    f = f0 * (1 + 1.5 * np.exp(-t * 60))
    return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 35)

def tick(f=2200):
    n = int(SR * 0.05); t = np.arange(n) / SR
    return np.sin(2*np.pi*f*t) * np.exp(-t * 90)

def whoosh(dur=0.5, up=True):
    n = int(SR * dur); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    # sweep: moving one-pole lowpass
    out = np.zeros(n); y = 0
    for i in range(n):
        x = i / n
        a = 0.02 + 0.5 * (x if up else 1 - x)
        y += a * (nz[i] - y); out[i] = y
    e = np.sin(np.pi * np.minimum(1, t / dur)) ** 2
    return out * e * 0.9

def chime(midis, spacing=0.07, dur=0.9):
    out = np.zeros(int(SR * (dur + spacing * len(midis))))
    for k, m in enumerate(midis):
        s = marimba(m, dur) * 0.8 + pluck(m + 12, dur, 0.2) * 0.3
        i = int(k * spacing * SR); out[i:i + len(s)] += s
    return out

# ---------- music grid ----------
BPM = 120; BEAT = 60 / BPM; OFF = 0.3          # bars (2 s) start at 0.3 → full drop at 6.3
prog = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [59, 62, 67])]  # C Am F G
melody = [72, 76, 79, 76, 74, 72, 74, 76,  72, 69, 72, 76, 74, 72, 69, 67,
          69, 72, 77, 76, 72, 69, 72, 74,  71, 74, 79, 77, 76, 74, 72, 71]
DROP = 6.3; END = 27.3
bar = 0
t = OFF
while t < END:
    root, chord = prog[bar % 4]
    full = t >= DROP - 0.01
    intro = not full
    for b8 in range(8):                           # eighth notes
        tt = t + b8 * BEAT / 2
        if tt >= END: break
        mel = melody[(bar % 4) * 8 + b8]
        if intro:
            if tt >= 0.3: add(pluck(mel, 0.3, 0.3), tt, pan=0.25 * (1 if b8 % 2 else -1), gain=0.2)
            if b8 % 2 == 0: add(bass(root, 0.3), tt, gain=0.08)
            continue
        add(marimba(mel, 0.4), tt, pan=0.2 * (1 if b8 % 2 else -1), gain=0.16)
        add(hat(open_=(b8 % 4 == 3)), tt, pan=0.3, gain=0.55)
        if b8 % 2 == 0:
            beat = b8 // 2
            add(kick(), tt, gain=0.55)
            if beat in (1, 3): add(clap(), tt, pan=-0.1, gain=0.32)
            add(bass(root if beat != 3 else root + 7, 0.42), tt, gain=0.22)
        else:
            add(bass(root + 12, 0.18), tt, gain=0.08)
    add(pad(chord, 2.0), t, gain=0.1 if intro else 0.08)
    t += 4 * BEAT; bar += 1
# final hit
add(chime([72, 76, 79, 84], 0.06, 1.4), END, gain=0.35)
add(kick(), END, gain=0.5)

# ---------- SFX synced to video.html ----------
add(pop(700), 0.15, gain=0.35); add(pop(1000), 1.0, gain=0.3)
for i in range(3): add(tick(1800 + i * 300), 1.5 + i * 0.45, gain=0.35)
add(whoosh(1.6, True), 3.3, gain=0.18)
add(chime([79, 84, 88], 0.06, 1.0), 5.0, gain=0.45)
add(pop(900), 5.25, gain=0.3); add(pop(600), 5.5, gain=0.25)
for w in [6.3, 9.4, 13.6, 17.9, 21.4, 24.3]: add(whoosh(0.45, True), w - 0.05, pan=0.0, gain=0.22)
add(pop(800), 6.6, gain=0.3)
add(pop(1100), 10.35, gain=0.25)
add(pop(650), 12.1, gain=0.25)
for tt in [14.9, 15.9, 16.9]: add(tick(1500), tt, gain=0.4)
add(marimba(55, 0.4), 15.3, gain=0.3)                 # cold
add(marimba(67, 0.4), 16.3, gain=0.3); add(marimba(71, 0.3), 16.38, gain=0.2)  # hot
add(chime([72, 76, 79, 84], 0.05, 0.8), 17.3, gain=0.4)  # found
add(pop(900), 18.65, gain=0.25); add(pop(1200), 19.2, gain=0.25)
add(pop(800), 22.15, gain=0.25)
add(pop(700), 24.6, gain=0.3); add(pop(1000), 25.35, gain=0.3)

# ---------- master ----------
mix = np.stack([L, R], 1)
fade_out = np.ones(N); fo = int(SR * 1.0); fade_out[-fo:] = np.linspace(1, 0, fo)
mix *= fade_out[:, None]
mix = np.tanh(mix * 1.4) / np.tanh(1.4)      # soft clip
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.89
pcm = (mix * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", sys.argv[1])
