"""`jarvis-owner --voice-check`: test each voice stage on its own, in about a minute.

1. speaker   Jarvis says a sentence (you confirm you heard it)
2. room      measures background noise and sets the speech threshold
3. speech    you say a sentence; it prints exactly what it heard
4. wake word you say "Hey Jarvis" within 15 seconds
Nothing is sent anywhere: wake word, transcription and speech all run on this Mac.
"""

from __future__ import annotations

import time

from jarvis.config import OwnerSettings


def voice_check(settings: OwnerSettings) -> int:
    from jarvis.owner.voice import VoiceIO, VoiceUnavailable, pick_voice

    voice_name = pick_voice(settings.voice_name)
    print(f"1/4 Speaker: using the voice {voice_name!r}.")
    try:
        voice = VoiceIO(
            settings.whisper_model,
            settings.wake_threshold,
            engine=settings.wake_engine,
            picovoice_access_key=settings.picovoice_access_key,
            max_utterance_seconds=settings.max_utterance_seconds,
            end_of_speech_seconds=settings.end_of_speech_seconds,
        )
    except VoiceUnavailable as exc:
        print(f"   ✗ {exc}")
        return 2
    except OSError as exc:  # PortAudio couldn't open an input device
        print(f"   ✗ Couldn't open the microphone: {exc}")
        print("     System Settings → Privacy & Security → Microphone → allow Terminal.")
        return 2
    failed = 0
    try:
        voice.say("Voice check. If you can hear me, the speaker works.", voice_name)
        print("   ✓ spoke a test sentence (you should have heard it)")

        print("2/4 Room: stay quiet for one second...")
        ambient = voice.calibrate()
        print(f"   ✓ background level {ambient:.0f}; speech counts above {voice.SILENCE_RMS}")
        if ambient < 1:
            print("   ✗ the microphone returns pure silence: macOS is blocking it.")
            print("     System Settings → Privacy & Security → Microphone → allow Terminal.")
            failed += 1

        voice.say("Now say any sentence.", voice_name)
        print("3/4 Speech: say a sentence now (you have 8 seconds to start)...")
        start = time.monotonic()
        heard = voice.listen(start_timeout=8.0)
        took = time.monotonic() - start
        if heard:
            print(f"   ✓ heard: {heard!r}  ({took:.1f}s including your speech)")
        else:
            failed += 1
            print("   ✗ heard nothing. Speak a little closer to the Mac and run the check again.")
            print("     If the room level above was 0, macOS is blocking the microphone.")

        voice.say("Last one. Say: Hey Jarvis.", voice_name)
        print("4/4 Wake word: say 'Hey Jarvis' within 15 seconds...")
        if voice.wait_for_wake_word(timeout=15.0):
            print("   ✓ wake word detected")
            voice.say("Got it.", voice_name)
        else:
            failed += 1
            print("   ✗ not detected. Try again a little louder; if it never fires, set")
            print("     JARVIS_WAKE_THRESHOLD=0.35 in jarvis/.env (lower = more sensitive).")
    finally:
        voice.close()
    print("\nVoice check passed." if not failed else f"\n{failed} voice stage(s) failed.")
    return 1 if failed else 0
