import json
from argparse import ArgumentParser
import random
import os

# Argument parser
args = ArgumentParser()
args.add_argument("-d", "--data", default="../data/sample_data.json")
args.add_argument("-n", "--name", default="fm2_llama3.1_8b")
args.add_argument("-i", "--num_instances_per_queue", type=int, default=50)
args.add_argument("-q", "--num_queues", type=int, default=4)  # Ensure num_queues is a multiple of 4
args.add_argument("-s", "--seed", type=int, default=27)  # Set default seed to 14
args = args.parse_args()

# Set deterministic seed
random.seed(27)

# Load data from JSON
data = json.load(open(args.data))
data = data[:args.num_instances_per_queue]
# Shuffle the data once globally
random.shuffle(data)

# Split shuffled data into two partitions X and Y
half_size = len(data) // 2
X = data[:half_size]  # First half
Y = data[half_size:]  # Second half
# print the answer of each partition
for x in X:
    print(f"X: {x['answer'][0].replace(" ", "")}")
for y in Y:
    print(f"Y: {y['answer'][0].replace(" ", "")}")
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
        with open(os.path.join(out_dirname, filename), "w") as f:
            json.dump(data_json, f, indent=2)

    print(f"Generated {i*4:03}.json to {i*4+3:03}.json")

print(f"\n✅ Successfully generated {args.num_queues} JSON files in: {out_dirname}")


# for uid in list(range(args.num_queues)):
#     sampled_data = random.sample(data, args.num_instances_per_queue)
#     random.shuffle(sampled_data)

#     half = args.num_instances_per_queue // 2
#     # Split the sampled data into two conditions
#     condition_A = sampled_data[:half]
#     condition_B = sampled_data[half:]
    
#     # Set the is_highlighted flag for each condition accordingly
#     for question in condition_A:
#         question["is_highlighted"] = True
#     for question in condition_B:
#         question["is_highlighted"] = False

#     # Create a list of condition blocks
#     conditions = [
#         {"condition": "highlighted", "questions": condition_A},
#         {"condition": "non_highlighted", "questions": condition_B}
#     ]
#     # Randomize the order of the condition blocks
#     random.shuffle(conditions)
    
#     out_file = f"{out_dirname}/{uid:0>3}.json"
#     if os.path.exists(out_file):
#         print(f"Overwriting {out_file}")
#     else:
#         print(f"Writing {out_file}")
#     json.dump(conditions, open(out_file, "w"), indent=2)
