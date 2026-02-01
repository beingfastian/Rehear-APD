# backend/websocket_handler.py - Live Transcription WebSocket Handler (FIXED)

import os
import json
import asyncio
import tempfile
from typing import Optional
from pathlib import Path

from fastapi import WebSocket, WebSocketDisconnect
from openai import OpenAI
import wave

# Load environment variables from .env file
from dotenv import load_dotenv

# Get the directory of this file
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Now initialize OpenAI client with the loaded API key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    print("[WARNING] OPENAI_API_KEY not found in environment variables!")
    print("[WARNING] WebSocket live transcription will not work without API key")
    print("[WARNING] Please set OPENAI_API_KEY in your .env file")
    client = None
else:
    client = OpenAI(api_key=OPENAI_API_KEY)
    print(f"[WebSocket] OpenAI client initialized successfully")


class LiveTranscriptionHandler:
    """
    Handles WebSocket connections for live audio transcription.
    Receives audio chunks, buffers them, and sends back transcriptions.
    """
    
    def __init__(self):
        self.buffer_size = 3.0  # seconds
        self.sample_rate = 16000
        self.channels = 1
        self.sample_width = 2  # 16-bit audio
        self.overlap_duration = 0.5  # seconds of overlap to avoid missing words
        
    async def handle_connection(self, websocket: WebSocket):
        """
        Main WebSocket connection handler
        """
        await websocket.accept()
        
        # Check if OpenAI client is available
        if client is None:
            await websocket.send_json({
                "type": "error",
                "message": "OpenAI API key not configured. Please set OPENAI_API_KEY in .env file"
            })
            await websocket.close()
            return
        
        audio_buffer = bytearray()
        transcription_history = []
        chunk_count = 0
        
        print(f"[WebSocket] Client connected")
        
        try:
            while True:
                # Receive message from client
                message = await websocket.receive()
                
                if "text" in message:
                    # Handle control messages
                    data = json.loads(message["text"])
                    
                    if data.get("type") == "stop":
                        print(f"[WebSocket] Recording stopped by client")
                        
                        # Process any remaining audio in buffer
                        if len(audio_buffer) > 0:
                            final_text = await self._transcribe_chunk(
                                audio_buffer,
                                chunk_count
                            )
                            
                            if final_text:
                                await websocket.send_json({
                                    "type": "transcription",
                                    "text": final_text,
                                    "chunk": chunk_count,
                                    "is_final": True
                                })
                        
                        # Send complete transcription
                        complete_text = " ".join(transcription_history)
                        await websocket.send_json({
                            "type": "complete",
                            "full_text": complete_text,
                            "total_chunks": chunk_count
                        })
                        
                        break
                    
                    elif data.get("type") == "config":
                        # Client sending configuration
                        self.sample_rate = data.get("sampleRate", 16000)
                        print(f"[WebSocket] Config received: sample_rate={self.sample_rate}")
                        
                        await websocket.send_json({
                            "type": "config_ack",
                            "status": "ready"
                        })
                
                elif "bytes" in message:
                    # Handle audio data
                    audio_data = message["bytes"]
                    audio_buffer.extend(audio_data)
                    
                    # Calculate buffer duration
                    buffer_duration = len(audio_buffer) / (
                        self.sample_rate * self.channels * self.sample_width
                    )
                    
                    # Process when buffer reaches threshold
                    if buffer_duration >= self.buffer_size:
                        print(f"[WebSocket] Processing chunk {chunk_count}, buffer: {buffer_duration:.2f}s")
                        
                        # Transcribe the chunk
                        transcription = await self._transcribe_chunk(
                            audio_buffer,
                            chunk_count
                        )
                        
                        if transcription:
                            transcription_history.append(transcription)
                            
                            # Send transcription to client
                            await websocket.send_json({
                                "type": "transcription",
                                "text": transcription,
                                "chunk": chunk_count,
                                "is_final": False,
                                "timestamp": buffer_duration
                            })
                        
                        # Keep overlap for continuity
                        overlap_bytes = int(
                            self.overlap_duration * 
                            self.sample_rate * 
                            self.channels * 
                            self.sample_width
                        )
                        
                        if len(audio_buffer) > overlap_bytes:
                            audio_buffer = audio_buffer[-overlap_bytes:]
                        else:
                            audio_buffer = bytearray()
                        
                        chunk_count += 1
        
        except WebSocketDisconnect:
            print(f"[WebSocket] Client disconnected")
        
        except Exception as e:
            print(f"[WebSocket] Error: {e}")
            import traceback
            traceback.print_exc()
            
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })
            except:
                pass
    
    async def _transcribe_chunk(self, audio_data: bytearray, chunk_id: int) -> Optional[str]:
        """
        Transcribe a single audio chunk using OpenAI Whisper
        """
        if len(audio_data) == 0:
            return None
        
        if client is None:
            print(f"[WebSocket] Cannot transcribe: OpenAI client not initialized")
            return None
        
        try:
            # Create temporary WAV file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                tmp_path = tmp_file.name
                
                # Write WAV file
                with wave.open(tmp_path, 'wb') as wav_file:
                    wav_file.setnchannels(self.channels)
                    wav_file.setsampwidth(self.sample_width)
                    wav_file.setframerate(self.sample_rate)
                    wav_file.writeframes(bytes(audio_data))
            
            # Transcribe using OpenAI Whisper
            with open(tmp_path, "rb") as audio_file:
                transcription = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en",
                    response_format="text",
                    temperature=0.0
                )
            
            # Clean up
            os.unlink(tmp_path)
            
            text = transcription.strip()
            print(f"[WebSocket] Chunk {chunk_id} transcribed: {text[:50]}...")
            
            return text if text else None
        
        except Exception as e:
            print(f"[WebSocket] Transcription error for chunk {chunk_id}: {e}")
            return None


class AudioStreamProcessor:
    """
    Alternative implementation using streaming approach
    Processes audio in smaller chunks for faster feedback
    """
    
    def __init__(self, chunk_duration: float = 2.0):
        self.chunk_duration = chunk_duration
        self.sample_rate = 16000
        self.handler = LiveTranscriptionHandler()
        # Update handler's buffer size
        self.handler.buffer_size = chunk_duration
    
    async def process_stream(self, websocket: WebSocket):
        """
        Process audio stream with faster chunk processing
        """
        await self.handler.handle_connection(websocket)
