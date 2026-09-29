"""Conditional six-month research projection, separate from frozen NKPI.

Two visits cannot identify measurement error. Noise below is an explicit
sensitivity assumption, NOT measured Pentacam repeatability. No risk percentage
is produced. See docs/SIX_MONTH_PROJECTION.md for the full statistical contract.
"""
from __future__ import annotations

from decimal import Decimal
from functools import lru_cache
from pathlib import Path
import hashlib
import json
import math

import numpy as np

VERSION = "1.0.0-conditional-research"
HORIZON_DAYS = 183
YEAR_DAYS = 365.2425
KEYS = ("A", "B", "C", "Kmax", "BAD_D", "ARTmax")
DOMAIN_KEYS = ("anterior", "posterior", "pachymetric", "composite")
SCALES = np.array([.106, .085, -math.log(.98), 1., .42, 44.24])
DIRECTIONS = np.array([-1., -1., -1., 1., 1., -1.])
ARTIFACT = Path(__file__).resolve().parents[1] / "research/projection_model.json"


def transform(values):
    x = np.array([values[k] for k in KEYS], dtype=float)
    x[2] = math.log(x[2])
    return x * DIRECTIONS / SCALES


def inverse_transform(x):
    a = np.asarray(x) * SCALES / DIRECTIONS
    a = a.copy()
    # Invalid extremes are detected before any patient-facing count is released.
    with np.errstate(over="ignore"):
        a[..., 2] = np.exp(a[..., 2])
    return a


def domain_flags(first, latest):
    """SOURCE strict decimal thresholds; same rules as the observed JS panel."""
    a = {k: Decimal(str(first[k])) for k in KEYS}
    b = {k: Decimal(str(latest[k])) for k in KEYS}
    return [a["A"]-b["A"] > Decimal(".106") or b["Kmax"]-a["Kmax"] > 1,
            a["B"]-b["B"] > Decimal(".085"),
            100*(a["C"]-b["C"]) > 2*a["C"] or a["ARTmax"]-b["ARTmax"] > Decimal("44.24"),
            b["BAD_D"]-a["BAD_D"] > Decimal(".42")]


def draw_counts(change):
    """Changes are in worsening-positive units; log C makes 2% exactly one unit."""
    # Numerical tolerance excludes binary round-off at exact equality only.
    above = np.asarray(change) > 1. + 1e-12
    return (above[..., 0] | above[..., 3]).astype(int) + above[..., 1] + \
        (above[..., 2] | above[..., 5]).astype(int) + above[..., 4]


def noise_covariance(factor=1., correlation=0.):
    """Assumed 95% single-pair error limit = factor * each SOURCE threshold.

    This is a chosen sensitivity scale, not evidence that a SOURCE cutoff is a
    repeatability coefficient. Positive equicorrelation is an additional stress
    scenario in worsening-oriented coordinates.
    """
    sd = factor / (1.96 * math.sqrt(2))
    return sd**2 * ((1-correlation)*np.eye(6) + correlation*np.ones((6, 6)))


def conditional_change(d, t, h, mu, covariance, noise):
    """Future measured change relative to the measured latest scan.

    d = t*b + e1-e0; future = h*b + e2-e1. The -R cross covariance
    matters: latest scan error cannot be independently counted a second time.
    """
    mu, covariance, noise = map(np.asarray, (mu, covariance, noise))
    innovation = t*t*covariance + 2*noise
    cross = h*t*covariance - noise
    gain = np.linalg.solve(innovation, cross.T).T
    mean = h*mu + gain @ (d-t*mu)
    var = h*h*covariance + 2*noise - gain @ cross.T
    var = (var+var.T)/2
    eig, vec = np.linalg.eigh(var)
    if eig.min() < -1e-8:
        raise ValueError("Invalid conditional covariance")
    var = (vec * np.maximum(eig, 0)) @ vec.T
    return mean, var


@lru_cache(maxsize=1)
def artifact():
    raw = ARTIFACT.read_bytes()
    data = json.loads(raw)
    expected = ARTIFACT.with_suffix(".sha256").read_text().strip()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError("Projection artifact checksum mismatch")
    if data["version"] != VERSION or data["keys"] != list(KEYS) or data["status"] != "conditional_research_only":
        raise ValueError("Unsupported projection artifact")
    if len(data["scenarios"]) != 4:
        raise ValueError("Incomplete noise sensitivity model")
    for s in data["scenarios"]:
        mu, v = np.asarray(s["mean_slope"]), np.asarray(s["slope_covariance"])
        if mu.shape != (6,) or v.shape != (6, 6) or not np.isfinite(mu).all() or not np.isfinite(v).all():
            raise ValueError("Invalid projection parameters")
        if not np.allclose(v,v.T,atol=1e-10) or np.linalg.eigvalsh(v).min() <= 0:
            raise ValueError("Invalid projection prior covariance")
    return data, expected


def configuration():
    data, sha = artifact()
    return {"version": VERSION, "sha256": sha, "horizon_days": HORIZON_DAYS,
            "status": "conditional_research_only", "cohort": data["cohort"]}


def _normal_draws():
    # Common, antithetic draws keep the display repeatable and reduce MC noise.
    z = np.random.default_rng(260929).standard_normal((8192, 6))
    return np.concatenate([z, -z])


