import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from groq import Groq

load_dotenv()

app = FastAPI(title="CogniFlow API", version="1.0.0")

# CORS — allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

MODEL = "llama3-8b-8192"


# ── Request / Response Models ────────────────────────────────────────

class SignalInput(BaseModel):
    typing_variance: float = Field(..., description="Variance in typing speed (ms)")
    mouse_jitter: float = Field(..., description="Mouse movement jitter (px)")
    scroll_reversals: int = Field(..., description="Number of scroll direction reversals")
    click_accuracy: float = Field(..., description="Click accuracy percentage (0-100)")
    blink_rate: float = Field(..., description="Blink rate (blinks per minute)")
    session_duration_minutes: float = Field(..., description="Session duration in minutes")
    fatigue_score: float = Field(..., description="Composite fatigue score (0-100)")


class AnalysisResponse(BaseModel):
    fatigue_level: str
    score: int
    dominant_signal: str
    recommendation: str
    interface_adjustment: str


# ── Routes ───────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze-signals", response_model=AnalysisResponse)
async def analyze_signals(signals: SignalInput):
    prompt = f"""You are a cognitive-fatigue analysis engine.
Analyze the following biometric / behavioral signals captured from a user session and return a JSON object — no markdown, no explanation, just raw JSON.

Signals:
- typing_variance: {signals.typing_variance} ms
- mouse_jitter: {signals.mouse_jitter} px
- scroll_reversals: {signals.scroll_reversals}
- click_accuracy: {signals.click_accuracy}%
- blink_rate: {signals.blink_rate} blinks/min
- session_duration_minutes: {signals.session_duration_minutes}
- fatigue_score: {signals.fatigue_score}/100

Return EXACTLY this JSON structure:
{{
  "fatigue_level": "FRESH" | "MILD" | "FATIGUED",
  "score": <integer 0-100>,
  "dominant_signal": "<name of the signal contributing most to fatigue>",
  "recommendation": "<one specific, actionable recommendation>",
  "interface_adjustment": "<one specific UI adjustment the app should make>"
}}

Rules:
- fatigue_level must be one of FRESH, MILD, or FATIGUED.
- score must be an integer between 0 and 100.
- dominant_signal must be one of: typing_variance, mouse_jitter, scroll_reversals, click_accuracy, blink_rate, session_duration_minutes, fatigue_score.
- Return ONLY valid JSON. No extra text."""

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a precise cognitive-fatigue analysis engine. Respond with valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
            model=MODEL,
            temperature=0.3,
            max_tokens=300,
        )

        raw = chat_completion.choices[0].message.content.strip()

        # Strip possible markdown fences the model might add
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]  # drop opening fence
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        raw = raw.strip()

        result = json.loads(raw)

        return AnalysisResponse(
            fatigue_level=result.get("fatigue_level", "MILD"),
            score=int(result.get("score", 50)),
            dominant_signal=result.get("dominant_signal", "fatigue_score"),
            recommendation=result.get("recommendation", "Take a short break."),
            interface_adjustment=result.get("interface_adjustment", "Dim non-essential UI elements."),
        )

    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Failed to parse LLM response as JSON.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Entry point ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
