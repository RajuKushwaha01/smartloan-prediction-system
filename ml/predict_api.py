"""
SmartLoan AI — Prediction Microservice
Loads model.pkl and iso_forest.pkl ONCE at startup and keeps them in
memory — never reloaded per request.
Run: uvicorn predict_api:app --reload --port 8000
"""
from fastapi import FastAPI
from pydantic import BaseModel, Field
import pandas as pd
import joblib
import json
import os
import warnings

warnings.filterwarnings("ignore")

app = FastAPI(title="SmartLoan AI - ML Prediction Service")

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "model_artifacts")
MODEL_PATH = os.path.join(ARTIFACT_DIR, "model.pkl")
METRICS_PATH = os.path.join(ARTIFACT_DIR, "metrics.json")
ISO_FOREST_PATH = os.path.join(ARTIFACT_DIR, "iso_forest.pkl")

# ============ LOADED ONCE AT STARTUP, KEPT IN MEMORY ============
model = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None
metrics = json.load(open(METRICS_PATH)) if os.path.exists(METRICS_PATH) else {}
iso_forest = joblib.load(ISO_FOREST_PATH) if os.path.exists(ISO_FOREST_PATH) else None

MODEL_NAME = metrics.get("selected_model", "Random Forest")
MODEL_VERSION = metrics.get("model_version", "RF-v1.1")
FEATURE_VERSION = metrics.get("feature_version", "v1.2")
NEUTRAL_THRESHOLD_PCT = 15  # contributions below this % of the top factor are Neutral

shap_explainer = None
SHAP_AVAILABLE = False
try:
    import shap
    if model is not None:
        classifier = model.named_steps["classifier"]
        if hasattr(classifier, "feature_importances_"):
            shap_explainer = shap.TreeExplainer(classifier)
            SHAP_AVAILABLE = True
except Exception as e:
    print(f"⚠ SHAP unavailable, using fallback importance: {e}")


# ============ REQUEST SCHEMAS ============
class ApplicationData(BaseModel):
    gender: str = Field(..., description="Male / Female")
    married: str = Field(..., description="Yes / No")
    dependents: str = Field(..., description="0 / 1 / 2 / 3+")
    education: str = Field(..., description="Graduate / Not Graduate")
    self_employed: str = Field(..., description="Yes / No")
    applicant_income: float
    coapplicant_income: float = 0
    loan_amount: float          # in thousands, matching training convention
    loan_term: int              # in months
    credit_history: float       # 1.0 good / 0.5 average / 0.0 poor
    property_area: str = Field(..., description="Urban / Semiurban / Rural")


class AnomalyCheckData(BaseModel):
    applicant_income: float
    coapplicant_income: float = 0
    loan_amount: float
    loan_term: int = 360


CATEGORICAL_COLS = ["Gender", "Married", "Dependents", "Education", "Self_Employed", "Property_Area"]
NUMERIC_COLS = ["ApplicantIncome", "CoapplicantIncome", "LoanAmount", "Loan_Amount_Term",
                "Credit_History", "TotalIncome", "LoanToIncomeRatio"]

READABLE_NAMES = {
    "Credit_History": "Credit History", "ApplicantIncome": "Applicant Income",
    "CoapplicantIncome": "Co-Applicant Income", "LoanAmount": "Loan Amount",
    "Loan_Amount_Term": "Loan Tenure", "TotalIncome": "Total Income",
    "LoanToIncomeRatio": "Loan-to-Income Ratio", "Dependents": "Dependents",
    "Education": "Education", "Self_Employed": "Self Employment",
    "Married": "Marital Status", "Gender": "Gender", "Property_Area": "Property Area"
}


def build_feature_row(data: ApplicationData) -> dict:
    """Builds the exact feature dict sent to the model — stored verbatim for audit."""
    total_income = data.applicant_income + data.coapplicant_income
    loan_to_income = (data.loan_amount * 1000) / (total_income + 1) if total_income else 0

    return {
        "Gender": data.gender,
        "Married": data.married,
        "Dependents": data.dependents,
        "Education": data.education,
        "Self_Employed": data.self_employed,
        "ApplicantIncome": data.applicant_income,
        "CoapplicantIncome": data.coapplicant_income,
        "LoanAmount": data.loan_amount,
        "Loan_Amount_Term": data.loan_term,
        "Credit_History": data.credit_history,
        "Property_Area": data.property_area,
        "TotalIncome": total_income,
        "LoanToIncomeRatio": loan_to_income
    }


def get_shap_factors(input_df: pd.DataFrame, top_n=4):
    preprocessor = model.named_steps["preprocessor"]
    transformed = preprocessor.transform(input_df)
    if hasattr(transformed, "toarray"):
        transformed = transformed.toarray()

    ohe_features = preprocessor.named_transformers_["cat"].named_steps["onehot"].get_feature_names_out(CATEGORICAL_COLS)
    all_feature_names = list(ohe_features) + NUMERIC_COLS

    shap_values = shap_explainer.shap_values(transformed)
    values = shap_values[1][0] if isinstance(shap_values, list) else shap_values[0]

    grouped = {}
    for fname, val in zip(all_feature_names, values):
        base = fname.split("_")[0] if fname not in NUMERIC_COLS else fname
        base_readable = READABLE_NAMES.get(base, base.replace("_", " "))
        grouped.setdefault(base_readable, {"mag": 0, "signs": []})
        grouped[base_readable]["mag"] += abs(float(val))
        grouped[base_readable]["signs"].append(float(val))

    factors = [
        {"name": k, "magnitude": v["mag"], "impact": "Positive" if sum(v["signs"]) > 0 else "Negative"}
        for k, v in grouped.items()
    ]
    factors.sort(key=lambda x: -x["magnitude"])
    max_mag = factors[0]["magnitude"] if factors else 1

    result = []
    for f in factors[:max(top_n, 6)]:
        contribution = round(min(100, (f["magnitude"] / max_mag) * 100), 1)
        impact = "Neutral" if contribution < NEUTRAL_THRESHOLD_PCT else f["impact"]
        result.append({"name": f["name"], "contribution": contribution, "impact": impact})
    return result[:top_n]


