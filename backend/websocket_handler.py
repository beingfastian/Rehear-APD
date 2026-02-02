# backend/websocket_handler.py
# WORKING BASELINE VERSION - Guaranteed to show transcriptions
# Start here, then tune later

import os
import json
import asyncio
import tempfile
from typing import Optional
from pathlib import Path
import wave
import io

from fastapi import WebSocket, WebSocketDisconnect
from openai import OpenAI
from pydub import AudioSegment
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env", override=True)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# FFmpeg paths - UPDATE THESE FOR YOUR SYSTEM
FFMPEG_PATH = r"C:\Users\Dell\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe"
FFPROBE_PATH = r"C:\Users\Dell\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffprobe.exe"

# For Mac/Linux, use:
# FFMPEG_PATH = "ffmpeg"
# FFPROBE_PATH = "ffprobe"

AudioSegment.converter = FFMPEG_PATH
AudioSegment.ffprobe = FFPROBE_PATH
os.environ["PATH"] = os.path.dirname(FFMPEG_PATH) + os.pathsep + os.environ.get("PATH", "")

print("="*70)
print("🔧 WEBSOCKET HANDLER - BASELINE VERSION")
print("="*70)
print(f"✅ FFmpeg path: {FFMPEG_PATH}")
print(f"✅ OpenAI API key: {'Found' if OPENAI_API_KEY else 'NOT FOUND'}")
print("="*70)

client: Optional[OpenAI] = None
if not OPENAI_API_KEY:
    print("❌ CRITICAL: OPENAI_API_KEY not found in .env!")
else:
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        _ = client.models.list()
        print("✅ OpenAI client initialized and verified")
    except Exception as e:
        print(f"❌ OpenAI initialization failed: {e}")
        client = None


