"""Wake word, speech-to-text and text-to-speech. All local; nothing leaves the Mac.

Optional: install with ``pip install -e '.[voice]'``. Without the extras, text mode still works.
"""

from __future__ import annotations

import subprocess
import sys
from typing import Any


class VoiceUnavailable(RuntimeError):
    """A voice dependency or credential is missing."""


# British first, most natural first. Premium/Enhanced voices are free downloads in System Settings →
# Accessibility → Spoken Content → System voice → Manage Voices.
PREFERRED_VOICES = ("Jamie (Premium)", "Daniel (Enhanced)", "Oliver (Enhanced)", "Jamie", "Daniel")


def pick_voice(requested: str, installed: str | None = None) -> str:
    """The `say` voice: the requested one, or with "auto" the best installed British voice."""
    if requested != "auto":
        return requested
    if installed is None:
        try:
            installed = subprocess.run(
                ["say", "-v", "?"], capture_output=True, text=True, timeout=10
            ).stdout
        except (OSError, subprocess.SubprocessError):
            installed = ""
    names = {line.split("  ")[0].strip() for line in installed.splitlines() if line.strip()}
    return next((v for v in PREFERRED_VOICES if v in names), "Daniel")


def speak(text: str, voice: str) -> None:
    text = text.strip()[:1000]
    if not text:
        return
    if sys.platform == "darwin":
        subprocess.run(["say", "-v", voice, text], check=False, timeout=120)
    else:
        print(f"jarvis> {text}")


class _OpenWakeWord:
    """Free, offline, no account: openWakeWord's pretrained "hey jarvis" model."""

    sample_rate = 16_000
    frame_length = 1_280  # 80 ms, the chunk size the model is trained on
    MODEL = "hey_jarvis"

    def __init__(self, threshold: float) -> None:
        try:
            from openwakeword.model import Model
            from openwakeword.utils import download_models
        except ImportError as exc:
            raise VoiceUnavailable(
                f"openWakeWord is not installed ({exc.name}). Run: pip install -e '.[voice]'"
            ) from exc
        try:
            download_models(model_names=[self.MODEL])  # no-op once cached
            self._model: Any = Model(wakeword_models=[self.MODEL], inference_framework="onnx")
        except Exception as exc:  # network on first run, or a corrupt cache
            raise VoiceUnavailable(f"Couldn't load the wake-word model: {exc}") from exc
        self._threshold = threshold

    def heard(self, frame: Any) -> bool:
        scores: dict[str, float] = self._model.predict(frame)
        if max(scores.values(), default=0.0) >= self._threshold:
            self._model.reset()  # one phrase fires once
            return True
        return False

    def close(self) -> None:
        pass


class _Porcupine:
    """Picovoice Porcupine's built-in "jarvis" keyword. Needs a free Picovoice access key."""

    def __init__(self, access_key: str) -> None:
        if not access_key:
            raise VoiceUnavailable(
                "Set JARVIS_PICOVOICE_ACCESS_KEY (free at console.picovoice.ai), "
                "or use JARVIS_WAKE_ENGINE=openwakeword."
            )
        try:
            import pvporcupine
        except ImportError as exc:
            raise VoiceUnavailable(
                "Porcupine is not installed. Run: pip install -e '.[voice,porcupine]'"
            ) from exc
        self._p: Any = pvporcupine.create(access_key=access_key, keywords=["jarvis"])
        self.sample_rate = int(self._p.sample_rate)
        self.frame_length = int(self._p.frame_length)

    def heard(self, frame: Any) -> bool:
        return bool(self._p.process(frame) >= 0)

    def close(self) -> None:
        self._p.delete()


class VoiceIO:
    """Wake word (openWakeWord or Porcupine), then faster-whisper for transcription."""

    SILENCE_RMS = 500  # int16 RMS below this counts as silence; raise it in a noisy room

    def __init__(
        self,
        whisper_model: str,
        wake_threshold: float = 0.5,
        *,
        engine: str = "openwakeword",
        picovoice_access_key: str = "",
    ) -> None:
        try:
            import numpy as np
            import pyaudio
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise VoiceUnavailable(
                f"Voice extras are not installed ({exc.name}). Run: pip install -e '.[voice]'"
            ) from exc
        self._np: Any = np
        self._wake: _OpenWakeWord | _Porcupine = (
            _Porcupine(picovoice_access_key)
            if engine == "porcupine"
            else _OpenWakeWord(wake_threshold)
        )
        self.SAMPLE_RATE = self._wake.sample_rate
        self.FRAME = self._wake.frame_length
        self._audio: Any = pyaudio.PyAudio()
        self._stream: Any = self._audio.open(
            rate=self.SAMPLE_RATE,
            channels=1,
            format=pyaudio.paInt16,
            input=True,
            frames_per_buffer=self.FRAME,
        )
        self._model: Any = WhisperModel(whisper_model, device="cpu", compute_type="int8")

    def _frame(self) -> Any:
        data = self._stream.read(self.FRAME, exception_on_overflow=False)
        return self._np.frombuffer(data, dtype=self._np.int16)

    def wait_for_wake_word(self) -> None:
        while not self._wake.heard(self._frame()):
            pass

    def record_utterance(
        self, max_seconds: float = 15.0, trailing_silence: float = 1.2, start_timeout: float = 4.0
    ) -> Any:
        frame_seconds = self.FRAME / self.SAMPLE_RATE
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
            elif elapsed > start_timeout:
                break  # nothing said
        audio = self._np.concatenate(frames).astype(self._np.float32) / 32768.0
        return audio if heard_speech else None

    def transcribe(self, audio: Any) -> str:
        if audio is None:
            return ""
        segments, _info = self._model.transcribe(audio, language="en", beam_size=1)
        return " ".join(segment.text.strip() for segment in segments).strip()

    def listen(self, start_timeout: float = 4.0) -> str:
        return self.transcribe(self.record_utterance(start_timeout=start_timeout))

    def close(self) -> None:
        self._stream.close()
        self._audio.terminate()
        self._wake.close()


YES = {"yes", "confirm", "go ahead", "do it", "yes please", "yes go ahead", "confirmed", "approve"}


def is_yes(heard: str) -> bool:
    """Only a clear, short yes counts; "yes but…", "no" or silence decline."""
    return heard.lower().strip(" .!,") in YES


class VoiceConfirmer:
    """Speaks the action and goes ahead only on a clear spoken yes (only for important steps)."""

    def __init__(self, voice: VoiceIO, voice_name: str) -> None:
        self._voice = voice
        self._name = voice_name

    def confirm(self, summary: str) -> bool:
        print(f"\nJarvis wants to: {summary}")
        speak(f"Before I {summary}: shall I go ahead?", self._name)
        heard = self._voice.listen(start_timeout=6.0)
        print(f"you> {heard}")
        return is_yes(heard)
