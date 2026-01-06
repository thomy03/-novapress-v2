import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.ml.llm import llm_service

async def verify_openrouter():
    print("🔍 Verifying OpenRouter Integration...")
    
    try:
        # Initialize
        await llm_service.initialize()
        print(f"✅ Client initialized with model: {llm_service.model}")
        
        # Test Generation
        print("\n🧪 Testing simple generation...")
        response = await llm_service.generate("Hello, are you ready?", max_tokens=20)
        print(f"🤖 Response: {response}")
        
        if response:
            print("✅ Generation successful")
        else:
            print("❌ Generation failed (empty response)")
            
        # Test JSON Generation
        print("\n🧪 Testing JSON generation...")
        json_response = await llm_service.generate_json("Give me a random color in JSON format: {color: 'name', hex: '#code'}")
        print(f"🤖 JSON Response: {json_response}")
        
        if json_response and 'color' in json_response:
            print("✅ JSON Generation successful")
        else:
            print("❌ JSON Generation failed")

    except Exception as e:
        print(f"\n❌ Error during verification: {e}")

if __name__ == "__main__":
    asyncio.run(verify_openrouter())
