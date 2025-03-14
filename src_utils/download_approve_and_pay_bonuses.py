from secret import PROLIFIC_API_KEY, PYTHONANYWHERE_KEY
import argparse
import os
import copy
import requests
import pdb
import pandas as pd
import jsonlines, json
from collections import defaultdict

def get_submissions(study_id):
    r = requests.get(
        f"https://api.prolific.co/api/v1/studies/{study_id}/submissions/",
        params={"state": "AWAITING REVIEW"},
        headers={"Authorization": f"Token {PROLIFIC_API_KEY}"}
    )
    if not r.ok:
        exit("Unable to complete an important request (fetching submissions).")
    d = r.json()["results"]
    return d

def display_interaction_summary(uid, interaction_summary):
    print(f"UID: {uid}")
    print(f"\tBalance: ${interaction_summary['balance']:.2f}")
    print(f"\tAccuracy with only answer: {interaction_summary['accuracy_answeronly']:.2%}")
    print(f"\tAccuracy with explanation: {interaction_summary['accuracy_withexplanation']:.2%}")
    print(f"\tAccuracy with explanation quality: {interaction_summary['accuracy_withexplanationquality']:.2%}")
    print(f"\tNumber of exits: {interaction_summary['num_exits']}")

def reject_submission(submission_id, participant_id, message, rejection_category):
    if args.dry_run:
        print(
            f"Not continuing because of --dry-run but would reject"
            f"{submission_id} of {participant_id}"
        )
        return
    
    if rejection_category not in ["TOO_QUICKLY", "TOO_SLOWLY" ,"FAILED_INSTRUCTIONS", "INCOMP_LONGITUDINAL", "FAILED_CHECK" ,"LOW_EFFORT",
                       "MALINGERING" ,"NO_CODE", "BAD_CODE", "NO_DATA", "UNSUPP_DEVICE", "OTHER"]:
        print(rejection_category)
    r = requests.post(
        f"https://api.prolific.co/api/v1/submissions/{submission_id}/transition/",
        headers={"Authorization": f"Token {PROLIFIC_API_KEY}"},

        json={
            "action": "REJECT",
            "message": message,
            "rejection_category": rejection_category
        }
    )
    if not r.ok:
        exit(
            f"Failed rejection of {submission_id} of participant {participant_id}"
        )
    d = r.json()
    print(f'status: {d["status"]}, participant: {d["participant"]}')

