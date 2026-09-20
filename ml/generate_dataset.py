"""
Generates a synthetic loan_data.csv matching the project's documented
schema, so the ML pipeline runs end-to-end without requiring an
external download. Replace with a real dataset for production-grade
evaluation — see dataset/README.md.
"""
import numpy as np
import pandas as pd
import os

np.random.seed(42)
n = 1500

genders = np.random.choice(["Male", "Female"], n, p=[0.7, 0.3])
married = np.random.choice(["Yes", "No"], n, p=[0.65, 0.35])
dependents = np.random.choice(["0", "1", "2", "3+"], n, p=[0.55, 0.18, 0.18, 0.09])
education = np.random.choice(["Graduate", "Not Graduate"], n, p=[0.78, 0.22])
self_employed = np.random.choice(["Yes", "No"], n, p=[0.14, 0.86])
property_area = np.random.choice(["Urban", "Semiurban", "Rural"], n, p=[0.38, 0.38, 0.24])

applicant_income = np.random.gamma(shape=4, scale=1500, size=n).round(0) + 1500
coapplicant_income = np.where(
    married == "Yes",
    np.random.gamma(shape=2, scale=900, size=n).round(0),
    0
)
loan_amount = (np.random.gamma(shape=3, scale=45, size=n) + 30).round(0)  # in thousands
loan_term = np.random.choice([120, 180, 240, 300, 360], n, p=[0.1, 0.15, 0.2, 0.15, 0.4])
credit_history = np.random.choice([1.0, 0.5, 0.0], n, p=[0.6, 0.25, 0.15])

# Underlying "true" eligibility signal used to generate a realistic target
income_total = applicant_income + coapplicant_income
loan_to_income = (loan_amount * 1000) / (income_total + 1)

score = (
    0.45 * credit_history
    + 0.25 * (income_total / income_total.max())
    - 0.20 * (loan_to_income / loan_to_income.max())
    + 0.10 * (education == "Graduate").astype(int)
)
noise = np.random.normal(0, 0.08, n)
loan_status = np.where((score + noise) > np.median(score), "Y", "N")

df = pd.DataFrame({
    "Gender": genders,
    "Married": married,
    "Dependents": dependents,
    "Education": education,
    "Self_Employed": self_employed,
    "ApplicantIncome": applicant_income.astype(int),
    "CoapplicantIncome": coapplicant_income.astype(int),
    "LoanAmount": loan_amount.astype(int),
    "Loan_Amount_Term": loan_term,
    "Credit_History": credit_history,
    "Property_Area": property_area,
    "Loan_Status": loan_status
})

# inject a small % of missing values to simulate real-world data
for col in ["Gender", "Married", "Dependents", "Self_Employed", "LoanAmount", "Credit_History"]:
    mask = np.random.rand(n) < 0.03
    df.loc[mask, col] = np.nan

os.makedirs("dataset", exist_ok=True)
df.to_csv("dataset/loan_data.csv", index=False)
print(f"✅ Synthetic dataset generated: dataset/loan_data.csv ({n} rows)")
print(f"   Class distribution: {df['Loan_Status'].value_counts().to_dict()}")