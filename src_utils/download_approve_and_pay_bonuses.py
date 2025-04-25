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
    result = requests.get(
        f"https://api.prolific.com/api/v1/studies/{study_id}/submissions/",
        params={"state": "AWAITING REVIEW"},
        headers={"Authorization": f"Token {PROLIFIC_API_KEY}"}
    )
    if not result.ok:
        pdb.set_trace()
        exit("Unable to complete an important request (fetching submissions).")
    d = result.json()["results"]
    return d

def display_interaction_summary(uid, interaction_summary):
    print(f"UID: {uid}")
    for k, v in interaction_summary['pre_survey'].items():
        print(f"\t{k}: {v}")
    print(f"\t# keys pressed in highlighted condition: {interaction_summary['highlighted']['keys_pressed']}")
    print(f"\t# keys pressed in non-highlighted condition: {interaction_summary['non-highlighted']['keys_pressed']}")
    print(f"\tAverage time spent in highlighted condition: {interaction_summary['highlighted']['average_time']:.2f}s")
    print(f"\tAverage time spent in non-highlighted condition: {interaction_summary['non-highlighted']['average_time']:.2f}s")
    print(f"\t# unique TLX responses: {interaction_summary['highlighted']['unique_tlx']}")
    print(f"\t# unique TLX responses: {interaction_summary['non-highlighted']['unique_tlx']}")

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
        f"https://api.prolific.com/api/v1/submissions/{submission_id}/transition/",
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

