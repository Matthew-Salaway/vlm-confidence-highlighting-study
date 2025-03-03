import json
from argparse import ArgumentParser
import random
import os

args = ArgumentParser()
args.add_argument("-d", "--data", default="../data/sample_data.json")
args.add_argument("-n", "--name", default="fm2_llama3.1_8b")
args.add_argument("-i", "--num_instances_per_queue", type=int, default=50)
args.add_argument("-q", "--num_queues", default=1, type=int)
args.add_argument("-s", "--seed", default=0, type=int)
args = args.parse_args()

random.seed(args.seed)

data = json.load(open(args.data))

out_dirname = f"web/baked_queues/{args.name}_q{args.num_queues}_i{args.num_instances_per_queue}_s{args.seed}"
os.makedirs(out_dirname, exist_ok=True)

for uid in list(range(args.num_queues)):
    sampled_data = random.sample(data, args.num_instances_per_queue)
    random.shuffle(sampled_data)

    half = args.num_instances_per_queue // 2
    # Split the sampled data into two conditions
    condition_A = sampled_data[:half]
    condition_B = sampled_data[half:]
    
    # Set the is_highlighted flag for each condition accordingly
    for question in condition_A:
        question["is_highlighted"] = True
    for question in condition_B:
        question["is_highlighted"] = False

    # Create a list of condition blocks
    conditions = [
        {"condition": "highlighted", "questions": condition_A},
        {"condition": "non_highlighted", "questions": condition_B}
    ]
    # Randomize the order of the condition blocks
    random.shuffle(conditions)
    
    out_file = f"{out_dirname}/{uid:0>3}.json"
    if os.path.exists(out_file):
        print(f"Overwriting {out_file}")
    else:
        print(f"Writing {out_file}")
    json.dump(conditions, open(out_file, "w"), indent=2)
