import json
from argparse import ArgumentParser
import random
import os

# Argument parser
args = ArgumentParser()
args.add_argument("-d", "--data", default="data\Qwen_ocr_STUDY_qid_20_specific_qids_5_4_25.json")
args.add_argument("-n", "--name", default="smartqueue")
args.add_argument("-i", "--num_instances_per_queue", type=int, default=20)
args.add_argument("-q", "--num_queues", type=int, default=20)  # Ensure num_queues is a multiple of 4
args.add_argument("-s", "--seed", type=int, default=6)  # Set default seed to 14
args = args.parse_args()

# Set deterministic seed
random.seed(args.seed)

# Load data from JSON
with open(args.data, "r", encoding="utf-8") as f:
    data = json.load(f)

data = data[:args.num_instances_per_queue]
# Shuffle the data once globally
random.shuffle(data)

# Split shuffled data into two partitions X and Y
half_size = len(data) // 2
X = data[:half_size]  # First half
Y = data[half_size:]  # Second half
# print the answer of each partition
for x in X:
    print("X: " + x['answer'][0].replace(" ", ""))
for y in Y:
    print("Y: " + y['answer'][0].replace(" ", ""))
# Output directory for JSON files
out_dirname = f"web/baked_queues/{args.name}_q{args.num_queues}_i{args.num_instances_per_queue}_s{args.seed}"
os.makedirs(out_dirname, exist_ok=True)

# Generate JSONs in groups of 4 per iteration
for i in range(args.num_queues // 4):
    # Shuffle partitions before each iteration
    random.shuffle(X)
    random.shuffle(Y)


    # Generate JSON files with different orderings
    json_variants = [
        ([{"condition": "highlighted", "questions": X},
          {"condition": "non-highlighted", "questions": Y}], f"{i*4+0:03}.json"),

        ([{"condition": "non-highlighted", "questions": Y},
          {"condition": "highlighted", "questions": X}], f"{i*4+1:03}.json"),

        # Swap the highlight assignments
        ([{"condition": "highlighted", "questions": Y},
          {"condition": "non-highlighted", "questions": X}], f"{i*4+2:03}.json"),

        ([{"condition": "non-highlighted", "questions": X},
          {"condition": "highlighted", "questions": Y}], f"{i*4+3:03}.json"),
    ]

    # Save each JSON variant
    for data_json, filename in json_variants:
        with open(os.path.join(out_dirname, filename), "w", encoding="utf-8") as f:
          json.dump(data_json, f, indent=2, ensure_ascii=False)


    print(f"Generated {i*4:03}.json to {i*4+3:03}.json")

print(f"\n✅ Successfully generated {args.num_queues} JSON files in: {out_dirname}")
