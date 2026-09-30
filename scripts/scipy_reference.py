"""Optional independent reference for the Phase 9 statistical spot check.

Run with Python, NumPy, and SciPy installed: python scripts/scipy_reference.py
This script does not import Graph Builder code.
"""

import json

import numpy as np
import scipy
from scipy import stats


groups = {"A": [4, 5, 7, 9], "B": [10, 12, 13], "C": [8]}
summaries = {}
for name, observations in groups.items():
    values = np.asarray(observations, dtype=float)
    n = len(values)
    sd = float(np.std(values, ddof=1)) if n > 1 else None
    se = float(stats.sem(values)) if n > 1 else None
    summaries[name] = {
        "n": n,
        "mean": float(np.mean(values)),
        "sd": sd,
        "se": se,
        "ci95_half_width": float(stats.t.ppf(0.975, n - 1) * se) if n > 1 else None,
        "q1": float(np.quantile(values, 0.25, method="linear")),
        "median": float(np.median(values)),
        "q3": float(np.quantile(values, 0.75, method="linear")),
    }

x = np.asarray([1, 1, 2, 3, 4, 4, 5], dtype=float)
y = np.asarray([2, 3, 4, 8, 8, 10, 9], dtype=float)
fit = stats.linregress(x, y)
fixed_intercept = 1.0
fixed_slope = float(np.linalg.lstsq(x[:, None], y - fixed_intercept, rcond=None)[0][0])
fixed_r_squared = float(1 - np.sum((y - (fixed_intercept + fixed_slope * x)) ** 2) / np.sum((y - np.mean(y)) ** 2))

unique_x = np.unique(x)
means = np.asarray([np.mean(y[x == value]) for value in unique_x])
smooth = [float(np.mean(means[max(0, i - 1):i + 2])) for i in range(len(means))]
weighted = np.repeat([4, 9, 12], [1, 3, 2])
histogram_counts, histogram_edges = np.histogram([0, 1, 2, 3, 4], bins=2, range=(0, 4))
box_values = np.asarray([1, 2, 2, 3, 20], dtype=float)
q1, median, q3 = np.quantile(box_values, [0.25, 0.5, 0.75], method="linear")
lower_fence = q1 - 1.5 * (q3 - q1)
upper_fence = q3 + 1.5 * (q3 - q1)
inliers = box_values[(box_values >= lower_fence) & (box_values <= upper_fence)]

print(json.dumps({
    "software": {"scipy": scipy.__version__, "numpy": np.__version__},
    "groups": summaries,
    "fit": {"slope": float(fit.slope), "intercept": float(fit.intercept), "r_squared": float(fit.rvalue ** 2)},
    "fixed_fit": {"intercept": fixed_intercept, "slope": fixed_slope, "r_squared": fixed_r_squared},
    "smooth": {"x": unique_x.tolist(), "y": smooth},
    "frequency_summary": {"n": len(weighted), "mean": float(np.mean(weighted)), "sd": float(np.std(weighted, ddof=1))},
    "histogram": {"counts": histogram_counts.tolist(), "edges": histogram_edges.tolist()},
    "box": {"q1": float(q1), "median": float(median), "q3": float(q3), "lower_whisker": float(np.min(inliers)), "upper_whisker": float(np.max(inliers)), "outliers": box_values[(box_values < lower_fence) | (box_values > upper_fence)].tolist()},
}, indent=2))
