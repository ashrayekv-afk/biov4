# Update to 7.9.1-score-bands

1. Download **NKPI_v791_Extract.zip** completely, then use Windows **Extract All**.
2. Upload the extracted contents to the GitHub repository root, replacing matching files and preserving folders. Do not upload the ZIP itself.
3. Include the new `components/score_band.js` alongside the updated `app.js`, `app.css` and `index.html`. Include all extraction files from 7.9, particularly `components/extractor/second_reader.js` and `components/extractor/ocr_second/eng.traineddata` (15.4 MB). The bundled model needs no API key. Keep both `models/` and `research/`.
4. Keep `kcn_dual_calculator_app.py` as the Streamlit main file. Reboot Streamlit, refresh the page, and confirm **7.9.1-score-bands** in the footer.
5. Reimport your reports. Previously resolved session values do not automatically gain a second-reader check. Open **Progression summary · Both eyes** below NKPI to see observed results first and the six-month scenario underneath.

The archive uses standard uncompressed ZIP entries for Windows compatibility. It contains no patient data. Its larger size is due to the bundled second OCR model.

The second reader runs only for unresolved, label-bound fields and can add processing time. A model-loading failure preserves source review. Strong conflicts, unbound labels and mathematical inconsistencies are not silently approved. The additional reader is an engineering check, not clinical validation.

If the old layout remains, check the deployed repository, branch, entry point and footer version. `docs/OUTLOOK_PREVIEW.html` is a standalone synthetic layout preview, not the application entry point.

The Clinical interpretation block is removed. Lower / Intermediate / Higher NKPI above the gradient are descriptive display categories, not validated progression stages. Calculations and extraction are unchanged.