def get_fallback_factors(top_n=4):
    global_importance = metrics.get("feature_importance_global") or []
    factors = []
    for item in global_importance[:top_n]:
        base = item["feature"].split("_")[0]
        readable = READABLE_NAMES.get(base, base.replace("_", " "))
        contribution = round(item["importance"] * 100 * 5, 1)
        impact = "Neutral" if contribution < NEUTRAL_THRESHOLD_PCT else "Positive"
        factors.append({"name": readable, "contribution": contribution, "impact": impact})
    return factors or [{"name": "Credit History", "contribution": 70, "impact": "Positive"}]


# ============ ROOT / INFO ENDPOINTS ============
@app.get("/")
def root():
    return {
        "status": "SmartLoan AI ML service running",
        "model_loaded": model is not None,
        "shap_enabled": SHAP_AVAILABLE,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "feature_version": FEATURE_VERSION
    }


@app.get("/health")
def health_check():
    """Standard health check — used by Node.js to monitor ML service status."""
    return {
        "status": "healthy" if model is not None else "degraded",
        "model_loaded": model is not None,
        "model_version": MODEL_VERSION
    }


@app.get("/model-info")
def model_info():
    if not metrics:
        return {"error": "No metrics found. Run train.py first."}
    return metrics


# ============ CORE PREDICTION ============
def _run_prediction(data: ApplicationData):
    """Shared logic used by both /predict and /predict/simulate."""
    feature_row = build_feature_row(data)
    input_df = pd.DataFrame([feature_row])

    proba = model.predict_proba(input_df)[0][1]
    probability = round(float(proba), 4)

    if probability >= 0.65:
        prediction = "Eligible"
    elif probability >= 0.40:
        prediction = "Review"
    else:
        prediction = "Not Eligible"

    try:
        factors = get_shap_factors(input_df) if SHAP_AVAILABLE else get_fallback_factors()
        explanation_method = "SHAP (TreeExplainer)" if SHAP_AVAILABLE else "Global Feature Importance"
    except Exception:
        factors = get_fallback_factors()
        explanation_method = "Global Feature Importance (SHAP failed: fallback used)"

    total_income = data.applicant_income + data.coapplicant_income
    income_stability = min(100, max(0, (total_income / 100000) * 100))
    estimated_emi = (data.loan_amount * 1000 / max(data.loan_term, 1)) * 1.08
    debt_burden = min(100, (estimated_emi / total_income * 100)) if total_income > 0 else 100
    loan_affordability = max(0, 100 - debt_burden)

    return {
        "prediction": prediction,
        "probability": probability,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "feature_version": FEATURE_VERSION,
        "factors": factors,
        "explanation_method": explanation_method,
        "feature_values": feature_row,
        "interpretation": (
            f"The model assigns the submitted application a predicted probability of "
            f"{probability:.2f} for the '{prediction}' class."
        ),
        "calibration_note": "This probability reflects the classifier's raw output and is "
                              "not a statistically calibrated confidence score.",
        "financial_health": {
            "income_stability": round(income_stability, 1),
            "loan_affordability": round(loan_affordability, 1),
            "debt_burden": round(debt_burden, 1)
        }
    }


@app.post("/predict")
def predict(data: ApplicationData):
    if model is None:
        return {"error": "Model not trained yet. Run train.py first."}
    return _run_prediction(data)


@app.post("/predict/simulate")
def predict_simulate(data: ApplicationData):
    """
    Identical logic to /predict but used for What-If scenarios —
    never persisted as an official prediction record.
    """
    if model is None:
        return {"error": "Model not trained yet. Run train.py first."}

    result = _run_prediction(data)
    result["is_simulation"] = True
    result["interpretation"] = (
        f"This is a simulated scenario. The model assigns this hypothetical "
        f"application a predicted probability of {result['probability']:.2f} "
        f"for the '{result['prediction']}' class. This does not guarantee real "
        f"lender behaviour."
    )
    return result


# ============ ANOMALY DETECTION (separate system) ============
@app.post("/anomaly/detect")
def detect_anomaly(data: AnomalyCheckData):
    """
    Statistical outlier detection via Isolation Forest — a SEPARATE
    system from the eligibility classifier. Returns an 'anomaly flag',
    never a fraud determination.
    """
    if iso_forest is None:
        return {"is_anomaly": False, "anomaly_score": None, "note": "Isolation Forest not trained yet."}

    features = pd.DataFrame([{
        "ApplicantIncome": data.applicant_income,
        "CoapplicantIncome": data.coapplicant_income,
        "LoanAmount": data.loan_amount,
        "Loan_Amount_Term": data.loan_term
    }])

    prediction = iso_forest.predict(features)[0]  # -1 = anomaly, 1 = normal
    score = float(iso_forest.decision_function(features)[0])

    return {
        "is_anomaly": bool(prediction == -1),
        "anomaly_score": round(score, 4),
        "note": "Statistical anomaly flag based on Isolation Forest — indicates the profile is unusual relative to training data, not a fraud determination."
    }