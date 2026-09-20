import os
import json
import time
import warnings
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, IsolationForest
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report
)
import joblib

warnings.filterwarnings("ignore")

DATASET_VERSION = "v1.0"  # bump manually whenever the dataset file changes materially
DATASET_PATH = "dataset/loan_data.csv"
ARTIFACT_DIR = "model_artifacts"
os.makedirs(ARTIFACT_DIR, exist_ok=True)

# ============================================
# 1. DATASET — load, or generate synthetic fallback
# ============================================
if not os.path.exists(DATASET_PATH):
    print("⚠ No dataset found at dataset/loan_data.csv — generating synthetic dataset...")
    import generate_dataset  # runs and creates the file

df = pd.read_csv(DATASET_PATH)
print(f"\n📊 Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")

# ============================================
# 2. DATA CLEANING
# ============================================
before = len(df)
df = df.drop_duplicates()
print(f"🧹 Removed {before - len(df)} duplicate rows")

print("\n🔍 Missing values before handling:")
print(df.isnull().sum()[df.isnull().sum() > 0])

# ============================================
# 3. MISSING VALUE HANDLING
# ============================================
categorical_cols = ["Gender", "Married", "Dependents", "Education", "Self_Employed", "Property_Area"]
numeric_cols = ["ApplicantIncome", "CoapplicantIncome", "LoanAmount", "Loan_Amount_Term", "Credit_History"]

for col in categorical_cols:
    df[col] = df[col].fillna(df[col].mode()[0])
for col in numeric_cols:
    df[col] = df[col].fillna(df[col].median())

print("\n✅ Missing values handled (categorical → mode, numeric → median)")

# ============================================
# 4. OUTLIER CHECK (IQR method, report only — capped rather than dropped)
# ============================================
for col in ["ApplicantIncome", "LoanAmount"]:
    q1, q3 = df[col].quantile([0.25, 0.75])
    iqr = q3 - q1
    upper = q3 + 1.5 * iqr
    outliers = (df[col] > upper).sum()
    df[col] = np.where(df[col] > upper, upper, df[col])  # cap, don't drop (preserves sample size)
    print(f"📈 {col}: capped {outliers} outlier(s) above {upper:.0f}")

# ============================================
# 5. EXPLORATORY DATA ANALYSIS (printed summary)
# ============================================
print("\n📊 Class Distribution (Loan_Status):")
print(df["Loan_Status"].value_counts())
print(f"    Balance ratio: {(df['Loan_Status'].value_counts(normalize=True) * 100).round(1).to_dict()}")

print("\n📊 Numeric feature summary:")
print(df[numeric_cols].describe().round(1))

# ============================================
# 6. FEATURE ENGINEERING
# ============================================
df["TotalIncome"] = df["ApplicantIncome"] + df["CoapplicantIncome"]
df["LoanToIncomeRatio"] = (df["LoanAmount"] * 1000) / (df["TotalIncome"] + 1)
numeric_cols += ["TotalIncome", "LoanToIncomeRatio"]

print(f"\n🛠 Engineered features added: TotalIncome, LoanToIncomeRatio")

# Encode target
df["target"] = (df["Loan_Status"] == "Y").astype(int)

FEATURE_COLUMNS = categorical_cols + numeric_cols
X = df[FEATURE_COLUMNS]
y = df["target"]

# ============================================
# 7. TRAIN/TEST SPLIT
# ============================================
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"\n✂️ Train/Test split: {len(X_train)} train / {len(X_test)} test")

# ============================================
# 8. ENCODING + SCALING (via ColumnTransformer, bundled into each pipeline)
# ============================================
preprocessor = ColumnTransformer(transformers=[
    ("cat", Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore"))
    ]), categorical_cols),
    ("num", Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ]), numeric_cols)
])

