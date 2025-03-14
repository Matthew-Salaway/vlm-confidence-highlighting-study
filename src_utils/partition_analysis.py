import json
import random
import pandas as pd
import numpy as np
from argparse import ArgumentParser

# Argument parser
args = ArgumentParser()
args.add_argument("-d", "--data", default="./data/Qwen_ocr_questions_STUDY_20Q.json")
args = args.parse_args()

# Load data from JSON
data = json.load(open(args.data))

def compute_ece(partition, num_bins=10):
    """
    Compute the Expected Calibration Error (ECE) for a partition.
    Assumes each question in the partition has a "token_info" field, and each token is a dict 
    with a "top_5_tokens" list and an "is_correct" boolean.
    Uses the first prediction (top token) from "top_5_tokens" for the probability.
    """
    tokens = []
    # Iterate over each question in the partition.
    for q in partition:
        for token in q.get("token_info", []):
            # Extract the top-5 tokens for this token.
            top_tokens = token.get("top_5_tokens", [])
            if top_tokens:  # Only process if the list is non-empty.
                try:
                    # Use the probability from the first (top) prediction.
                    prob = float(top_tokens[0].get("probability", -1))
                    if prob < 0 or prob > 1:
                        raise ValueError
                except (TypeError, ValueError):
                    print(f"Invalid probability: {top_tokens[0].get('probability')}")
                    continue
                # Only add tokens that have an "is_correct" field.
                if "is_correct" not in token:
                    continue
                tokens.append({"probability": prob, "is_correct": token["is_correct"]})

    if not tokens:
        return 0.0
    
    total_tokens = len(tokens)
    ece = 0.0
    # Create bins with width 0.1
    for i in range(num_bins):
        lower = i / num_bins
        upper = (i + 1) / num_bins
        # For the last bin, include tokens with probability equal to 1
        if i == num_bins - 1:
            bin_tokens = [t for t in tokens if lower <= t["probability"] <= upper]
        else:
            bin_tokens = [t for t in tokens if lower <= t["probability"] < upper]
        
        if not bin_tokens:
            continue
        
        # Calculate average predicted probability (confidence) for the bin
        avg_confidence = np.mean([t["probability"] for t in bin_tokens])
        # Calculate empirical accuracy: fraction of tokens where is_correct is True
        accuracy = np.mean([1 if t["is_correct"] in [True, 1] else 0 for t in bin_tokens])
        # Weight is the fraction of tokens in this bin
        bin_weight = len(bin_tokens) / total_tokens
        ece += bin_weight * abs(avg_confidence - accuracy)
    
    return ece

# Function to compute statistics for a partition (including ECE)
def compute_partition_stats(partition):
    cer_values = [q["cer"] for q in partition]
    question_lengths = [q["question_length"] for q in partition]

    # Compute mean and std deviation for CER and question lengths
    cer_mean = np.mean(cer_values)
    cer_std = np.std(cer_values)
    length_mean = np.mean(question_lengths)
    length_std = np.std(question_lengths)

    # For percentage highlighted, extract each question's token_info,
    # then flatten to get each token's top_5_tokens list.
    tokens_info_list = [q.get("token_info", []) for q in partition]
    tokens_list = [token.get("top_5_tokens", []) 
                   for token_info in tokens_info_list for token in token_info]
    total_tokens = len(tokens_list)
    if total_tokens > 0:
        num_highlighted = sum(1 for tokens in tokens_list if float(tokens[0].get("probability", 1)) < 0.95)
        percentage_highlighted = (num_highlighted / total_tokens) * 100
    else:
        percentage_highlighted = 0

    # Compute Expected Calibration Error (ECE)
    ece_value = compute_ece(partition, num_bins=10)
    
    return cer_mean, cer_std, length_mean, length_std, percentage_highlighted, ece_value

# Store results
results = []

# Test seeds 0 to 100
for seed in range(101):
    random.seed(seed)
    shuffled_data = data.copy()
    random.shuffle(shuffled_data)

    # Split into partitions X and Y
    half_size = len(shuffled_data) // 2
    X = shuffled_data[:half_size]
    Y = shuffled_data[half_size:]

    # Compute statistics for both partitions (each returns 6 metrics)
    x_stats = compute_partition_stats(X)
    y_stats = compute_partition_stats(Y)

    # Compute the difference (X minus Y) for each metric
    diff = [x - y for x, y in zip(x_stats, y_stats)]

    # Store results for this seed: [seed, differences..., X stats..., Y stats...]
    results.append([seed, *diff, *x_stats, *y_stats])

# Create DataFrame with updated columns (6 metrics per partition)
columns = [
    "Seed",
    "Diff_CER_Mean", "Diff_CER_Std", "Diff_Q_Length_Mean", "Diff_Q_Length_Std", "Diff_Percent_Highlighted", "Diff_ECE",
    "X_CER_Mean", "X_CER_Std", "X_Q_Length_Mean", "X_Q_Length_Std", "X_Percent_Highlighted", "X_ECE",
    "Y_CER_Mean", "Y_CER_Std", "Y_Q_Length_Mean", "Y_Q_Length_Std", "Y_Percent_Highlighted", "Y_ECE"
]
df = pd.DataFrame(results, columns=columns)

# --- Begin normalization and L1 distance calculation ---
diff_columns = ["Diff_CER_Mean", "Diff_CER_Std", "Diff_Q_Length_Mean", 
                "Diff_Q_Length_Std", "Diff_Percent_Highlighted", "Diff_ECE"]

# Normalize each difference column using min–max scaling on the absolute differences.
for col in diff_columns:
    abs_vals = df[col].abs()
    min_val = abs_vals.min()
    max_val = abs_vals.max()
    if max_val - min_val == 0:
        # If all values are the same, set the normalized value equal to the absolute value.
        df[col + "_norm"] = abs_vals
    else:
        df[col + "_norm"] = (abs_vals - min_val) / (max_val - min_val)

# Compute the combined difference (L1 distance) by summing the normalized differences.
norm_cols = [col + "_norm" for col in diff_columns]
df["Combined_Diff"] = df[norm_cols].sum(axis=1)
df = df[['Seed', 'Combined_Diff'] + [col for col in df.columns if col not in ['Seed', 'Combined_Diff']]]
# --- End normalization and L1 distance calculation ---

# Save to CSV
df.to_csv("partition_analysis.csv", index=False)

# Optionally display the DataFrame (if using ace_tools, uncomment the next lines)
# import ace_tools as tools
# tools.display_dataframe_to_user(name="Partition Analysis", dataframe=df)
