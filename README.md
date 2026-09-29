# NKPI 7.9.1 — Clear score bands

The **Clinical interpretation** section has been removed. The existing gradient now has a prominent **Lower NKPI**, **Intermediate NKPI** or **Higher NKPI** label above it.

| Displayed whole-number NKPI | Descriptive band |
|---|---|
| 0–32 | Lower NKPI |
| 33–66 | Intermediate NKPI |
| 67–100 | Higher NKPI |

These approximate thirds are presentation choices, not cutoffs fitted to clinical outcomes. Bands follow the displayed integer so the label agrees with the number clinicians see; the unrounded score is unchanged. They do not classify mild/moderate/advanced disease or progression. The frozen model endpoint remains source-recorded CXL-associated status, and its longitudinal coefficient amendment has not been revalidated. The observed biological domains below remain separate.

Open [the score-band preview](docs/SCORE_BAND_PREVIEW.html) to inspect fictional examples. The v7.9 extraction and observed-first outlook changes below are preserved.


The **Progression summary · Both eyes** dropdown now puts the **observed domain count over the actual scan interval first**, followed by the six-month research scenario. Numeric uncertainty ranges and model assumptions sit inside **Assumptions & uncertainty**; an unresolved two-domain threshold remains clearly labelled in the compact view.

Routine yellow result notices have become a closed, neutral **Model notes** disclosure. Blocking errors and held results still need resolution. The score, thresholds, projection equations, numeric exports and uncertainty ranges are unchanged.

Extraction is quieter and faster to review:

- Resolved fields show their status and a small **View source** disclosure, without yellow boxes.
- Unresolved fields show distinct candidate-value buttons above the source crop. Selecting a printed value confirms it in one action when no mathematical inconsistency remains. Manual typing still needs confirmation.
- Printed precision is preserved: 7.70 and 7.71 remain separate choices.
- A second local OCR model rereads unresolved, label-bound numbers. It can accept matching readings only with primary-reader support and the existing mathematical and cross-report checks. Other disagreements stay available for source review.

No API key is required. Images remain in the browser. The added reader uses different Tesseract LSTM weights, **not an independent clinical source or a cloud language model**. Both readers can make the same mistake. No near-perfect extraction rate is claimed; representative report validation is still needed. See [second reader details](docs/SECOND_READER.md).

Open [the synthetic preview](docs/OUTLOOK_PREVIEW.html) after extraction to inspect the production progression renderer. Its measurements are fictional; the projections are computed by the shipped research code.

## What stays the same

The existing automatic consistency checks, bilateral import and frozen **3.1.0-interval-half NKPI model**, model score and observed biological thresholds are preserved. The model's existing limitations remain. Age does not automatically slow the new projected trend. A high NKPI score does not add domain crossings.

The existing PDF remains an NKPI report. The audited JSON now includes a separately labelled `projection` object with the model hash, input hash, assumptions, counts, ranges and projected values. Raw patient data are not included in the GitHub package; only aggregate fitted parameters are shipped.

## Install or update

1. Extract **NKPI_v791_Extract.zip**.
2. Upload its **contents** to the repository root, replacing matching files and preserving folders. Do not upload the ZIP itself.
3. Use `kcn_dual_calculator_app.py` as the Streamlit main file. Include the updated `requirements.txt`, both `models/` and `research/`, and all `components/` files. Include the new `components/extractor/ocr_second/eng.traineddata` file (15.4 MB) and `second_reader.js`.
4. Reboot Streamlit and refresh the page. Confirm **7.9.1-score-bands** in the footer.
5. Import and calculate as before, then open **Progression summary · Both eyes** below NKPI.

Unused historical viewer assets and their tests were removed from this distribution to keep it under 100 files. The shared map and numerical-schema helpers used by the importer remain. Old unused files may remain in an existing repository; the calculator does not load those viewers.

## Eligibility and uncertainty

Two complete, verified, same-eye visits are required. Explicit poor scan quality, prior/interval treatment, unsupported age, measurements outside the fitted range, or physically implausible simulated values withhold the projection with a specific reason. Valid observed domains remain visible independently.

When treatment history or scan quality is unknown, the expanded assumptions describe an **assumed untreated/comparable-scan scenario**; those facts are not marked as confirmed. Histories shorter than 90 days have an extrapolation note there. No new mandatory per-measurement verification is added.

The range combines central 90% simulation ranges across assumed noise scenarios. It is **not** an empirically calibrated confidence interval, individual progression probability, or a treatment recommendation. The full assumptions are expandable inside each card.

## Observed-domain rules — unchanged

| Domain | Strict crossing threshold |
|---|---|
| Anterior curvature | ARC decrease >0.106 mm **or** Kmax increase >1.0 D |
| Posterior curvature | PRC decrease >0.085 mm |
| Pachymetric | Thinnest thickness decrease >2% of reference **or** ARTmax decrease >44.24 |
| Composite deviation | BAD-D increase >0.42 |

Each domain counts once. Equality does not cross. The observed calculation uses the earlier visit as reference; the projection uses the latest visit. Two domains meet the numerical SOURCE research criterion, subject to its comparison requirements; neither count diagnoses progression. The structural 0–3 sensitivity check continues to exclude overlapping BAD-D. SOURCE eligibility requires a pretreatment comparison at least six calendar months apart; the 183-day forecasting approximation does not change that eligibility rule.

## Run and test

```bash
pip install -r requirements.txt
streamlit run kcn_dual_calculator_app.py
python tools/verify_package.py
python tests/test_projection.py
node tests/test_progression_summary.cjs
python tests/test_model_interval.py
node tests/test_extraction_integrity.cjs
node tests/test_second_reader.cjs
node tests/test_score_band.cjs
node tests/test_bilateral_import.cjs
node tests/test_bilateral_review.cjs
```

Projection-fitting tests additionally require pandas. Historical domain-training tests require pandas and scikit-learn. Deployment never trains on patient inputs. See [the engineering test report](docs/TEST_REPORT.md) and [the earlier probability-model results](docs/DOMAIN_TRAINING_REPORT.md). Earlier probability candidates remain withheld; the new conditional trend calculation does not overturn their failed performance checks.
