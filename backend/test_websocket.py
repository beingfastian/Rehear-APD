import asyncio
import websockets
import json
import wave
import struct
import sys

async def test_websocket():
    """
    Test the WebSocket live transcription endpoint
    """
    uri = "ws://localhost:10000/ws/live-transcription"
    
    print(f"🔗 Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected!")
            
            # Send configuration
            config = {
                "type": "config",
                "sampleRate": 16000,
                "channels": 1
            }
            await websocket.send(json.dumps(config))
            print("📤 Sent configuration")
            
            # Wait for acknowledgment
            response = await websocket.recv()
            data = json.loads(response)
            print(f"📥 Received: {data}")
            
            if data.get("type") == "config_ack":
                print("✅ Configuration acknowledged")
            
            # Generate test audio (1 second of silence)
            sample_rate = 16000
            duration = 1  # seconds
            samples = sample_rate * duration
            
            print(f"\n📢 Generating {duration}s of test audio...")
            
            # Create a simple sine wave (440 Hz tone)
            import math
            frequency = 440  # A4 note
            audio_data = []
            
            for i in range(samples):
                value = int(32767 * 0.3 * math.sin(2 * math.pi * frequency * i / sample_rate))
                audio_data.append(struct.pack('h', value))
            
            audio_bytes = b''.join(audio_data)
            
            # Send audio data
            print("📤 Sending audio data...")
            await websocket.send(audio_bytes)
            
            # Wait for transcription (with timeout)
            print("⏳ Waiting for transcription...")
            
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=30)
                data = json.loads(response)
                print(f"\n📥 Received transcription:")
                print(f"   Type: {data.get('type')}")
                print(f"   Text: {data.get('text')}")
                print(f"   Chunk: {data.get('chunk')}")
            except asyncio.TimeoutError:
                print("⏱️  Timeout waiting for transcription (this is normal for pure tone)")
            
            # Send stop signal
            print("\n📤 Sending stop signal...")
            await websocket.send(json.dumps({"type": "stop"}))
            
            # Wait for complete message
            response = await websocket.recv()
            data = json.loads(response)
            print(f"📥 Final response: {data}")
            
            print("\n✅ Test completed successfully!")
            
    except ConnectionRefusedError:
        print("❌ Connection refused. Is the backend running?")
        print("   Start it with: uvicorn main:app --reload")
        sys.exit(1)
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    print("="*60)
    print("🎙️  WebSocket Live Transcription Test")
    print("="*60)
    print()
    
    asyncio.run(test_websocket())