@lru_cache(maxsize=1)
def normal_draws():
    return _normal_draws()


def project(assessment, input_sha256):
    """Only canonical, verified same-eye assessments enter this function."""
    c = assessment["case"]
    cfg = configuration()
    out = {"version": VERSION, "model_sha256": cfg["sha256"], "input_sha256": input_sha256,
           "eye": c["eye"], "horizon_days": HORIZON_DAYS, "reference": "latest",
           "status": "unavailable", "reason": "", "research_only": True,
           "method": "joint_empirical_bayes_conditional_projection", "warnings": []}
    def hold(reason):
        return {**out, "reason": reason}
    if c["mode"] != "longitudinal":
        return hold("Two verified visits are needed to project a trend.")
    if c["treatment"] == "treated":
        return hold("A continuation projection is not provided after, or across, CXL or other corneal treatment.")
    if assessment["status"] != "ready" or assessment["errors"] or assessment["holds"] or not c["verified"]:
        return hold("Resolve source or scan-quality concerns before projecting change.")
    if not 18 <= c["age"] <= 50:
        return hold("The projection cohort covers baseline ages 18–50.")
    if not 1 <= c["interval_days"] <= math.floor(5*YEAR_DAYS):
        return hold("The selected interval exceeds the five-year fitting window.")
    data, _ = artifact()
    # Do not present model-based numbers far outside the fitted measurement range.
    outside = [k for k in KEYS if any(not data["measurement_bounds"][k][0] <= c[v][k] <= data["measurement_bounds"][k][1] for v in ("first", "latest"))]
    if outside:
        return hold("Outside the fitted measurement range: " + ", ".join(outside) + ". Observed domains remain available.")
    if c["treatment"] != "untreated":
        out["warnings"].append("Treatment history is unknown. This scenario assumes no prior or interval corneal treatment.")
    if any(c["scan_quality"][v] != "ok" for v in ("first", "latest")):
        out["warnings"].append("Scan quality is unconfirmed. This scenario assumes comparable acceptable scans.")
    if c["interval_days"] < 90:
        out["warnings"].append("Short history: the fitting cohort starts at 90 days. This projection extrapolates beyond its interval range.")
    t, h = c["interval_days"] / YEAR_DAYS, HORIZON_DAYS / YEAR_DAYS
    d = transform(c["latest"]) - transform(c["first"])
    latest_x = transform(c["latest"])
    results = []
    # Wide physical envelopes detect breakdown of the Gaussian projection;
    # samples are never clipped, discarded or redrawn to create a prettier range.
    lows = np.array([2.5, 1.5, 150, 20, -10, 1])
    highs = np.array([12.5, 12.5, 900, 120, 60, 2000])
    for s in data["scenarios"]:
        mean, var = conditional_change(d, t, h, s["mean_slope"], s["slope_covariance"],
                                       noise_covariance(s["noise_factor"], s["noise_correlation"]))
        predicted = inverse_transform(latest_x + mean)
        sample = mean + normal_draws() @ np.linalg.cholesky(var + 1e-14*np.eye(6)).T
        raw = inverse_transform(latest_x + sample)
        invalid = (~np.isfinite(raw).all(axis=1) | (raw<lows).any(axis=1) | (raw>highs).any(axis=1))
        if not np.isfinite(predicted).all() or (predicted<lows).any() or (predicted>highs).any() or invalid.mean() > .05:
            return hold("The projection produces too many values outside the measurement envelope. A numerical outlook is not supported for this comparison.")
        flags = domain_flags(c["latest"], dict(zip(KEYS, predicted)))
        counts = draw_counts(sample)
        # Invalid draws (<=5%) widen the range to cover any possible count.
        lower = counts.copy(); upper = counts.copy()
        lower[invalid] = 0; upper[invalid] = 4
        lo = int(np.quantile(lower, .05, method="inverted_cdf"))
        hi = int(np.quantile(upper, .95, method="inverted_cdf"))
        results.append({"key": s["key"], "name": s["name"], "noise_factor": s["noise_factor"],
                        "noise_correlation": s["noise_correlation"], "count": sum(flags),
                        "domain_flags": dict(zip(DOMAIN_KEYS, flags)), "range": [lo, hi],
                        "projected_values": dict(zip(KEYS, map(float, predicted))),
                        "invalid_draw_fraction": float(invalid.mean())})
    central = next(s for s in results if s["key"] == "central")
    counts = [s["count"] for s in results]
    lo, hi = min(s["range"][0] for s in results), max(s["range"][1] for s in results)
    lo, hi = min(lo, *counts), max(hi, *counts)
    out.update(status="ready", reason="", central_count=central["count"], range=[lo, hi],
               scenario_count_range=[min(counts),max(counts)],
               threshold_sensitive=lo<2<=hi,
               assumption_sensitive=len(set(counts))>1,
               interval_days=c["interval_days"], scenarios=results,
               observed_count=sum(domain_flags(c["first"],c["latest"])),
               range_definition="Envelope of central 90% conditional simulation ranges and central counts across four assumed noise scenarios; not a validated confidence interval.",
               validation="No third visits are available to validate forecasts made using two visits.")
    return out