# ============================================
# 9. MODEL TRAINING — 4 candidate algorithms
# ============================================
candidate_models = {
    "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
    "Decision Tree": DecisionTreeClassifier(max_depth=6, random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42),
    "Gradient Boosting": GradientBoostingClassifier(n_estimators=150, max_depth=3, random_state=42)
}

results = {}
trained_pipelines = {}
training_times = {}

print("\n🤖 Training and evaluating models...\n")

for name, clf in candidate_models.items():
    pipeline = Pipeline([("preprocessor", preprocessor), ("classifier", clf)])
    start_time = time.time()
    pipeline.fit(X_train, y_train)
    training_times[name] = round(time.time() - start_time, 3)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred).tolist()

    results[name] = {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(auc, 4),
        "confusion_matrix": cm,  # [[TN, FP], [FN, TP]]
        "training_time_seconds": training_times[name]
    }
    trained_pipelines[name] = pipeline

    print(f"── {name} ──────────────────────────────")
    print(f"    Accuracy : {acc:.4f}    Precision: {prec:.4f}")
    print(f"    Recall   : {rec:.4f}    F1-Score : {f1:.4f}")
    print(f"    ROC-AUC  : {auc:.4f}")
    print(f"    Training Time: {training_times[name]}s")
    print(f"    Confusion Matrix (rows=actual, cols=predicted): {cm}")
    print()

# ============================================
# ISOLATION FOREST — statistical anomaly detection
# Trained on a small set of financial features to flag applications
# whose profile falls outside the typical range seen during training.
# This is a SEPARATE system from the eligibility classifier.
# ============================================
anomaly_features = df[["ApplicantIncome", "CoapplicantIncome", "LoanAmount", "Loan_Amount_Term"]].copy()
iso_forest = IsolationForest(contamination=0.05, random_state=42)
iso_forest.fit(anomaly_features)
print(f"\n🚨 Isolation Forest trained on {len(anomaly_features)} rows (5% contamination assumption)")

# ============================================
# 10. MODEL SELECTION
# Selection metric: F1-score (balances precision/recall — appropriate
# given the dataset's class distribution isn't perfectly balanced;
# ROC-AUC used as a tiebreaker).
# ============================================
best_model_name = max(results, key=lambda k: (results[k]["f1_score"], results[k]["roc_auc"]))
best_pipeline = trained_pipelines[best_model_name]
best_metrics = results[best_model_name]

MODEL_ABBREVIATIONS = {
    "Logistic Regression": "LR",
    "Decision Tree": "DT",
    "Random Forest": "RF",
    "Gradient Boosting": "GB"
}
model_abbr = MODEL_ABBREVIATIONS.get(best_model_name, "MODEL")
model_version = f"{model_abbr}-v1.1"
FEATURE_VERSION = "v1.2"  # bump this whenever FEATURE_COLUMNS or engineering changes

print(f"\n🏆 Selected model: {best_model_name} (highest F1-score, tiebreak by ROC-AUC)")
print(f"    Rationale: F1-score balances false eligible/ineligible predictions,")
print(f"    which matters more than raw accuracy given the class distribution above.")

# Global feature importance (only available for tree-based models)
feature_importance = None
if hasattr(best_pipeline.named_steps["classifier"], "feature_importances_"):
    ohe_features = best_pipeline.named_steps["preprocessor"].named_transformers_["cat"].named_steps["onehot"].get_feature_names_out(categorical_cols)
    all_feature_names = list(ohe_features) + numeric_cols
    importances = best_pipeline.named_steps["classifier"].feature_importances_
    feature_importance = sorted(
        [{"feature": f, "importance": round(float(i), 4)} for f, i in zip(all_feature_names, importances)],
        key=lambda x: -x["importance"]
    )[:8]

