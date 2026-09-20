# SmartLoan AI

Intelligent Web-Based Loan Eligibility & Approval Prediction System using Machine Learning.

## Tech Stack
Node.js · Express · MongoDB · EJS · Tailwind CSS · Chart.js · Python · FastAPI · Scikit-learn · SHAP

## Setup

\`\`\`bash
npm install
cd ml && python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
python train.py
uvicorn predict_api:app --reload --port 8000
\`\`\`

In a second terminal:

\`\`\`bash
npm run dev
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`

## Ports
- Website: http://localhost:3000
- ML API: http://127.0.0.1:8000

## Disclaimer
This system produces ML-based decision-support predictions for academic purposes only. It does not constitute a real loan approval or official financial advice.s