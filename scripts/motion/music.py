#!/usr/bin/env python3
"""Original 15 s soundtrack for the Vispar reel, synthesised with numpy (no samples, no copyright).
120 BPM, A minor (Am - F - C - G). Cues line up with reel.html: riser 0-2 s, impact at 2.0 s,
kick from 2.0 s, plucks from 6.0 s, scene whooshes at 6, 9 and 12 s.
    python3 music.py out.wav
"""
import sys
import numpy as np

SR = 44100
DUR = 15.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
out = np.zeros(N)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def add(sig, start, gain=1.0):
    i = int(start * SR)
    if i >= N:
        return
    j = min(N, i + len(sig))
    out[i:j] += sig[: j - i] * gain


def env(n, a, d, s=0.0, r=0.0):
    e = np.ones(n)
    na, nd = int(a * SR), int(d * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nd and na + nd < n: e[na:na + nd] = np.linspace(1, s, nd); e[na + nd:] = s
    nr = int(r * SR)
    if nr and nr < n: e[-nr:] *= np.linspace(1, 0, nr)
    return e


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    prev = 0.0
    for i in range(len(x)):
        prev = (1 - a) * x[i] + a * prev
        y[i] = prev
    return y


def tone(freq, dur, kind="sine"):
    tt = np.arange(int(dur * SR)) / SR
    if kind == "saw":
        return 2 * ((tt * freq) % 1) - 1
    if kind == "tri":
        return 2 * np.abs(2 * ((tt * freq) % 1) - 1) - 1
    return np.sin(2 * np.pi * freq * tt)


# --- riser 0-2 s: rising filtered noise + sine sweep ---
n = int(2.0 * SR)
sweep = np.sin(2 * np.pi * np.cumsum(np.linspace(120, 900, n)) / SR) * np.linspace(0, 0.35, n) ** 2
noise = lowpass(rng.standard_normal(n), 3000) * np.linspace(0, 0.5, n) ** 2.2
add(sweep + noise, 0.0, 0.8)
# drone under the intro
add(tone(midi(45), 2.2, "tri") * env(int(2.2 * SR), 1.6, 0.2, 0.9, 0.3), 0.0, 0.25)

# --- impact at 2.0 s ---
n = int(1.4 * SR)
boom = np.sin(2 * np.pi * np.cumsum(np.linspace(90, 38, n)) / SR) * np.exp(-np.linspace(0, 4.5, n))
shim = lowpass(rng.standard_normal(n), 6000) * np.exp(-np.linspace(0, 7, n)) * 0.5
add(boom + shim, 2.0, 0.95)

# --- pads, one chord per 2 s bar from 2.0 s ---
chords = [(57, 60, 64), (53, 57, 60), (48, 55, 64), (55, 59, 62)]
bar = 2.0
for b, start in enumerate(np.arange(2.0, 15.0, bar)):
    notes = chords[b % 4]
    for nn in notes:
        for det in (-0.4, 0.4):
            f = midi(nn) * 2 ** (det / 100)
            sig = tone(f, bar + 0.6, "saw") * 0.5 + tone(f * 2, bar + 0.6, "sine") * 0.15
            sig = lowpass(sig, 1400) * env(len(sig), 0.5, 0.2, 0.85, 0.6)
            add(sig, start, 0.11)

# --- bass on beats 1 and 3 ---
roots = [45, 41, 48, 43]
for b, start in enumerate(np.arange(2.0, 15.0, bar)):
    for off in (0.0, 1.0):
        sig = tone(midi(roots[b % 4]), 0.9, "sine") * env(int(0.9 * SR), 0.01, 0.8, 0.0)
        add(sig, start + off, 0.5)

# --- kick every beat from 2.0 s (stronger from 9 s), hat on off-beats ---
for k, bt in enumerate(np.arange(2.0, 14.0, 0.5)):
    n = int(0.28 * SR)
    kick = np.sin(2 * np.pi * np.cumsum(np.linspace(130, 46, n)) / SR) * np.exp(-np.linspace(0, 6.5, n))
    add(kick, bt, 0.7 if bt >= 9.0 else 0.5)
    hat = lowpass(rng.standard_normal(int(0.08 * SR)), 9000)
    hat = (rng.standard_normal(int(0.08 * SR)) - lowpass(rng.standard_normal(int(0.08 * SR)), 4000)) * np.exp(-np.linspace(0, 9, int(0.08 * SR)))
    add(hat, bt + 0.25, 0.18)

# --- plucks: pentatonic arpeggio on 8ths from 6.0 s ---
scale = [69, 72, 76, 79, 81, 84, 79, 76]
for i, bt in enumerate(np.arange(6.0, 14.0, 0.25)):
    nn = scale[i % len(scale)] + (0 if (int(bt) // 2) % 2 == 0 else -2 if (i % 3 == 0) else 0)
    sig = (tone(midi(nn), 0.5) + 0.4 * tone(midi(nn) * 2, 0.5) + 0.2 * tone(midi(nn) * 3, 0.5)) * np.exp(-np.linspace(0, 7, int(0.5 * SR)))
    add(sig, bt, 0.17)

# --- whooshes at scene changes ---
for w in (6.0, 9.0, 12.0):
    n = int(0.7 * SR)
    wh = lowpass(rng.standard_normal(n), 2500) * np.sin(np.linspace(0, np.pi, n)) ** 2
    add(wh, w - 0.35, 0.5)

# --- simple echo for space, then master ---
echo = np.zeros(N)
for d, g in ((0.375, 0.32), (0.75, 0.18)):
    k = int(d * SR)
    echo[k:] += out[:-k] * g
out += echo
out *= np.minimum(1, np.linspace(0, 1, N) * DUR / 0.05)  # no click at start
out *= np.clip((DUR - t) / 1.4, 0, 1) ** 1.2             # fade out
out = np.tanh(out * 1.1)
out /= np.max(np.abs(out)) / 0.89

pcm = (out * 32767).astype("<i2")
import wave
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", sys.argv[1])