# ============================================
# FAIRNESS ANALYSIS — performance across dataset groups
# Measures differences only; makes no unsupported claims.
# ============================================
def group_fairness(y_true, y_pred, group_series, group_name):
    groups = {}
    for group_val in group_series.unique():
        mask = (group_series == group_val).values
        if mask.sum() < 5:  # skip groups too small to be meaningful
            continue
        g_acc = accuracy_score(y_true[mask], y_pred[mask])
        g_rec = recall_score(y_true[mask], y_pred[mask], zero_division=0)
        groups[str(group_val)] = {"accuracy": round(g_acc, 4), "recall": round(g_rec, 4), "n": int(mask.sum())}
    accs = [v["accuracy"] for v in groups.values()]
    recs = [v["recall"] for v in groups.values()]
    return {
        "attribute": group_name,
        "groups": groups,
        "accuracy_gap": round(max(accs) - min(accs), 4) if len(accs) > 1 else 0,
        "recall_gap": round(max(recs) - min(recs), 4) if len(recs) > 1 else 0
    }

best_y_pred = best_pipeline.predict(X_test)
fairness_report = [
    group_fairness(y_test, best_y_pred, X_test["Gender"], "Gender"),
    group_fairness(y_test, best_y_pred, X_test["Education"], "Education")
]

# ============================================
# DATASET STATS — for Dataset Management dashboard
# ============================================
dataset_stats = {
    "dataset_version": DATASET_VERSION,
    "total_records": len(df),
    "feature_count": len(FEATURE_COLUMNS),
    "training_records": len(X_train),
    "testing_records": len(X_test),
    "missing_values_handled": int(df.isnull().sum().sum()),  # post-cleaning, should be ~0
    "class_distribution": df["Loan_Status"].value_counts().to_dict(),
    "income_distribution": {
        "min": float(df["ApplicantIncome"].min()), "max": float(df["ApplicantIncome"].max()),
        "mean": float(df["ApplicantIncome"].mean()), "median": float(df["ApplicantIncome"].median())
    },
    "loan_distribution": {
        "min": float(df["LoanAmount"].min()), "max": float(df["LoanAmount"].max()),
        "mean": float(df["LoanAmount"].mean()), "median": float(df["LoanAmount"].median())
    },
    "credit_history_distribution": df["Credit_History"].value_counts().to_dict(),
    "education_distribution": df["Education"].value_counts().to_dict(),
    "employment_distribution": df["Self_Employed"].value_counts().to_dict()
}

# ============================================
# 11. SERIALIZATION
# ============================================
joblib.dump(best_pipeline, os.path.join(ARTIFACT_DIR, "model.pkl"))
joblib.dump(iso_forest, os.path.join(ARTIFACT_DIR, "iso_forest.pkl"))
print(f"✅ Saved model.pkl and iso_forest.pkl to {ARTIFACT_DIR}/")

metrics_report = {
    "selected_model": best_model_name,
    "model_version": model_version,
    "feature_version": FEATURE_VERSION,
    "feature_columns": FEATURE_COLUMNS,
    "selection_metric": "F1-score (tiebreak: ROC-AUC)",
    "trained_on_rows": len(df),
    "train_test_split": {"train": len(X_train), "test": len(X_test)},
    "class_distribution": df["Loan_Status"].value_counts().to_dict(),
    "all_models": results,
    "selected_model_metrics": best_metrics,
    "feature_importance_global": feature_importance,
    "dataset_version": DATASET_VERSION,
    "fairness": fairness_report,
    "dataset_stats": dataset_stats,
    "trained_at": pd.Timestamp.now().isoformat(),
    "note": "Model probability is the classifier's predict_proba output. It has NOT been "
            "calibrated (e.g. via Platt scaling / isotonic regression), so it should be "
            "treated as a relative confidence indicator rather than a statistically "
            "calibrated probability."
}

with open(os.path.join(ARTIFACT_DIR, "metrics.json"), "w") as f:
    json.dump(metrics_report, f, indent=2)

print(f"✅ Saved metrics.json to {ARTIFACT_DIR}/")
print("✅ Training complete.")