import json, pandas as pd, matplotlib.pyplot as plt
from datetime import datetime
from pathlib import Path
from torchmetrics.text import CharErrorRate
import numpy as np
import seaborn as sns
from scipy.stats import ttest_rel


# ------------------------------------------------------------------
# 1. Load data & discard REJECTED sessions
# ------------------------------------------------------------------
cer_metric = CharErrorRate()

file_path = Path(r'C:\Users\matth\Desktop\Glamor Lab\vlm-confidence-highlighting-study'
                 r'\study_data\batch_interaction_data\smartsplit_q20_i20_s89-initial_pilot_5users.json')

with file_path.open() as f:
    raw = json.load(f)

sessions = {sid: rec for sid, rec in raw.items() if rec.get("status") != "REJECTED"}

# ------------------------------------------------------------------
def compute_cer(ground_truth: str, submitted: str) -> float:
    # SPring the spaces in the text to avoid issues with CER calculation
    ground_truth = ground_truth.replace(" ", "")
    submitted = submitted.replace(" ", "")
    cer_value = cer_metric([submitted], [ground_truth]).item()
    return cer_value

rows_q   = []          # question-level rows
rows_tlx = []          # condition-level rows (TLX only)

for uid, rec in sessions.items():

    for cond in ['highlighted', 'non-highlighted']:
        block = rec['interaction_data'].get(cond, {})

        # -------- store TLX ONCE for this user-condition ---------------
        tlx_core = block.get('tlx', {}).get('tlx', {})
        rows_tlx.append({
            "user_id": uid,
            "condition": cond,
            **{k: tlx_core.get(k, 0) for k in
               ["mental_demand", "hurried_demand",
                "performance", "effort", "frustration"]}
        })

        # -------- iterate over the 10 questions ------------------------
        for q in block.get('interactions', []):
            keylogs = q.get('keylogs', [])
            submitted = keylogs[-1].get('new_text', '') if keylogs else ''
            question_number = q.get('question_i', '')
            queue = q.get('url_data',{}).get('queue_id', '')
            gt_path = f'C:/Users/matth/Desktop/Glamor Lab/vlm-confidence-highlighting-study/web/baked_queues/{queue}.json'
            with open(gt_path, 'r') as gt_file: 
                gt_data = json.load(gt_file)
            if (cond == gt_data[0]['condition']):
                gt_list = gt_data[0]['questions'][int(question_number) -1]['answer'] # returns a list of answers
                gt_id = gt_data[0]['questions'][int(question_number) -1]['id']
                model_answer = gt_data[0]['questions'][int(question_number) -1]['predicted_text']
            else:
                gt_list = gt_data[1]['questions'][int(question_number) -1]['answer']
                gt_id = gt_data[1]['questions'][int(question_number) -1]['id']
                model_answer = gt_data[1]['questions'][int(question_number) -1]['predicted_text']


            # choose the answer with the minimum cer, cer = cer(gt_intance, submitted)
            cer_list = [compute_cer(gt, submitted) for gt in gt_list]
            cer = min(cer_list)
            
            # get the best cer for the model answer
            cer_model_list = [compute_cer(gt, model_answer) for gt in gt_list]
            cer_model = min(cer_model_list)

            cer_diff = cer - cer_model # How much the cer changed from the model answer to the user answer. negative is better
            if cer_diff > 0:
                print(f'ground truth: {gt_list}')
                print(f'model:        {model_answer.replace(" ", "")}')
                print(f'user:         {submitted.replace(" ", "")}')
                print('-------------------------------------')
            # get the number of keylogs that are important 
            num_keylogs = 0
            for x in keylogs:
                if x['key_pressed'] is not None:
                    if x['key_pressed'] not in ['Shift', 'ArrowRight', 'Enter', 'Tab', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'AltGraph', 'Control']:
                        num_keylogs += 1

            # should have a change in cer for each question

            rows_q.append({
                "user_id": uid,
                "condition": cond,
                "question":  q['question_i'],
                "question_id": gt_id,
                "num_keylogs": num_keylogs,
                "confidence_rating": float(q['confidence_rating']),
                "cer": cer,
                "cer_diff": cer_diff,
                "time_taken": float(keylogs[-1]['precise_time'])           
            })

# ------------------------------------------------------------------
# 3. Build the two DataFrames
# ------------------------------------------------------------------
df_q   = pd.DataFrame(rows_q)
df_tlx = pd.DataFrame(rows_tlx)

# ------------------------------------------------------------------
# 4. Optional basic plots (uses df_q only here)
# ------------------------------------------------------------------
# plt.figure(figsize=(6,4))
# df_q.groupby('condition')['cer'].mean().plot(kind='bar')
# plt.ylabel("CER"); plt.title("Avg CER by condition"); plt.tight_layout()
# plt.show()

# ------------------------------------------------------------------
# 4. NASA-TLX grouped bar-plot
# ------------------------------------------------------------------
# tlx_cols = ["mental_demand", "hurried_demand",
#             "performance", "effort", "frustration"]

# # average each sub-scale per condition → transpose so TLX types sit on x-axis
# mean_tlx = (df_tlx
#             .groupby("condition")[tlx_cols]
#             .mean()
#             .T)                       # rows = TLX types, columns = conditions