def approve_and_pay_bonuses(study_id, session_id, participant_id):
    r = requests.post(
        f"https://api.prolific.com/api/v1/submissions/{session_id}/transition/",
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


def get_user_summary(data):
    
    for k, v in data['pre_survey']['pre_survey'].items():
        print(f"\t{k}: {v}")
    highlighted_interactions = data['highlighted']['interactions']
    non_highlighted_interactions = data['non-highlighted']['interactions']            

    keys_pressed_highlighted = sum([[k['key_pressed'] for k in i['keylogs'] if k['event'] == 'input_change'] for i in highlighted_interactions], [])
    keys_pressed_non_highlighted = sum([[k['key_pressed'] for k in i['keylogs'] if k['event'] == 'input_change'] for i in non_highlighted_interactions], [])
    if len(keys_pressed_highlighted) <= 5 or len(keys_pressed_non_highlighted) <= 5:
        print("Keys pressed in highlighted condition: ", keys_pressed_highlighted)
        print("Keys pressed in non-highlighted condition: ", keys_pressed_non_highlighted)
        for i in highlighted_interactions + non_highlighted_interactions:
            for k in i['keylogs']:
                print(k['event'], k['key_pressed'], k['old_text'], k['new_text'])
            #pdb.set_trace()

    time_submissions_highlighted = sum([[float(k['precise_time']) for k in i['keylogs'] if k['event'] == 'auto_submit' or k['event'] == 'next_button_submitted'] for i in highlighted_interactions], [])
    time_submissions_non_highlighted = sum([[float(k['precise_time']) for k in i['keylogs'] if k['event'] == 'auto_submit' or k['event'] == 'next_button_submitted'] for i in non_highlighted_interactions], [])
    assert len(time_submissions_highlighted) == 10 and len(time_submissions_non_highlighted) == 10, f"Expected 10 time submissions in each condition, got {len(time_submissions_highlighted)} and {len(time_submissions_non_highlighted)}"

    tlx_responses_highlighted = list(data['highlighted']['tlx']['tlx'].values())
    tlx_responses_non_highlighted = list(data['non-highlighted']['tlx']['tlx'].values())

    summary = {
        'highlighted': {
            'keys_pressed': len(keys_pressed_highlighted),
            'average_time': sum(time_submissions_highlighted)/len(time_submissions_highlighted),
            'unique_tlx': len(set(tlx_responses_highlighted)),
        },
        'non-highlighted': {
            'keys_pressed': len(keys_pressed_non_highlighted),
            'average_time': sum(time_submissions_non_highlighted)/len(time_submissions_non_highlighted),
            'unique_tlx': len(set(tlx_responses_non_highlighted)),
        },
        'pre_survey': data['pre_survey']['pre_survey'],
    }
    return summary

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--study_id', type=str, required=True)
    parser.add_argument('--study_name', type=str, required=True)
    args = parser.parse_args()

    interaction_data_filename = f"study_data/batch_interaction_data/{args.study_name}.json"
    batch_summaries_filename = f"study_data/batch_summaries/{args.study_name}.tsv"
    tmp_filename = "tmp.jsonl"
    command = f"curl \"https://matthewsalaway.pythonanywhere.com/read?password={PYTHONANYWHERE_KEY}&project=ocr-calibration-study/{args.study_id}\" > {tmp_filename}"
    os.system(command)

    submissions = get_submissions(args.study_id)
    submissions.sort(key=lambda x: x['started_at'])
    print(f"Number of Prolific submissions: {len(submissions)}")

    uid2interactions = defaultdict(list)
    all_interactions = []
    with jsonlines.open(tmp_filename) as reader:
        for obj in reader:
            user_id = obj['url_data']['prolific_id']
            uid2interactions[user_id].append(obj)

    print(f"Loaded interaction data from PythonAnywhere logs for {len(uid2interactions)} users.")
    print("-"*100)

    uid2structureddata = defaultdict(dict)
    for uid, interactions in uid2interactions.items():
        for i in interactions:
            if 'pre_survey' in i:
                uid2structureddata[uid]['pre_survey'] = i
                uid2structureddata[uid]['highlighted'] = {'tlx': {}, 'interactions': []}
                uid2structureddata[uid]['non-highlighted'] = {'tlx': {}, 'interactions': []}
            if 'tlx' in i:
                uid2structureddata[uid][i['condition']]['tlx'] = i
            if 'question_i' in i:
                uid2structureddata[uid][i['condition']]['interactions'].append(i)
            if 'qualitative' in i:
                uid2structureddata[uid]['qualitative'] = i
        print(f"User {uid} has {len(interactions)} entries.")

    pdb.set_trace()
    
    output_data = {}
    for s in submissions:
        uid = s['participant_id']
        if s['status'] == 'RETURNED':
            print(f"UID: {uid} was returned.")
            print("-"*100)
            continue
        if s['status'] == 'ACTIVE':
            print(f"UID: {uid} is active.")
            print("-"*100)
            continue

        try:
            assert uid in uid2structureddata
        except:
            print(f"Interaction data not found in PythonAnywhere logs for User {uid}.")
            print('-'*100)
            #pdb.set_trace()
            continue

        interaction_summary = get_user_summary(uid2structureddata[uid])

        output_data[uid] = copy.deepcopy(s)
        output_data[uid]['interaction_summary'] = interaction_summary
        output_data[uid]['interaction_data'] = uid2structureddata[uid]
        if s['status'] in ['APPROVED', 'REJECTED']:
            display_interaction_summary(uid, interaction_summary)
            print(f"Already {s['status']}.")

        elif s['status'] == 'RETURNED' or s['status'] == 'ACTIVE':
            continue

        elif s['status'] == 'AWAITING REVIEW' or s['status'] == 'TIMED-OUT':
            print(f"UID: {uid} is {s['status'].lower()}.")
            display_interaction_summary(uid, interaction_summary)
            try:
                assert len(uid2interactions[uid]) == 24
            except:
                print(f"Number of interactions is {len(uid2interactions[uid])}.")
                pdb.set_trace()
                print("-"*100)
                continue

            while True:
                choice = input(f"(A)pprove, (R)eject, (S)kip: ")
                if choice == 'A':
                    out = approve_and_pay_bonuses(args.study_id, s['id'], uid)
                    output_data[uid]['status'] = 'APPROVED'
                    break
                elif choice == 'R':
                    output_data[uid]['status'] = 'REJECTED'
                    #TODO: Implement rejection
                    break
                elif choice == 'S':
                    break

        print("-"*100)
        #pdb.set_trace()

    print(f"Saving data for {len(output_data)} users to {interaction_data_filename} and {batch_summaries_filename}.")
    # Create parent directory if it doesn't exist
    os.makedirs(os.path.dirname(interaction_data_filename), exist_ok=True)
    json.dump(output_data, open(interaction_data_filename, 'w'), indent=2)

    #print(f"\n\nProlific ID{' '*25}\tBalance\tFalseAccepts\tFalseRejects\t# exits{' '*5}\t# of max bets\tAvg bet value")
    os.makedirs(os.path.dirname(batch_summaries_filename), exist_ok=True)
    f = open(batch_summaries_filename, 'w')
    f.write(f"Prolific ID\tSession ID\tlatexExp\tlatexFreq\tchatbotFreq\tKeysPressedHL\tKeysPressedNH\tAvgTimeHL\tAvgTimeNH\tUniqueTLXHL\tUniqueTLXNH\t# of interactions HL\t# of interactions NH\tStatus\n")
    for o in output_data:
        s = output_data[o]['interaction_summary']
        if output_data[o]['status'] in ['APPROVED', 'REJECTED']:
            f.write(f"{o}\t{output_data[o]['id']}\t{s['pre_survey']['latexExperience']}\t{s['pre_survey']['latexFrequency']}\t{s['pre_survey']['chatbotFrequency']}\t{s['highlighted']['keys_pressed']}\t{s['non-highlighted']['keys_pressed']}\t{s['highlighted']['average_time']:.2f}\t{s['non-highlighted']['average_time']:.2f}\t{s['highlighted']['unique_tlx']}\t{s['non-highlighted']['unique_tlx']}\t{len(output_data[o]['interaction_data']['highlighted']['interactions'])}\t{len(output_data[o]['interaction_data']['non-highlighted']['interactions'])}\t{output_data[o]['status']}\n")
    f.close()

    # Read the tsv file into pandas dataframe and print 
    df = pd.read_csv(batch_summaries_filename.replace('.json', '.tsv'), sep='\t', header=0)
    print(df)