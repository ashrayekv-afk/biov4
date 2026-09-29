# Research methods in 7.8

The active conditional projection uses `projection_model.json` and `fit_conditional_projection.py`. It fits a joint slope distribution under explicit noise assumptions; it does not produce calibrated probabilities. See `../docs/SIX_MONTH_PROJECTION.md` for the current specification.

The following retained materials describe the earlier probability candidates, which remain inactive.

# Research-only forecasting analyses

No code or coefficient artifact in this folder is imported by the Streamlit application.

## Reproduce the domain model development

Use Python 3.12 with numpy, pandas, scipy, scikit-learn and openpyxl. Development used scikit-learn 1.8.0 and scipy 1.17.0. These are research dependencies, not added website requirements.

From the repository root, in an approved private environment:

```bash
python research/reconstruct_source.py --source /private/source.xlsx --out /private/nkpi_records
python research/train_domain_outlook.py --paired /private/nkpi_records/private_paired.csv --out /private/domain_results --private-out /private/domain_oof
```

The source parser verifies the workbook SHA-256. Keep the workbook, intermediate tables and out-of-fold rows private. The public outputs contain only coefficients and aggregates. The source is the user-supplied `Data Extraction- KCN Project_8748(2).xlsx`.

`protocol.json` was saved before fitting. The first-scan models predict the recorded later numerical domain endpoint, with elapsed time as a predictor. They do not use later values, deltas, NKPI, the CXL-group label, or the opposite eye as predictors. `domain_training/` contains the two fitted artifacts and all grouped validation results. Neither demonstrated a reliable six-month forecast. See `../docs/DOMAIN_TRAINING_REPORT.md`.

## Historical measurement-rate experiment

`evaluate_trajectory.py` and `trajectory_feasibility.json` preserve an earlier research experiment. It did not consistently outperform unchanged measurements. The former trajectory display is retired and is not mounted in this release.
