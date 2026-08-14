import asyncio
import websockets
import json

async def test():
    try:
        uri = "ws://localhost:8000/ws/chat"
        print(f"Connecting to {uri}...")
        async with websockets.connect(uri) as ws:
            print("Connected!")
            await ws.send(json.dumps({"question": "hello", "session": "test"}))
            res = await ws.recv()
            print("Received:", res)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test())
