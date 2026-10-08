"""Record Jarvis's clips with Kokoro (open-source, Apache-2.0, runs offline on a Mac). Free: no key,
no account, no credits. Called by scripts/voice-build.ts with --engine kokoro; you don't run it directly.

Reads a JSON job on stdin: {"voice": "bm_george", "speed": 0.95, "out": "<dir>",
"clips": [{"key": ..., "segments": [{"text": ..., "pauseAfterMs": ...}, ...]}]}
Each segment is spoken separately and the exact pause from Jarvis's script is inserted after it,
then the clip is written as a 64 kbps mono MP3. Prints one JSON line per clip written.

--fake writes a short tone per segment instead of speech (used to test the pipeline without the model).
"""

from __future__ import annotations

import json
import math
import os
import sys

RATE = 24_000  # Kokoro's sample rate


def to_mp3(samples: list[float]) -> bytes:
    import lameenc

    pcm = bytearray()
    for s in samples:
        v = max(-1.0, min(1.0, s))
        pcm += int(v * 32767).to_bytes(2, "little", signed=True)
    enc = lameenc.Encoder()
    enc.set_bit_rate(64)
    enc.set_in_sample_rate(RATE)
    enc.set_channels(1)
    enc.set_quality(2)
    return bytes(enc.encode(bytes(pcm)) + enc.flush())


def main() -> int:
    fake = "--fake" in sys.argv
    job = json.load(sys.stdin)
    os.makedirs(job["out"], exist_ok=True)
    if not fake:
        from kokoro import KPipeline  # imported late so --fake works without the model

        pipe = KPipeline(lang_code="b", repo_id="hexgrad/Kokoro-82M")  # "b" = British English
    for clip in job["clips"]:
        samples: list[float] = []
        for seg in clip["segments"]:
            if fake:
                samples += [0.2 * math.sin(2 * math.pi * 220 * i / RATE) for i in range(int(RATE * 0.3))]
            else:
                for result in pipe(seg["text"], voice=job["voice"], speed=job.get("speed", 1.0)):
                    audio = result[2] if isinstance(result, tuple) else result.audio
                    if audio is None:
                        continue
                    arr = audio.numpy() if hasattr(audio, "numpy") else audio
                    samples += [float(x) for x in arr]
            samples += [0.0] * int(RATE * seg.get("pauseAfterMs", 0) / 1000)
        path = os.path.join(job["out"], f"{clip['key']}.mp3")
        with open(path, "wb") as f:
            f.write(to_mp3(samples))
        print(json.dumps({"key": clip["key"], "file": f"{clip['key']}.mp3", "seconds": round(len(samples) / RATE, 1)}), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
