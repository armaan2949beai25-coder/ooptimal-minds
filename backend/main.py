import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from groq import Groq

# ─── Load environment ────────────────────────────────────────────────────────

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
    print("[WARNING] GROQ_API_KEY not set in .env -- /analyze-signals will fail")

# ─── FastAPI app ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Cognitive Fatigue Analyzer",
    description="Analyzes passive behavioral signals to determine cognitive fatigue level using Groq LLM",
    version="1.0.0",
)

# ─── CORS — allow Vite dev server ─────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request / Response models ────────────────────────────────────────────────

class SignalInput(BaseModel):
    typing_variance: float = Field(..., ge=0, description="Standard deviation of keystroke intervals (ms)")
    mouse_jitter: float = Field(..., ge=0, description="Ratio of actual mouse path to straight-line distance")
    scroll_reversals: int = Field(..., ge=0, description="Number of scroll direction changes in last 30s")
    click_accuracy: float = Field(..., ge=0, description="Average distance from click point to element center (px)")
    session_duration_minutes: float = Field(..., ge=0, description="How long the user has been active (minutes)")
    # Optional face signals (only present when webcam is active)
    blink_rate: float | None = Field(None, ge=0, description="Blinks per minute from face tracking")
    eye_openness: float | None = Field(None, ge=0, description="Eye aspect ratio from face tracking")
    gaze_stability: float | None = Field(None, ge=0, description="Gaze instability metric from iris tracking")


class AnalysisResponse(BaseModel):
    fatigue_level: str = Field(..., description="FRESH, MILD, or FATIGUED")
    score: int = Field(..., ge=0, le=100, description="Fatigue score 0-100")
    dominant_signal: str = Field(..., description="The signal contributing most to fatigue")
    recommendation: str = Field(..., description="Specific actionable advice")
    interface_adjustment: str = Field(..., description="What the UI should change")


# ─── System prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a cognitive load expert specializing in digital fatigue analysis.
You analyze passive behavioral signals collected from a user's interaction with their computer
to determine their cognitive fatigue level and provide actionable recommendations.

Behavioral signals you receive:
- typing_variance: Standard deviation of time between keystrokes (ms). Higher = more erratic = more fatigued.
  Normal: 20-50ms | Mild fatigue: 50-120ms | High fatigue: 120ms+
- mouse_jitter: Ratio of actual mouse path length to straight-line distance. 1.0 = perfectly smooth.
  Normal: 1.0-1.5 | Mild fatigue: 1.5-3.0 | High fatigue: 3.0+
- scroll_reversals: Number of times scroll direction changed in last 30 seconds.
  Normal: 0-2 | Mild fatigue: 3-6 | High fatigue: 7+
- click_accuracy: Average distance from where user clicked to center of target element (px).
  Normal: 0-15px | Mild fatigue: 15-40px | High fatigue: 40px+
- session_duration_minutes: How long the user has been working without a significant break.

Optional face tracking signals (may not be present if camera is unavailable):
- blink_rate: Blinks per minute. Normal: 15-20 | Fatigued: <8 or >25
- eye_openness: Eye Aspect Ratio. Normal: 0.25-0.35 | Fatigued: <0.18 (heavy eyelids)
- gaze_stability: How much eye direction shifts. Normal: 0-5 | Fatigued: 20+

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) with these exact fields:
{
  "fatigue_level": "FRESH" or "MILD" or "FATIGUED",
  "score": <integer 0-100>,
  "dominant_signal": "<which signal is the strongest indicator of fatigue and why>",
  "recommendation": "<specific, actionable advice tailored to the dominant signal>",
  "interface_adjustment": "<exactly what the UI should change to reduce cognitive load>"
}"""


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@app.post("/analyze-signals", response_model=AnalysisResponse)
async def analyze_signals(signals: SignalInput):
    """
    Analyze passive behavioral signals using Groq LLM to determine fatigue level
    and generate personalized recommendations.
    """
    if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not configured. Set it in backend/.env",
        )

    # Build the user message with signal data
    face_section = ""
    if signals.blink_rate is not None:
        face_section = f"""\n\nFace tracking signals (from webcam):
- Blink rate: {signals.blink_rate:.1f} blinks/min
- Eye openness (EAR): {signals.eye_openness:.3f}
- Gaze stability (drift): {signals.gaze_stability:.1f}"""

    user_message = f"""Analyze these behavioral signals and determine the user's cognitive fatigue:

- Typing variance (keystroke interval std dev): {signals.typing_variance:.1f} ms
- Mouse jitter (path ratio): {signals.mouse_jitter:.2f}x
- Scroll reversals (last 30s): {signals.scroll_reversals}
- Click accuracy (avg offset): {signals.click_accuracy:.1f} px
- Session duration: {signals.session_duration_minutes:.1f} minutes{face_section}

Provide your fatigue assessment as a JSON object."""

    try:
        client = Groq(api_key=GROQ_API_KEY)

        chat_completion = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.3,
            max_tokens=512,
            response_format={"type": "json_object"},
        )

        raw_response = chat_completion.choices[0].message.content

        # Parse the LLM JSON response
        try:
            result = json.loads(raw_response)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=502,
                detail=f"LLM returned invalid JSON: {raw_response[:300]}",
            )

        # Validate and normalize fields
        fatigue_level = result.get("fatigue_level", "FRESH").upper()
        if fatigue_level not in ("FRESH", "MILD", "FATIGUED"):
            fatigue_level = "FRESH"

        score = result.get("score", 0)
        if not isinstance(score, (int, float)):
            score = 0
        score = max(0, min(100, int(score)))

        return AnalysisResponse(
            fatigue_level=fatigue_level,
            score=score,
            dominant_signal=result.get("dominant_signal", "No dominant signal detected"),
            recommendation=result.get("recommendation", "Continue monitoring your patterns."),
            interface_adjustment=result.get("interface_adjustment", "No changes needed."),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Groq API error: {str(e)}",
        )


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "groq_configured": bool(GROQ_API_KEY and GROQ_API_KEY != "your_groq_api_key_here"),
    }
