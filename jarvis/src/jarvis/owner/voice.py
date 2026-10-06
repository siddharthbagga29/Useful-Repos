"""Wake word, speech-to-text and text-to-speech. All local; nothing leaves the Mac.

Optional: install with ``pip install -e '.[voice]'``. Without the extras, text mode still works.
"""

from __future__ import annotations

import subprocess
import sys
from typing import Any


class VoiceUnavailable(RuntimeError):
    """A voice dependency or credential is missing."""


def speak(text: str, voice: str) -> None:
    text = text.strip()[:1000]
    if not text:
        return
    if sys.platform == "darwin":
        subprocess.run(["say", "-v", voice, text], check=False, timeout=120)
    else:
        print(f"jarvis> {text}")


class VoiceIO:
    """Porcupine for the "Jarvis" wake word, faster-whisper for transcription."""

    SILENCE_RMS = 500  # int16 RMS below this counts as silence; raise it in a noisy room

    def __init__(self, access_key: str, whisper_model: str) -> None:
        if not access_key:
            raise VoiceUnavailable(
                "Set JARVIS_PICOVOICE_ACCESS_KEY (free key at console.picovoice.ai) "
                "to use voice mode."
            )
        try:
            import numpy as np
            import pvporcupine
            import pyaudio
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise VoiceUnavailable(
                f"Voice extras are not installed ({exc.name}). Run: pip install -e '.[voice]'"
            ) from exc
        self._np: Any = np
        self._porcupine: Any = pvporcupine.create(access_key=access_key, keywords=["jarvis"])
        self._audio: Any = pyaudio.PyAudio()
        self._stream: Any = self._audio.open(
            rate=self._porcupine.sample_rate,
            channels=1,
            format=pyaudio.paInt16,
            input=True,
            frames_per_buffer=self._porcupine.frame_length,
        )
        self._model: Any = WhisperModel(whisper_model, device="cpu", compute_type="int8")

    def _frame(self) -> Any:
        data = self._stream.read(self._porcupine.frame_length, exception_on_overflow=False)
        return self._np.frombuffer(data, dtype=self._np.int16)

    def wait_for_wake_word(self) -> None:
        while self._porcupine.process(self._frame()) < 0:
            pass

    def record_utterance(self, max_seconds: float = 15.0, trailing_silence: float = 1.2) -> Any:
        rate = self._porcupine.sample_rate
        frame_seconds = self._porcupine.frame_length / rate
        frames: list[Any] = []
        heard_speech = False
        quiet = 0.0
        elapsed = 0.0
        while elapsed < max_seconds:
            frame = self._frame()
            frames.append(frame)
            elapsed += frame_seconds
            rms = float(self._np.sqrt(self._np.mean(frame.astype(self._np.float32) ** 2)))
            if rms >= self.SILENCE_RMS:
                heard_speech, quiet = True, 0.0
            elif heard_speech:
                quiet += frame_seconds
                if quiet >= trailing_silence:
                    break
            elif elapsed > 4.0:
                break  # nothing said after the wake word
        audio = self._np.concatenate(frames).astype(self._np.float32) / 32768.0
        return audio if heard_speech else None

    def transcribe(self, audio: Any) -> str:
        if audio is None:
            return ""
        segments, _info = self._model.transcribe(audio, language="en", beam_size=1)
        return " ".join(segment.text.strip() for segment in segments).strip()

    def listen(self) -> str:
        return self.transcribe(self.record_utterance())

    def close(self) -> None:
        self._stream.close()
        self._audio.terminate()
        self._porcupine.delete()


class VoiceConfirmer:
    """Speaks the action and accepts only the word "confirm". Opt-in: JARVIS_VOICE_CONFIRM."""

    def __init__(self, voice: VoiceIO, voice_name: str) -> None:
        self._voice = voice
        self._name = voice_name

    def confirm(self, summary: str) -> bool:
        print(f"\nJarvis wants to: {summary}")
        speak(f"I'm about to {summary}. Say confirm to go ahead.", self._name)
        heard = self._voice.listen().lower().strip(" .!")
        return heard == "confirm"
