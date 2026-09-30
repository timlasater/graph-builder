# Base-R reference graphs for test-data/r-visual-reference.csv.
# From the project folder: Rscript scripts/r_visual_reference.R

args <- commandArgs(trailingOnly = TRUE)
source_file <- if (length(args) >= 1) args[1] else "test-data/r-visual-reference.csv"
output_dir <- if (length(args) >= 2) args[2] else "test-results/r-visual"
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

d <- read.csv(source_file)
d$Group <- factor(d$Group, levels = c("A", "B", "C"))
v <- d[!is.na(d$Response), ]
stopifnot(nrow(d) == 16, sum(is.na(d$Response)) == 1, nrow(v) == 15)

save_plot <- function(name, draw) {
  png(file.path(output_dir, paste0(name, ".png")), width = 900, height = 600)
  tryCatch(draw(), finally = dev.off())
}

save_plot("points", function() {
  plot(v$X, v$Response, pch = 16, col = as.integer(v$Group), xlab = "X", ylab = "Response", main = "Points")
  legend("topleft", legend = levels(v$Group), col = 1:3, pch = 16)
})

save_plot("lines", function() {
  plot(v$X, v$Response, type = "n", xlab = "X", ylab = "Response", main = "Lines")
  for (g in levels(v$Group)) {
    z <- v[v$Group == g, ]
    z <- z[order(z$X), ]
    lines(z$X, z$Response, col = match(g, levels(v$Group)))
    points(z$X, z$Response, col = match(g, levels(v$Group)), pch = 16)
  }
  legend("topleft", legend = levels(v$Group), col = 1:3, lty = 1, pch = 16)
})

groups <- split(v$Response, v$Group)
n <- lengths(groups)
means <- sapply(groups, mean)
se <- sapply(groups, function(z) if (length(z) > 1) sd(z) / sqrt(length(z)) else NA_real_)
ci <- rep(NA_real_, length(n))
ci[n > 1] <- qt(0.975, n[n > 1] - 1) * se[n > 1]
bar_summary <- data.frame(Group = names(groups), n, mean = means, ci_half_width = ci, row.names = NULL)
write.csv(bar_summary, file.path(output_dir, "mean-bars.csv"), row.names = FALSE, na = "")
save_plot("mean-bars", function() {
  bar_x <- barplot(means, ylim = c(0, max(means + ifelse(is.na(ci), 0, ci)) * 1.1), ylab = "Mean Response")
  has_ci <- !is.na(ci)
  arrows(bar_x[has_ci], means[has_ci] - ci[has_ci], bar_x[has_ci], means[has_ci] + ci[has_ci], angle = 90, code = 3, length = 0.05)
})

quartiles <- t(sapply(groups, function(z) quantile(z, c(0.25, 0.5, 0.75), type = 7)))
box_summary <- data.frame(Group = rownames(quartiles), q1 = quartiles[, 1], median = quartiles[, 2], q3 = quartiles[, 3], row.names = NULL)
write.csv(box_summary, file.path(output_dir, "box-quartiles.csv"), row.names = FALSE)
save_plot("box", function() boxplot(Response ~ Group, data = v, ylab = "Response"))

save_plot("histogram", function() {
  h <- hist(v$Response, breaks = seq(min(v$Response), max(v$Response), length.out = 6), right = FALSE, include.lowest = TRUE, xlab = "Response", main = "Histogram")
  write.csv(data.frame(left = head(h$breaks, -1), right = tail(h$breaks, -1), count = h$counts), file.path(output_dir, "histogram-counts.csv"), row.names = FALSE)
})

fit <- lm(Response ~ X, data = v)
fit_summary <- data.frame(intercept = unname(coef(fit)[1]), slope = unname(coef(fit)[2]), n = nobs(fit), r_squared = summary(fit)$r.squared)
write.csv(fit_summary, file.path(output_dir, "linear-fit.csv"), row.names = FALSE)
save_plot("linear-fit", function() {
  fit_x <- range(v$X)
  plot(fit_x, predict(fit, newdata = data.frame(X = fit_x)), type = "l", xlab = "X", ylab = "Fitted Response", main = "Linear fit")
})

by_x <- aggregate(Response ~ X, data = v, FUN = mean)
smooth <- sapply(seq_len(nrow(by_x)), function(i) mean(by_x$Response[max(1, i - 1):min(nrow(by_x), i + 1)]))
write.csv(data.frame(X = by_x$X, smooth = smooth), file.path(output_dir, "smooth.csv"), row.names = FALSE)
save_plot("smooth", function() plot(by_x$X, smooth, type = "l", xlab = "X", ylab = "Moving average", main = "Smooth trend"))

cat("R reference complete:", normalizePath(output_dir), "\n")
print(bar_summary)
print(box_summary)
print(fit_summary)
print(data.frame(X = by_x$X, smooth = smooth))
