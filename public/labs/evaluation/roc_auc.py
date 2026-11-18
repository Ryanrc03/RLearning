import numpy as np

def calculate_auc(y_true, y_scores):
    y_true = np.array(y_true)
    y_scores = np.array(y_scores)

    # Count positive and negative samples
    n_pos = np.sum(y_true == 1)
    n_neg = np.sum(y_true == 0)

    if n_pos == 0 or n_neg == 0:
        return 0.0

    # Sort by prediction scores
    sorted_indices = np.argsort(y_scores, kind="mergesort")[::-1]
    y_true_sorted = y_true[sorted_indices]
    y_scores_sorted = y_scores[sorted_indices]

    # Cumulative TP and FP
    tps = np.cumsum(y_true_sorted == 1)
    fps = np.cumsum(y_true_sorted == 0)

    # Handle tied scores
    last_of_group = np.append(
        y_scores_sorted[1:] != y_scores_sorted[:-1],
        True
    )

    tps = tps[last_of_group]
    fps = fps[last_of_group]

    # Compute ROC coordinates
    tpr = tps / n_pos
    fpr = fps / n_neg

    # Add origin (0, 0)
    tpr = np.concatenate([[0], tpr])
    fpr = np.concatenate([[0], fpr])

    # Trapezoidal integration
    auc = np.sum(
        np.diff(fpr) *
        (tpr[1:] + tpr[:-1]) / 2
    )

    return float(auc)


if __name__ == "__main__":
    y_true = [0, 1, 0, 1]
    y_scores = [0.2, 0.9, 0.8, 0.8]
    print(calculate_auc(y_true, y_scores))  # 0.875
