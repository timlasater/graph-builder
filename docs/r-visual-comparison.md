# Compare Graph Builder with free R

R is a free statistics and graphing program. It can open the same CSV file as Graph Builder, calculate summaries independently, and draw points, lines, bars, histograms, box plots, and fitted lines. The two programs do not need to use the same colors or fonts: compare data values, labels, group order, axis ranges, and overall shape. R's standard Windows installation includes the **R Console** and all commands below; no extra R packages or license are needed.

The small [practice CSV](../test-data/r-visual-reference.csv) has repeated X values, unequal group sizes, one missing response, and an outlier. It contains no private data. Graph Builder's separate [SciPy comparison](phase-9-validation.md#free-independent-statistics-comparison) already checks representative calculation formulas. This exercise checks the graphs and the values the app exports.

## Set up both programs

1. If R is not installed, download the current **R for Windows** installer from the [official CRAN page](https://cran.r-project.org/bin/windows/base/). Run it with the default choices. Open **R** from the Windows Start menu. A window with a `>` prompt is the R Console. You do not need RStudio.
2. Open Graph Builder. If using the local development copy, run `npm run dev` in the project folder and open the address shown. Download an embedded project first if you need to preserve your current graph or edits.
3. In Graph Builder, click **Import data** and choose `test-data/r-visual-reference.csv`. Confirm replacement if asked. **View data table** should show **16 rows and 3 columns**. The last row has a blank Response. Close the table.
4. In the R Console, copy and run these two lines, one at a time. The file picker in the first line must select the **same** `r-visual-reference.csv` file.

   ```r
   d <- read.csv(file.choose())
   d$Group <- factor(d$Group, levels = c("A", "B", "C"))
   ```

5. Run `nrow(d)`; R should print **16**. Run `sum(is.na(d$Response))`; it should print **1**. Then run the next line. It gives the remaining commands only rows with a Response value, just as the plotted graphs do.

   ```r
   v <- d[!is.na(d$Response), ]
   ```

Use one graph layer at a time in Graph Builder. In **Properties → Layers**, choose its **Element**. Assign or clear X and Y variables as directed below. For every test, choose **Projects & export → Export plotted data CSV** and open that CSV to compare the exact values. The exported `y` column contains plotted heights or positions; `error_lower` and `error_upper` are error-bar distances from `y`, not the lower and upper endpoints.

## Test 1: Points and lines

In Graph Builder, assign **X** to X and **Y** to Response. Assign Group to **Color**. Choose **Points**. The A, B, and C groups should appear separately; the blank Response row should not create a point. Compare X/Y positions with this R graph:

```r
plot(v$X, v$Response, pch = 16, col = as.integer(v$Group), xlab = "X", ylab = "Response", main = "Points")
legend("topleft", legend = levels(v$Group), col = 1:3, pch = 16)
```

Choose **Line** in Graph Builder. R can connect each group's observations in X order with:

```r
plot(v$X, v$Response, type = "n", xlab = "X", ylab = "Response", main = "Lines")
for (g in levels(v$Group)) { z <- v[v$Group == g, ]; z <- z[order(z$X), ]; lines(z$X, z$Response, type = "b", col = match(g, levels(v$Group)), pch = 16) }
legend("topleft", legend = levels(v$Group), col = 1:3, lty = 1, pch = 16)
```

Repeated X values create vertical segments in a line. Compare positions and the order of connections; colors may differ.

## Test 2: Mean bars and confidence intervals

In Graph Builder, clear the X and Color assignments. Assign **X** to Group and **Y** to Response. Choose **Bars**. Under the active layer, set **Bar summary** to **Mean**, **Error bars** to **Confidence interval**, and **Confidence level** to **95%**. Group C has only one valid response, so it should have a bar but no calculated error bar.

Run this R block one line at a time. The printed table contains the group sample size, mean, and the distance from the mean to either end of its 95% interval.

```r
groups <- split(v$Response, v$Group)
n <- lengths(groups)
means <- sapply(groups, mean)
se <- sapply(groups, function(z) if (length(z) > 1) sd(z) / sqrt(length(z)) else NA_real_)
ci <- rep(NA_real_, length(n))
ci[n > 1] <- qt(0.975, n[n > 1] - 1) * se[n > 1]
data.frame(Group = names(groups), n, mean = means, ci_half_width = ci)
bar_x <- barplot(means, ylim = c(0, max(means + ifelse(is.na(ci), 0, ci)) * 1.1), ylab = "Mean Response")
has_ci <- !is.na(ci)
arrows(bar_x[has_ci], means[has_ci] - ci[has_ci], bar_x[has_ci], means[has_ci] + ci[has_ci], angle = 90, code = 3, length = 0.05)
```

Compare R's `mean` with Graph Builder's exported `y`, and `ci_half_width` with both `error_lower` and `error_upper`. The means should be **A = 8.5**, **B ≈ 6.8333**, and **C = 10**. R prints `NA` for Group C's interval; Graph Builder should leave its error fields blank. Repeat with **Mean line** if you want to check that element too.

## Test 3: Box plot

Keep X = Group and Y = Response. Choose **Box plot** and **Show points → Outliers only**. Group A's value **30** should appear as an outlier. Run:

```r
boxplot(Response ~ Group, data = v, ylab = "Response")
t(sapply(groups, function(z) quantile(z, c(0.25, 0.5, 0.75), type = 7)))
```

Compare Graph Builder's exported `q1`, `median`, and `q3` against the printed R table. `type = 7` specifies the same linear-interpolation quartile rule. [R's built-in box drawing uses a different hinge rule](https://stat.ethz.ch/R-manual/R-devel/library/grDevices/help/boxplot.stats.html) for its box edges, so the two pictures may have slightly different box heights even when the printed quartiles match. Compare the exported quartiles, median position, whiskers, and outlier rather than treating a hinge difference as a calculation failure.

## Test 4: Histogram

Clear Y and Color. Assign **X** to Response. Choose **Histogram** and set **Number of bins** to **5**. Run:

```r
h <- hist(v$Response, breaks = seq(min(v$Response), max(v$Response), length.out = 6), right = FALSE, include.lowest = TRUE, xlab = "Response", main = "Histogram")
h$counts
```

Compare the five printed counts with the five Graph Builder bars or the export's `y` values. They should be **9, 5, 0, 0, 1**. [R's `right = FALSE, include.lowest = TRUE` setting](https://stat.ethz.ch/R-manual/R-devel/library/graphics/html/hist.html) puts the highest observation in the last bin, as Graph Builder does. If you see different counts, first confirm the same five bin boundaries and that Group/Color is cleared.

## Test 5: Linear fit and smooth trend

Clear Color. Assign **X** to X and **Y** to Response. Choose **Fit**. Under the active layer, turn on **Show equation**, **Show sample size**, and **Show R²**. Leave **Set y-intercept** blank. Run:

```r
fit <- lm(Response ~ X, data = v)
coef(fit)
nobs(fit)
summary(fit)$r.squared
plot(v$X, v$Response, pch = 16, xlab = "X", ylab = "Response", main = "Linear fit")
abline(fit, col = "blue", lwd = 2)
```

Compare R's intercept, slope, sample size, and R² with Graph Builder's displayed numbers. They should be about **−1.0202**, **3.1233**, **15**, and **0.4641**. The app rounds displayed figures, so a small difference in the last printed digit is normal. Compare the fitted line's endpoints through the plotted-data CSV if you need more precision.

Now choose **Smooth trend** with **Moving average window = 3**. Graph Builder first averages all responses at each distinct X, then averages each X mean with its neighbors. The ends use fewer neighbors. Run:

```r
by_x <- aggregate(Response ~ X, data = v, FUN = mean)
smooth <- sapply(seq_len(nrow(by_x)), function(i) mean(by_x$Response[max(1, i - 1):min(nrow(by_x), i + 1)]))
data.frame(X = by_x$X, smooth = smooth)
plot(by_x$X, smooth, type = "b", xlab = "X", ylab = "Moving average", main = "Smooth trend")
```

Compare each R `smooth` value with Graph Builder's exported `y` for the same X. The five values should be about **4.3333, 5.1111, 7.0556, 10.6111, 12.5833**. R's line color and marker shape are unimportant.

## Record the outcome

For each graph, record **match**, **expected method difference**, or **unexplained difference**. Note the Graph Builder setting, the R command, the affected group/X value, and the two numbers for any unexplained difference. A screenshot of each graph pair helps with visual differences. Use this public practice file first; if it passes, repeat a few representative graphs with a de-identified CSV from your own data if you want greater confidence. The source data stays on your computer in both programs.
