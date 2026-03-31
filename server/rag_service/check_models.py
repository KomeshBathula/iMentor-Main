import os
from google import genai
from dotenv import load_dotenv

# Load .env from server directory
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

api_key = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=api_key)

with open('available_models.txt', 'w') as f:
    try:
        f.write("Available models:\n")
        for m in client.models.list():
            f.write(f"- {m.name}\n")
    except Exception as e:
        f.write(f"Error listing models: {e}\n")