class LiveTranscriptionHandler:
    """
    BASELINE VERSION - Minimal thresholds to ensure transcription happens
    """

    def __init__(self):
        # VERY PERMISSIVE SETTINGS - Will transcribe almost anything
        print("\n🎯 LiveTranscriptionHandler Configuration:")
        
        self.buffer_size_sec = 2.0  # Wait 2 seconds (longer = more context)
        print(f"   📊 Buffer size: {self.buffer_size_sec}s")
        
        self.sample_rate = 16000
        self.channels = 1
        self.sample_width = 2
        
        self.min_audio_sec = 1.0  # Require at least 1 second
        print(f"   ⏱️  Min audio: {self.min_audio_sec}s")
        
        self.overlap_sec = 0.2
        
        self.min_webm_bytes_to_decode = 20_000  # Low threshold
        print(f"   📦 Min WebM bytes: {self.min_webm_bytes_to_decode}")
        
        self.force_decode_timeout = 2.5  # Give plenty of time
        print(f"   ⏲️  Force decode timeout: {self.force_decode_timeout}s")
        
        print("="*70 + "\n")

    async def handle_connection(self, websocket: WebSocket):
        await websocket.accept()

        if client is None:
            await websocket.send_json({
                "type": "error",
                "code": "NO_API_KEY",
                "message": "OpenAI API key not configured"
            })
            await websocket.close()
            return

        print("🔗 [WebSocket] Client connected")

        pcm_buffer = bytearray()
        webm_buffer = bytearray()
        transcription_history: list[str] = []
        chunk_id = 0
        last_decode_time = asyncio.get_event_loop().time()

        try:
            while True:
                message = await websocket.receive()

                # Control messages
                if "text" in message and message["text"]:
                    try:
                        data = json.loads(message["text"])
                    except json.JSONDecodeError:
                        continue

                    msg_type = data.get("type")

                    if msg_type == "config":
                        await websocket.send_json({"type": "config_ack", "status": "ready"})
                        print("⚙️  [WebSocket] Config acknowledged")
                        continue

                    if msg_type == "stop":
                        print("🛑 [WebSocket] Stop received")

                        # Process remaining audio
                        if len(webm_buffer) > 0:
                            try:
                                pcm = await self._convert_webm_to_pcm(bytes(webm_buffer))
                                pcm_buffer.extend(pcm)
                                print(f"   Decoded final WebM: {len(pcm)} bytes")
                            except Exception as e:
                                print(f"   ⚠️  Final decode failed: {e}")

                        # Transcribe final buffer
                        if len(pcm_buffer) > 0:
                            final_text = await self._transcribe_pcm(pcm_buffer, chunk_id)
                            if final_text:
                                transcription_history.append(final_text)
                                await websocket.send_json({
                                    "type": "transcription",
                                    "text": final_text,
                                    "chunk": chunk_id,
                                    "is_final": True
                                })

                        full_text = " ".join(transcription_history).strip()
                        await websocket.send_json({
                            "type": "complete",
                            "full_text": full_text,
                            "total_chunks": len(transcription_history)
                        })
                        print(f"✅ [WebSocket] Complete! Full text: '{full_text}'")
                        break

                    continue

                # Audio bytes
                if "bytes" in message and message["bytes"]:
                    webm_buffer.extend(message["bytes"])
                    print(f"📥 [WebSocket] Received {len(message['bytes'])} bytes (buffer: {len(webm_buffer)} bytes)")
                    
                    current_time = asyncio.get_event_loop().time()
                    time_since_decode = current_time - last_decode_time

                    # Decode when threshold met
                    should_decode = (
                        len(webm_buffer) >= self.min_webm_bytes_to_decode or
                        (len(webm_buffer) > 0 and time_since_decode >= self.force_decode_timeout)
                    )

                    if should_decode:
                        print(f"🔄 [WebSocket] Decoding WebM buffer ({len(webm_buffer)} bytes)...")
                        try:
                            pcm = await self._convert_webm_to_pcm(bytes(webm_buffer))
                            pcm_buffer.extend(pcm)
                            webm_buffer = bytearray()
                            last_decode_time = current_time
                            
                            pcm_duration = len(pcm_buffer) / (self.sample_rate * self.channels * self.sample_width)
                            print(f"   ✅ Decoded! PCM buffer now: {pcm_duration:.2f}s ({len(pcm_buffer)} bytes)")
                            
                        except Exception as e:
                            print(f"   ❌ Decode failed: {e}")

                    # Check if ready to transcribe
                    pcm_duration = len(pcm_buffer) / (self.sample_rate * self.channels * self.sample_width)

                    if pcm_duration >= self.buffer_size_sec:
                        print(f"📝 [WebSocket] Ready to transcribe chunk {chunk_id} ({pcm_duration:.2f}s)")
                        
                        text = await self._transcribe_pcm(pcm_buffer, chunk_id)
                        
                        if text and text.strip():
                            print(f"   ✅ Got transcription: '{text}'")
                            transcription_history.append(text)
                            await websocket.send_json({
                                "type": "transcription",
                                "text": text,
                                "chunk": chunk_id,
                                "is_final": False,
                                "seconds": round(pcm_duration, 2)
                            })
                        else:
                            print(f"   ⚠️  No text returned from Whisper")

                        # Keep overlap
                        overlap_bytes = int(self.overlap_sec * self.sample_rate * self.channels * self.sample_width)
                        if len(pcm_buffer) > overlap_bytes:
                            pcm_buffer = pcm_buffer[-overlap_bytes:]
                        else:
                            pcm_buffer = bytearray()

                        chunk_id += 1

        except WebSocketDisconnect:
            print("🔌 [WebSocket] Client disconnected")
        except Exception as e:
            print(f"❌ [WebSocket] Error: {e}")
            import traceback
            traceback.print_exc()

    async def _convert_webm_to_pcm(self, webm_bytes: bytes) -> bytes:
        """Decode WebM to PCM"""
        return await asyncio.to_thread(self._convert_webm_to_pcm_sync, webm_bytes)

    def _convert_webm_to_pcm_sync(self, webm_bytes: bytes) -> bytes:
        """Synchronous conversion"""
        try:
            audio = AudioSegment.from_file(io.BytesIO(webm_bytes), format="webm")
            audio = audio.set_frame_rate(self.sample_rate)
            audio = audio.set_channels(self.channels)
            audio = audio.set_sample_width(self.sample_width)
            return audio.raw_data
        except Exception as e:
            print(f"❌ FFmpeg decode error: {e}")
            raise

    async def _transcribe_pcm(self, pcm_data: bytearray, chunk_id: int) -> Optional[str]:
        """Transcribe PCM audio with Whisper"""
        if client is None or not pcm_data:
            return None

        duration = len(pcm_data) / (self.sample_rate * self.channels * self.sample_width)
        
        if duration < self.min_audio_sec:
            print(f"   ⏭️  Chunk {chunk_id} too short ({duration:.2f}s < {self.min_audio_sec}s)")
            return None

        tmp_path = None
        try:
            # Create WAV file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = tmp.name

            with wave.open(tmp_path, "wb") as wf:
                wf.setnchannels(self.channels)
                wf.setsampwidth(self.sample_width)
                wf.setframerate(self.sample_rate)
                wf.writeframes(bytes(pcm_data))

            print(f"   🎤 Sending {duration:.2f}s to Whisper API...")

            # Transcribe
            with open(tmp_path, "rb") as f:
                response = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=f,
                    language="en",
                    response_format="text",
                    temperature=0.0
                )

            text = (response or "").strip()
            
            if text:
                print(f"   ✅ Whisper returned: '{text}'")
                return text
            else:
                print(f"   ⚠️  Whisper returned empty")
                return None

        except Exception as e:
            print(f"   ❌ Transcription error: {e}")
            import traceback
            traceback.print_exc()
            return None
            
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass


class AudioStreamProcessor:
    """Wrapper for compatibility"""
    def __init__(self, chunk_duration: float = 2.0):
        self.handler = LiveTranscriptionHandler()
        self.handler.buffer_size_sec = float(chunk_duration)

    async def process_stream(self, websocket: WebSocket):
        await self.handler.handle_connection(websocket)