def approve_and_pay_bonuses(study_id, session_id, participant_id, bonus_payment):
    r = requests.post(
        f"https://api.prolific.co/api/v1/submissions/{session_id}/transition/",
        headers={"Authorization": f"Token {PROLIFIC_API_KEY}"},
        json={
            "action": "APPROVE",
        }
    )
    if not r.ok:
        exit(
            f"Failed approval of {session_id} of participant {participant_id}"
        )
    d = r.json()
    print(f'status: {d["status"]}, participant: {d["participant"]}')

    if float(bonus_payment) == 0:
        print(f"Bonus payment is 0, not setting up bonus payment.")
        return

    bonus_string = f"{participant_id},{bonus_payment}"
    r = requests.post(
        f"https://api.prolific.co/api/v1/submissions/bonus-payments/",
        headers={"Authorization": f"Token {PROLIFIC_API_KEY}"},
        json={
            "study_id": study_id,
            "csv_bonuses": bonus_string
        }
    )
    if not r.ok:
        exit("Failed to set up bonus payment " + r.content.decode())
    d = r.json()
    print("Set up bonus payment with the following response:", d)
    print(f"Bonus paid: {bonus_payment}, total cost: ${d['total_amount']/100:.2f}")
    bonus_id = d["id"]

    r = requests.post(
        f"https://api.prolific.co/api/v1/bulk-bonus-payments/{bonus_id}/pay/",
        headers={"Authorization": f"Token {PROLIFIC_API_KEY}"},
    )
    if not r.ok:
        exit("Failed to pay bonus payment " + r.content.decode())
    d = r.json()
    print("Paid the bonus with the following response:", d)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--study_id', type=str, required=True)
    parser.add_argument('--study_name', type=str, required=True)
    args = parser.parse_args()

    interaction_data_filename = f"study_data/batch_interaction_data/{args.study_name}.json"
    batch_summaries_filename = f"study_data/batch_summaries/{args.study_name}.tsv"
    tmp_filename = "tmp.jsonl"
    command = f"curl \"https://tejassrinivasan.pythonanywhere.com/read?password={PYTHONANYWHERE_KEY}&project=2step-trust-study-interventions/{args.study_id}\" > {tmp_filename}"
    os.system(command)

    submissions = get_submissions(args.study_id)
    submissions.sort(key=lambda x: x['started_at'])
    print(f"Number of Prolific submissions: {len(submissions)}")

    uid2interactions = defaultdict(list)
    all_interactions = []
    with jsonlines.open(tmp_filename) as reader:
        for obj in reader:
            user_id = obj['url_data']['prolific_id']
            try:
                assert obj['question_i'] == len(uid2interactions[user_id])
                uid2interactions[user_id].append(obj)
                all_interactions.append(obj)
            except:
                print(f"Skipping question {obj['question_i']} for user {user_id} because it is out of order (already have {len(uid2interactions[user_id])} interactions).")
                continue
    print(f"Loaded interaction data from PythonAnywhere logs for {len(uid2interactions)} users.")
    print("-"*100)
    pdb.set_trace()

    output_data = {}
    for s in submissions:
        uid = s['participant_id']
        if s['status'] == 'RETURNED':
            print(f"UID: {uid} was returned.")
            print("-"*100)
            continue

        try:
            assert uid in uid2interactions
        except:
            print(f"Interaction data not found in PythonAnywhere logs for User {uid}.")
            print('-'*100)
            #pdb.set_trace()
            continue
        
        balance = round(uid2interactions[uid][-1]['user_balance_post_interaction'], 2)
        interactions = uid2interactions[uid]
        accuracy_answeronly = len([x for x in interactions if x['user_is_correct']['answeronly']]) / len(interactions)
        accuracy_withexplanation = len([x for x in interactions if x['user_is_correct']['withexplanation']]) / len(interactions)
        accuracy_withexplanationquality = len([x for x in interactions if x['user_is_correct']['withexplanationquality']]) / len(interactions)
        num_exits = sum([x['count_exited_page'] for x in interactions])
        interaction_summary = {
            'balance': balance,
            'accuracy_answeronly': accuracy_answeronly,
            'accuracy_withexplanation': accuracy_withexplanation,
            'accuracy_withexplanationquality': accuracy_withexplanationquality,
            'num_exits': num_exits
        }

        output_data[uid] = copy.deepcopy(s)
        output_data[uid]['interaction_summary'] = interaction_summary
        output_data[uid]['interactions'] = interactions    
        if s['status'] in ['APPROVED', 'REJECTED']:
            display_interaction_summary(uid, interaction_summary)
            print(f"Already {s['status']}.")

        elif s['status'] == 'RETURNED' or s['status'] == 'ACTIVE':
            continue

        elif s['status'] == 'AWAITING REVIEW' or s['status'] == 'TIMED-OUT':
            print(f"UID: {uid} is {s['status'].lower()}.")
            display_interaction_summary(uid, interaction_summary)
            try:
                assert len(interactions) == 30
            except:
                print(f"Number of interactions is {len(interactions)}")
                pdb.set_trace()
                print("-"*100)
                continue

            while True:
                choice = input(f"(A)pprove, (R)eject, (S)kip: ")
                if choice == 'A':
                    while True:
                        pay_bonus = input(f"Award bonus of ${balance:.2f} to {uid}? Y/N: ")
                        if pay_bonus == 'Y':
                            out = approve_and_pay_bonuses(args.study_id, s['id'], uid, balance)
                            output_data[uid]['status'] = 'APPROVED'
                            break
                        elif pay_bonus == 'N':
                            break

                    break
                elif choice == 'R':
                    output_data[uid]['status'] = 'REJECTED'
                    #TODO: Implement rejection
                    break
                elif choice == 'S':
                    break

        print("-"*100)
        #pdb.set_trace()

    # Create parent directory if it doesn't exist
    os.makedirs(os.path.dirname(interaction_data_filename), exist_ok=True)
    json.dump(output_data, open(interaction_data_filename, 'w'), indent=2)

    #print(f"\n\nProlific ID{' '*25}\tBalance\tFalseAccepts\tFalseRejects\t# exits{' '*5}\t# of max bets\tAvg bet value")
    os.makedirs(os.path.dirname(batch_summaries_filename), exist_ok=True)
    f = open(batch_summaries_filename, 'w')
    f.write(f"Prolific ID\tSession ID\tBalance\tAccAnswerOnly\tAccWithExpl\tAccWithExplQuality\t# exits\tStatus\n")
    for o in output_data:
        s = output_data[o]['interaction_summary']
        if output_data[o]['status'] in ['APPROVED', 'REJECTED']:
            f.write(f"{o}\t{output_data[o]['id']}\t${s['balance']:.2f}\t{s['accuracy_answeronly']:.4f}\t{s['accuracy_withexplanation']:.4f}\t{s['accuracy_withexplanationquality']:.4f}\t{s['num_exits']}\t{output_data[o]['status']}\n")
    f.close()

    # Read the tsv file into pandas dataframe and print 
    df = pd.read_csv(batch_summaries_filename.replace('.json', '.tsv'), sep='\t', header=0)
    print(df)