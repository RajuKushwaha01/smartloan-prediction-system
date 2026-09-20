# Dataset

This project is designed around the classic **Loan Prediction** schema
(the same schema used in the well-known Kaggle "Loan Prediction" dataset):

| Column             | Description                                  |
|--------------------|-----------------------------------------------|
| Gender             | Male / Female                                 |
| Married            | Yes / No                                      |
| Dependents         | 0 / 1 / 2 / 3+                                |
| Education          | Graduate / Not Graduate                       |
| Self_Employed      | Yes / No                                      |
| ApplicantIncome    | Monthly income of applicant                   |
| CoapplicantIncome  | Monthly income of co-applicant                |
| LoanAmount         | Loan amount (in thousands ₹)                  |
| Loan_Amount_Term   | Loan term in months                           |
| Credit_History     | 1.0 = good, 0.5 = average, 0.0 = poor         |
| Property_Area      | Urban / Semiurban / Rural                     |
| Loan_Status        | Y / N (target — used only for training)       |

## To use a real dataset
Place a CSV file named `loan_data.csv` in this folder with the columns above.

## No dataset available?
Run `python generate_dataset.py` from the `ml/` folder — it creates a
realistic **synthetic** `loan_data.csv` here automatically, so the project
works end-to-end even without downloading anything externally.