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

    for question in sampled_data[:(args.num_instances_per_queue // 2)]:
        question["is_highlighted"] = True

    for question in sampled_data[(args.num_instances_per_queue // 2):]:
        question["is_highlighted"] = False

    # If we want to random question type order
    random.shuffle(sampled_data)

    #  IF we want first half to be one type and second half to be another
    # Randomly decide to reverse the list or not
    # if random.choice([True, False]):
    #     sampled_data = sampled_data[::-1]

    out_file = f"{out_dirname}/{uid:0>3}.json"
    if os.path.exists(out_file):
        print(f"Overwriting {out_file}")
    else:
        print(f"Writing {out_file}")
    json.dump(sampled_data, open(out_file, "w"), indent=2)