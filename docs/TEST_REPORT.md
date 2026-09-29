# Release 7.9.1 engineering verification

- Score-band tests pass at every rounded boundary, endpoints, missing/nonfinite/out-of-range values. Invalid scores have no category.
- Actual parent-app test with Python service responses: Clinical interpretation is absent, both valid eyes receive bands, the score-band script loads first, neutral Model notes remain closed, and reset clears both bands. Existing observed-domain and projection snapshot/edit checks pass.
- Headless Chromium score preview passes at 1200, 760 and 390 px: labels above each gradient, two expected categories, no horizontal overflow or runtime errors. Desktop/mobile screenshots inspected.
- All extractor files, frozen NKPI artifacts, assessment engine, observed-domain renderer and projection engine/artifacts are byte-identical to 7.9. This is a presentation update; no retraining or clinical validation was performed.
- Standard ZIP CRC, Python/unzip extraction and extracted-file byte comparisons pass. The release stays below 100 files.

The approximate-third display cutoffs are chosen for readability and have not been tested for sensitivity, specificity or clinical utility. The categories must not be interpreted as mild/moderate/advanced progression, treatment recommendations, or probabilities.

---

# Release 7.9 engineering verification

These are implementation checks, not clinical accuracy or forecast validation.

## Passed for this release

- Eight projection unit tests and frozen half-interval model tests. All three NKPI artifacts, assessment implementation, projection implementation and fitted projection artifacts are byte-identical to 7.8.
- Parent-app tests with actual Python results: observed-before-projected order, closed numeric uncertainty, neutral closed Model notes, unchanged strict thresholds, two-eye calculation, source invalidation, editing/reset and stale response rejection.
- Extraction-integrity, automatic merge, map-identification, bilateral discovery and bilateral review regressions. The 236/296 ARTmax conflict still blocks calculation until resolved; both eyes retain all available inputs.
- New second-reader tests: literal decimal consensus, no unsupported guess or decimal invention, strong conflicts retained, label binding, one-source accounting, independent report and ARTmax math vetoes, model hashes, worker reuse/reset and initialization-failure fallback.
- Compact source review tests: distinct 7.71 / 7.70 / 7.00 buttons, buttons above crop, explicit candidate choice, resolved-panel collapse, review persistence and re-opening after edits.
- Actual Chromium OCR exercise with pinned Tesseract.js/core 7.0.0 and bundled weights. A labelled synthetic PRC 5.19 crop produced matching secondary readings and passed consensus. Synthetic red BAD-D 7.71 and ARTmax 296 crops did not reach acceptance; manual review was preserved. This three-crop compatibility/fallback exercise does not measure clinical accuracy or review reduction. It exposed a float-model relaxed-SIMD abort; the secondary worker now uses the tested portable LSTM core.
- Chromium layout tests at 1200, 760 and 390 px: two calculated cards, observed results first, numeric ranges initially hidden, working disclosures and no horizontal overflow. Desktop/mobile screenshots inspected.
- Actual extractor browser interaction: compact source review, no yellow field panel, source image available after confirmation, candidate button confirms, edit invalidates. No page runtime errors.
- Streamlit 1.50 AppTest startup: no exceptions or error elements.
- Release manifest plus ZIP CRC/extraction verification with Python and unzip; extracted bytes compared with the release tree.

## Remaining limits

No original report ZIP was available in this update for an end-to-end clinical extraction benchmark. The second model is another Tesseract LSTM weight set, not independent clinical evidence. No claim of perfect extraction, 6/6 yield or a measured decrease in review burden is made. Ambiguous readings remain manual. Six-month counts are still conditional research scenarios, not validated progression probabilities.

---

# Historical verification carried forward from 7.8

# Release 7.8 engineering verification

These checks verify implementation and workflow. They do not establish clinical accuracy, probability calibration or future range coverage.

## Passed

- Eight projection tests: zero-noise recovery of raw extrapolation; conditional covariance checked against an independent 180,000-case three-scan simulation; recovery of known correlated slopes on synthetic data; positive covariance and short-interval uncertainty; all strict component boundaries and OR rules; deterministic bilateral output and latest-scan reference; held/unknown/missing input behavior; and artifact checksum rejection.
- Actual parent-app event handlers tested against real Python responses: both-eye calculation, per-eye edits, source invalidation, stale response rejection, patient reset, projection checksum/snapshot checks and independent projected-value/domain checks.
- Existing exact observed-domain thresholds, structural sensitivity, study scope, disabled/single/missing eyes and overlapping domain votes.
- Original model interval tests: frozen 50% interval amendment and score/impact audit unchanged.
- Original extraction-integrity, bilateral import, bilateral review, automatic merge and map-identification tests.
- Historical domain-training tests: endpoint boundaries, patient grouping, no follow-up predictor leakage and retained research-only probability artifacts.
- Headless Chromium preview checks at 1200, 760 and 390 pixels: two calculated cards, no horizontal overflow and working calculation disclosures. Desktop and mobile screenshots visually inspected.
- Streamlit 1.50 AppTest startup: no exception or error elements.
- All 19 extractor files and all three frozen NKPI artifact files are byte-identical to 7.7. The NKPI assessment implementation is byte-identical. PDF calculations are unchanged; only its interface version label is updated to 7.8.0.

## Full-cohort runtime exercise

179 previously eligible paired comparisons were passed through the new service without numerical exceptions. They were used for fitting; this is **not a held-out accuracy test**. Treatment and quality were explicitly set to the assumed eligible scenario for this engineering exercise, not inferred as clinical facts.

- 170 produced conditional counts and ranges.
- 9 withheld a projection because at least one assumed-noise scenario produced unsupported measurement values.
- Every output retained the correct snapshot hash.
- Many ranges crossed the two-domain threshold or spanned 0–4; they were not narrowed to make the display appear more decisive.

## Clinical limits

No new OCR clinical accuracy study was performed. No third visits exist in the provided cohort to test two-visit forecasts. Noise settings, the physical-envelope guard and constant-slope assumption have not been clinically validated. The selected cohort is not a representative natural-history sample. Fitting the slope distribution is not validation of individual projections.

