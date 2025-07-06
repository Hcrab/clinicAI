# ClinicAI

ClinicAI is a web-based assistant that helps users translate medical reports, chat with an AI assistant, and locate nearby clinics on an interactive map.  The project contains a Next.js front‑end and a small Flask back‑end API.

## Features

- **Chatbot** – ask questions and receive responses from the AI assistant.
- **Report translation** – translate medical report summaries through the API.
- **Map** – browse clinics on a world map and filter by department.

## Running locally

1. **Install Node.js and Python**
   - Node.js 18 or newer is recommended.
   - Python 3.11 with `flask`, `flask-cors` and `openai`.
     ```bash
     pip install flask flask-cors openai
     ```
2. **Install Node dependencies**
   ```bash
   npm install
   ```
3. **Set environment variables**
   - `DEEPSEEK_API_KEY` – API key for the language model backend.
   - `NEXT_PUBLIC_BACKEND_URL` – URL where the Flask API is running, e.g. `http://localhost:5000`.
4. **Start the Flask API**
   ```bash
   python app.py
   ```
5. **Start the Next.js dev server** (in a new terminal)
   ```bash
   npm run dev
   ```
6. Visit `http://localhost:3000` in your browser.

## Running in a VM or container

1. Ensure Docker and Docker Compose are installed on the VM.
2. Create a `.env` file with the required environment variables mentioned above.
3. Build and run using Docker Compose:
   ```bash
   docker-compose up --build
   ```
   The application will be available on port 3000 of the VM.

## Notes

All API keys and log files have been removed from the repository.  Configure your own credentials via environment variables when deploying.
