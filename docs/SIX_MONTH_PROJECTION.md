# Display update in 7.9

Observed domain crossings over the actual interval appear first. The unchanged latest-scan-to-183-day scenario appears below. Numeric ranges, noise scenarios and eligibility assumptions are in the closed **Assumptions & uncertainty** disclosure. The compact card explicitly states when uncertainty cannot resolve the two-domain threshold. No count, range, model parameter, threshold or eligibility rule was changed for this layout update.

# Six-month conditional projection — method 1.0.0

## Purpose and displayed result

This exploratory mode answers: **If the recent process continues under the stated assumptions, how many of the four SOURCE domains would cross their thresholds over the next approximately six months?** The reference is the **latest measured scan**, and the horizon is 183 days. The target is a future **measured** comparison, including scan error; it is not a direct measurement of biological change.

The headline is the domain count obtained from the central projected measurement vector. It is not an average of counts, a probability, an NKPI transformation or a diagnosis. The range is the envelope of the central 90% simulated count ranges across four noise settings, enlarged to include their central counts. It may legitimately span all 0–4 domains. A range spanning two domains triggers “Sensitive to scan variability.” A narrow range is conditional on this model and does not prove clinical stability or progression.

## Data and what was fitted

The source workbook SHA-256 is `60bd4895f669fa55bd4e7e37266c66a52497f250847869185dfa1424bfa882be`. It contains 425 numeric eye records in the historical 426-eye inventory. Existing cleaning yields 262 complete dated pairs; 195 have baseline age 18–50. The 90-day–5-year subset contains **179 eyes from 101 patients**. All six measurements are required at both visits. The reconstruction code, exclusions and the earlier cohort audit remain in `research/` and `docs/DOMAIN_TRAINING_REPORT.md`.

This release fits the **joint mean and covariance of between-visit slopes**, separately under each fixed scan-noise scenario. Each patient has total fitting weight one, shared by their eligible eyes. It does not fit a future-event classifier. The selected retrospective CXL/control sample is not a representative untreated natural-history sample; its trend distribution can be biased by selection and treatment decisions. Existing extraction/reconstruction and treatment timing must be independently audited before a clinical study. No new individual patient rows are distributed.

There are only first and final measurement sets. No third scan exists to validate a forecast made after the second scan. The earlier first-scan probability models performed weakly, and remain excluded from patient probability calculation. Using a new mathematical formulation does not establish better clinical predictive performance.

## Coordinates

Let `x` be a six-dimensional vector, ordered A, B, C, Kmax, BAD-D, ARTmax. Use worsening-positive threshold units:

```
x = [-A/0.106, -B/0.085, -log(C)/(-log(0.98)),
     Kmax/1.0, BAD_D/0.42, -ARTmax/44.24]
```

A one-unit increase crosses the corresponding component cutoff, with strict greater-than comparison. Log thickness keeps positivity and makes a 2% relative decrease exactly one unit. The inverse-transformed central thickness is the central value on the log scale (a median under the assumed lognormal distribution), not the arithmetic mean thickness. No numerical value is rounded before evaluating a central domain threshold.

## Measurement-error model

For each eye with interval `t` in years:

```
b ~ Normal(mu, V)
d = x_latest - x_first = t*b + e1 - e0
e0, e1, e2 ~ independent across visits Normal(0, R)
z = x_future - x_latest = h*b + e2 - e1
h = 183 / 365.2425
```

The fitted cohort parameters are `mu` and `V`. `R` is assumed; two scans do not identify individual true change and measurement noise. EM estimates `mu,V` from the weighted marginal likelihood of `d`, whose covariance is `t²V + 2R`. The code maintains positive covariance matrices and checks convergence. Its 1e-7 eigenvalue floor is a numerical safeguard, not a clinical parameter. Each eye’s posterior update uses its actual interval.

Conditioning on the observed change gives:

```
S = t²V + 2R
C = h*t*V - R
E[z | d] = h*mu + C*S^-1*(d - t*mu)
Var[z | d] = h²V + 2R - C*S^-1*C'
```

The **minus R** term is essential: the latest scan's measurement error contributes positively to the observed past change and negatively to the future comparison. Treating these errors as independent would miss regression to the mean. With zero scan noise, the conditional mean reduces to ordinary straight-line extrapolation `h*d/t`. With uncertain short histories, cohort information has more influence. No arbitrary fixed “half the trend” factor is used. Since the same coefficient matrix includes correlations, individual components can shift in either direction rather than all simply shrinking toward zero.

Age restricts the scope to baseline ages 18–50; it is not a fitted predictor of the slope distribution. No automatic age-related slowing or CXL benefit is invented. The model assumes a constant latent slope over the history and future horizon; nonlinear progression, lens effects, remodeling and treatment changes are not modelled.

## Four explicit noise assumptions