# ax = mean_tlx.plot(kind="bar", figsize=(8, 5))
# ax.set_xlabel("NASA-TLX sub-scale")
# ax.set_ylabel("Average score")
# ax.set_title("Average NASA-TLX scores by condition")
# ax.legend(title="Condition")
# plt.xticks(rotation=0)
# plt.tight_layout()
# plt.show()

# TLX paired t test 
print(" TLX paired t-test results:")
# pivot so each row is one user, columns are conditions
tlx_wide = df_tlx.pivot(index='user_id', columns='condition')

for scale in ["mental_demand","hurried_demand","performance","effort","frustration"]:
    a = tlx_wide[(scale, 'highlighted')]
    b = tlx_wide[(scale, 'non-highlighted')]
    t_stat, p_val = ttest_rel(a, b)
    print(f"{scale:15s}: t = {t_stat:.3f}, p = {p_val:.3f}")



# CER vs confidence scatterplot with regression lines
sns.set(
    style="whitegrid",         # clean background + grid
    context="paper",           # font sizes optimized for print
    font_scale=1.2             # slightly larger labels
)

# —— Create high-dpi figure ——
plt.figure(figsize=(7, 5), dpi=300)

# —— Scatterplot with distinct markers & a dark edge for clarity ——
ax = sns.scatterplot(
    data=df_q,
    x="cer",
    y="confidence_rating",
    hue="condition",
    style="condition",
    palette={"highlighted": "#D95F02", "non-highlighted": "#1B9E77"},
    markers={"highlighted": "o", "non-highlighted": "s"},
    edgecolor="black",
    alpha=0.8,
    s=60
)

# —— Add per-condition regression lines (no extra scatter) ——
for cond, color in [("highlighted", "#D95F02"), ("non-highlighted", "#1B9E77")]:
    subset = df_q[df_q["condition"] == cond]
    sns.regplot(
        data=subset,
        x="cer",
        y="confidence_rating",
        scatter=False,
        color=color,
        line_kws={"linestyle": "--", "linewidth": 1.5}
    )

# —— Labels, title, legend —— 
ax.set_xlabel("Character Error Rate (CER)", labelpad=8)
ax.set_ylabel("Confidence Rating", labelpad=8)
ax.set_title("User Confidence vs. Transcription Accuracy\nby Interface Condition", pad=12)

# Move legend inside, shrink text slightly
leg = ax.legend(title="Condition", loc="upper right", frameon=True)
leg._legend_box.align = "left"
for text in leg.get_texts():
    text.set_fontsize("small")

# Remove top/right spines for a cleaner look
sns.despine(trim=True)
# …all your plotting code up through sns.despine()…

# instead of a plain tight_layout(), do:
plt.tight_layout(rect=[0, 0.05, 1, 0.95])

# plt.show()



####### Question counts ########
counts = (
    df_q
    .groupby(['question_id', 'condition'])
    .size()
    .reset_index(name='n')
)

# 2. Pivot so each row is a question_id, columns are conditions
pivot = counts.pivot(index='question_id',
                     columns='condition',
                     values='n') \
              .fillna(0) \
              .astype(int)

print(pivot)



####### Statistical analysis ########
####### Paired t test ########
print ("Paired t-test results:")

# … after df_q is built and you've created df_user …

# 1) Ensure those df_q columns are numeric:
numeric_cols = ['cer', 'time_taken', 'confidence_rating', 'num_keylogs', 'cer_diff']
df_q[numeric_cols] = df_q[numeric_cols].apply(pd.to_numeric, errors='raise')

# 2) Build per-user averages
df_user = (
    df_q
      .groupby(['user_id', 'condition'])
      .agg(
        cer_mean         = ('cer',              'mean'),
        time_mean        = ('time_taken',       'mean'),
        confidence_mean  = ('confidence_rating','mean'),
        keylogs_mean     = ('num_keylogs',      'mean'),
        cer_diff_mean    = ('cer_diff',        'mean'),
      )
      .reset_index()
)

# 3) Summary (mean ± SD) for only the numeric metrics
metrics = ['cer_mean', 'time_mean', 'confidence_mean', 'keylogs_mean', 'cer_diff_mean']
summary = (
    df_user
      .groupby('condition')[metrics]
      .agg(['mean','std'])
      .round(3)
)
print("Summary (mean ± SD):\n", summary)

# 4) Paired t-tests on those same metrics
pivot = df_user.pivot(index='user_id', columns='condition')
for met in metrics:
    a = pivot[(met, 'highlighted')]
    b = pivot[(met, 'non-highlighted')]
    t, p = ttest_rel(a, b)
    print(f"{met}: t={t:.3f}, p={p:.3f}")


############### Independent T test ############
print("Independent t-test results:")
# 1) Summary stats per condition (trial‐level)
metrics = ['cer','time_taken','confidence_rating','num_keylogs', 'cer_diff']
summary = (
    df_q
      .groupby('condition')[metrics]
      .agg(['mean','std'])
      .round(3)
)
print(summary)

# 2) Independent t-tests (not recommended for within-subjects)
from scipy.stats import ttest_ind
for m in metrics:
    a = df_q[df_q.condition=='highlighted'][m]
    b = df_q[df_q.condition=='non-highlighted'][m]
    t, p = ttest_ind(a, b, equal_var=False)
    print(f"{m}: t={t:.3f}, p={p:.3f}")
