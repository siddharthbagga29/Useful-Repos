"""Wake word, speech-to-text and text-to-speech. All local; nothing leaves the Mac.

Optional: install with ``pip install -e '.[voice]'``. Without the extras, text mode still works.
"""

from __future__ import annotations

import contextlib
import math
import re
import subprocess
import sys
from collections import deque
from typing import Any

from jarvis.owner.session import Utterance


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


def for_speech(text: str, limit: int = 450) -> str:
    """What gets said aloud: no markup, no LaTeX, and at most a few sentences (the full reply is
    still printed in Terminal)."""
    text = re.sub(r"\\boxed\{(.*?)\}", r"\1", text)
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = re.sub(r"[*_`#>|]+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = max(cut.rfind(". "), cut.rfind("? "), cut.rfind("! "))
    return cut[: end + 1] if end > 80 else cut.rsplit(" ", 1)[0] + "."


def speak(text: str, voice: str) -> None:
    text = for_speech(text)
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

    def reset(self) -> None:
        self._model.reset()

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

    def reset(self) -> None:
        pass  # Porcupine keeps no state between frames

    def close(self) -> None:
        self._p.delete()


class VoiceIO:
    """Wake word (openWakeWord or Porcupine), then faster-whisper for transcription."""

    SILENCE_RMS = 500  # int16 RMS below this is silence; calibrate() adapts it to the room

    def __init__(
        self,
        whisper_model: str,
        wake_threshold: float = 0.5,
        *,
        engine: str = "openwakeword",
        picovoice_access_key: str = "",
        max_utterance_seconds: float = 90.0,
        end_of_speech_seconds: float = 1.5,
    ) -> None:
        # Long enough to say a whole thought; a natural pause doesn't end it mid-sentence.
        self.max_utterance_seconds = max_utterance_seconds
        self.end_of_speech_seconds = end_of_speech_seconds
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
        self._pyaudio: Any = pyaudio
        self._open_stream()
        self._model: Any = WhisperModel(whisper_model, device="cpu", compute_type="int8")

    def _open_stream(self) -> None:
        self._audio: Any = self._pyaudio.PyAudio()
        self._stream: Any = self._audio.open(
            rate=self.SAMPLE_RATE,
            channels=1,
            format=self._pyaudio.paInt16,
            input=True,
            frames_per_buffer=self.FRAME,
        )

    def reopen(self) -> None:
        """Recover from a microphone error (device unplugged, input overflow): new stream, same
        models. The speech threshold is kept."""
        with contextlib.suppress(Exception):
            self._stream.close()
        with contextlib.suppress(Exception):
            self._audio.terminate()
        self._open_stream()
        self._wake.reset()

    def calibrate(self, seconds: float = 1.0) -> float:
        """Measure the room's background level and set the speech threshold just above it, so a
        quiet room hears a soft voice and a noisy one doesn't mistake the fan for speech."""
        frames = [
            self._frame() for _ in range(max(1, int(seconds * self.SAMPLE_RATE / self.FRAME)))
        ]
        audio = self._np.concatenate(frames).astype(self._np.float32)
        ambient = float(self._np.sqrt(self._np.mean(audio**2)))
        self.SILENCE_RMS = int(min(1500.0, max(180.0, ambient * 3.0)))
        return ambient

    def pause(self) -> None:
        """Stop capturing while Jarvis speaks, so he never hears (or wakes to) his own voice."""
        if self._stream.is_active():
            self._stream.stop_stream()

    def resume(self) -> None:
        """Start capturing again with an empty buffer and a fresh wake-word state."""
        if not self._stream.is_active():
            self._stream.start_stream()
        self._flush()
        self._wake.reset()

    def _flush(self) -> None:
        """Discard audio already captured but not yet read (e.g. while he was thinking), so it
        can't be mistaken for something said now. Explicit, rather than relying on the audio
        driver to clear its buffer on restart."""
        available = getattr(self._stream, "get_read_available", None)
        if available is None:
            return
        pending = int(available())
        if pending > 0:
            self._stream.read(pending, exception_on_overflow=False)

    def say(self, text: str, voice_name: str, interruptible: bool = False) -> bool:
        """Speak, then listen again from a clean buffer. Returns True if he was interrupted.

        Not interruptible: the microphone is paused while he talks. Interruptible: it keeps
        listening for the wake word only, and "Hey Jarvis" stops him mid-sentence. Speech isn't
        transcribed while he talks (no echo cancellation), so only the wake word can cut in."""
        if not interruptible or sys.platform != "darwin":
            self.pause()
            try:
                speak(text, voice_name)
            finally:
                self.resume()
            return False
        line = for_speech(text)
        if not line:
            return False
        self.resume()
        proc = subprocess.Popen(["say", "-v", voice_name, line])
        interrupted = False
        try:
            while proc.poll() is None:
                if self._wake.heard(self._frame()):
                    proc.terminate()
                    interrupted = True
                    break
        finally:
            if proc.poll() is None:
                proc.terminate()
            proc.wait(timeout=5)
            self.pause()  # drop everything recorded while he spoke
            self.resume()
        return interrupted

    def _frame(self) -> Any:
        data = self._stream.read(self.FRAME, exception_on_overflow=False)
        return self._np.frombuffer(data, dtype=self._np.int16)

    def wait_for_wake_word(self, timeout: float | None = None) -> bool:
        """Block until "Hey Jarvis" (True), or until `timeout` seconds pass (False)."""
        frame_seconds = self.FRAME / self.SAMPLE_RATE
        waited = 0.0
        while not self._wake.heard(self._frame()):
            waited += frame_seconds
            if timeout is not None and waited >= timeout:
                return False
        return True

    def record_utterance(
        self,
        max_seconds: float | None = None,
        trailing_silence: float | None = None,
        start_timeout: float = 4.0,
        ignore_seconds: float = 0.0,
    ) -> Any:
        """Audio from just before speech starts until a pause; None if nobody spoke within
        `start_timeout`. Only 0.3 s of lead-in is kept, so a long wait doesn't mean a long
        transcription. `ignore_seconds` skips a chime played as recording starts."""
        max_seconds = self.max_utterance_seconds if max_seconds is None else max_seconds
        trailing_silence = (
            self.end_of_speech_seconds if trailing_silence is None else trailing_silence
        )
        frame_seconds = self.FRAME / self.SAMPLE_RATE
        preroll: deque[Any] = deque(maxlen=max(1, int(0.3 / frame_seconds)))
        frames: list[Any] = []
        heard_speech = False
        quiet = 0.0
        waited = 0.0
        while True:
            frame = self._frame()
            waited += frame_seconds
            if waited <= ignore_seconds:
                continue
            rms = float(self._np.sqrt(self._np.mean(frame.astype(self._np.float32) ** 2)))
            if not heard_speech:
                preroll.append(frame)
                if rms >= self.SILENCE_RMS:
                    heard_speech, frames = True, list(preroll)
                elif waited > start_timeout:
                    return None  # nothing said
                continue
            frames.append(frame)
            if rms >= self.SILENCE_RMS:
                quiet = 0.0
            else:
                quiet += frame_seconds
                if quiet >= trailing_silence:
                    break
            if len(frames) * frame_seconds >= max_seconds:
                break
        return self._np.concatenate(frames).astype(self._np.float32) / 32768.0

    def transcribe(self, audio: Any) -> str:
        return self.transcribe_detailed(audio)[0]

    def transcribe_detailed(self, audio: Any) -> tuple[str, float]:
        """(text, confidence 0..1). Confidence is exp(mean log-probability) over segments."""
        if audio is None:
            return "", 0.0
        # The VAD filter drops non-speech, which stops Whisper "hearing" words in silence.
        segments, _info = self._model.transcribe(audio, language="en", beam_size=1, vad_filter=True)
        parts = list(segments)
        text = " ".join(seg.text.strip() for seg in parts).strip()
        if not parts:
            return "", 0.0
        mean_logprob = sum(seg.avg_logprob for seg in parts) / len(parts)
        return text, float(math.exp(mean_logprob))

    def listen_detailed(self, start_timeout: float, ignore_seconds: float = 0.0) -> Utterance:
        audio = self.record_utterance(start_timeout=start_timeout, ignore_seconds=ignore_seconds)
        if audio is None:
            return Utterance("", 0.0, heard_speech=False)
        text, confidence = self.transcribe_detailed(audio)
        return Utterance(text, confidence, heard_speech=True)

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
        self._voice.say(f"Before I {summary}: shall I go ahead?", self._name)
        heard = self._voice.listen(start_timeout=6.0)
        print(f"you> {heard}")
        return is_yes(heard)