The SOURCE cutoffs are **not** treated as measured Pentacam repeatability. They provide a convenient unit for a sensitivity analysis only.

| Scenario | Assumed 95% single-pair error limit, in component-threshold units | Within-scan correlation |
|---|---:|---:|
| Lower | 0.5 | 0 |
| Central | 1.0 | 0 |
| Higher | 2.0 | 0 |
| Shared error | 1.0 | 0.5 for every component pair in worsening coordinates |

For a factor `f`, per-scan SD is `f / (1.96*sqrt(2))` in the transformed coordinates. The shared-error case has covariance `(SD²)*[(1-rho)I + rho*11']`. Fitted latent slopes retain their estimated cross-variable correlation in every scenario. Independent scan errors across visits and the same error distribution at both visits are assumptions. The four settings do not cover every possible covariance structure, acquisition protocol or disease severity. They must not be cited as device specifications.

Published work motivates sensitivity to repeatability and severity; it does **not** validate these chosen noise settings:

- Wonneberger et al., *Repeated Same-Day Versus Single Tomography Measurements of Keratoconic Eyes for Analysis of Disease Progression* (2018), https://pubmed.ncbi.nlm.nih.gov/29319597/
- Ortiz-Toquero et al., *Influence of Keratoconus Severity on Detecting True Progression with Scheimpflug Imaging and Anterior Segment Optical Coherence Tomography* (2023), https://pubmed.ncbi.nlm.nih.gov/37511849/

The next substantive improvement requires same-device repeat scans to estimate noise covariance and severity effects, rather than choosing values merely to achieve desirable domain counts.

## Simulation and domain calculation

Each scenario uses 16,384 fixed antithetic Gaussian draws from the conditional future-change distribution. Common draws make recalculation deterministic and reduce Monte Carlo flicker. Each draw contributes no more than one point per domain: anterior is A OR Kmax, pachymetric is C OR ARTmax, posterior is B, and composite is BAD-D. Correlated variables are never counted as six independent domain votes. BAD-D overlaps the structural measurements; the existing observed structural 0–3 check is retained.

The 5th and 95th count quantiles are combined across scenarios. Fitted cohort-parameter uncertainty, changes in future slope, observation selection and unmodelled clinical effects are **not included**. The stated 90% simulation coverage is a model-internal calculation, not empirically verified patient coverage. We therefore display a range, not a “90% confidence interval” or an individual probability.

No negative/implausible simulated value is clipped or redrawn. Broad measurement envelopes detect model breakdown (A 2.5–12.5 mm; B 1.5–12.5 mm; C 150–900 µm; Kmax 20–120 D; BAD-D -10–60; ARTmax 1–2000). A central vector outside these envelopes, or more than 5% of draws outside any envelope in any scenario, withholds the projection. This 5% gate is an engineering guard, not a validated clinical cutoff. If at most 5% are invalid, they widen the count range conservatively by contributing 0 to its lower-bound calculation and 4 to its upper-bound calculation.

## Scope and workflow

Complete verified paired measurements, positive interval, supported age and values within the fitted measurement range are required. Intervals over five years are withheld. Shorter than 90 days is explicitly identified as extrapolation outside the fitting intervals; it is not described as validated short-term prediction. Unknown treatment or scan quality produces a conditional scenario with the unconfirmed assumptions visible. Explicit prior/interval corneal treatment or an adverse quality flag withholds the projection. Observed-domain scope remains independently assessed.

The SOURCE observation definition still requires at least six **calendar months** and its full eligibility criteria. The forecast's fixed 183-day approximation does not make a short observed comparison eligible. Latest is the new reference for projected changes; previous crossings are not carried forward, and projected domains may differ from those crossed earlier.

The backend generates projections from the same canonical result used by NKPI. Eye identity, input hash, artifact hash, interval and reference are audited; the browser independently checks projected values against domain flags before displaying them. Edits, source changes, stale asynchronous responses and patient reset cannot retain a previous projection. JSON keeps a separate `projection` object, labelled research-only. The PDF remains the existing NKPI report.

## Reproduce and validate next

The fitted distribution is reproducible from the private paired CSV:

```
python research/fit_conditional_projection.py /private/private_paired.csv research/projection_model.json
```

Training requires NumPy and pandas. The app only needs NumPy to load the aggregate parameters and calculate the conditional distribution. It never retrains on an entered case.

Engineering checks test the formula against a separately simulated three-scan process, recover known synthetic correlated slopes, verify covariance positivity, exercise strict thresholds and OR rules, and test bilateral snapshot binding. These checks establish that the implementation calculates the specified model; they do **not** establish clinical forecast accuracy. A study with third visits should lock the model first, split by patient, compare against persistence and raw extrapolation, and evaluate measurement error, domain-count error and range coverage, including short intervals, severity strata and independently analysed treatment groups.
