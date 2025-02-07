import { DEVMODE } from "./globals"
export var UID: string
export var MOCKMODE: boolean = false
import { load_data, log_data } from './connector'
import { paramsToObject } from "./utils"

var data: any[] = []
let question_i = -1
let question: any = null
let userselection_answeronly: number = -1
let userselection_withexplanation: number = -1
let userselection_withexplanationquality: number = -1
let confidenceRating: number = -1;
let part1Timer: number = 0;
let part1Interval: number = 0;
let remainingTime: number = 20;



let balance = 0
let balance_increment = 0.1     // Balance updates by $0.10 for every correct selection

let instruction_i: number = 0
let count_exited_page: number = 0

function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

function registerAnswerOnlyUserSelection(user_choice: number) {
    userselection_answeronly = user_choice

    $("#button_answeronly_usertrusts").attr("disabled", "true")
    $("#button_answeronly_userdistrusts").attr("disabled", "true")
    $("#button_answeronly_userunsure").attr("disabled", "true")
    if (user_choice == 0) {
        $("#button_answeronly_usertrusts").attr("activedecision", "true")
    } else if (user_choice == 1) {
        $("#button_answeronly_userdistrusts").attr("activedecision", "true")
    } else if (user_choice == 2) {
        $("#button_answeronly_userunsure").attr("activedecision", "true")
    }
    $("#ai_explanation_div").show()
}
// Event listener for the button click
document.getElementById('button_answeronly_usertrusts')?.addEventListener('click', () => registerAnswerOnlyUserSelection(0));
document.getElementById('button_answeronly_userdistrusts')?.addEventListener('click', () => registerAnswerOnlyUserSelection(1));
document.getElementById('button_answeronly_userunsure')?.addEventListener('click', () => registerAnswerOnlyUserSelection(2));


function registerWithExplanationUserSelection(user_choice: number) {
    userselection_withexplanation = user_choice

    $("#button_withexplanation_usertrusts").attr("disabled", "true")
    $("#button_withexplanation_userdistrusts").attr("disabled", "true")
    $("#button_withexplanation_userunsure").attr("disabled", "true")
    if (user_choice == 0) {
        $("#button_withexplanation_usertrusts").attr("activedecision", "true")
    } else if (user_choice == 1) {
        $("#button_withexplanation_userdistrusts").attr("activedecision", "true")
    } else if (user_choice == 2) {
        $("#button_withexplanation_userunsure").attr("activedecision", "true")
    }
    $("#ai_explanation_quality_div").show()
}

document.getElementById('button_withexplanation_usertrusts')?.addEventListener('click', () => registerWithExplanationUserSelection(0));
document.getElementById('button_withexplanation_userdistrusts')?.addEventListener('click', () => registerWithExplanationUserSelection(1));
document.getElementById('button_withexplanation_userunsure')?.addEventListener('click', () => registerWithExplanationUserSelection(2));
  
function registerWithExplanationQualityUserSelection(user_choice: number) {
    userselection_withexplanationquality = user_choice

    $("#button_withexplanationquality_usertrusts").attr("disabled", "true")
    $("#button_withexplanationquality_userdistrusts").attr("disabled", "true")
    $("#button_withexplanationquality_userunsure").attr("disabled", "true")
    if (user_choice == 0) {
        $("#button_withexplanationquality_usertrusts").attr("activedecision", "true")
    } else if (user_choice == 1) {
        $("#button_withexplanationquality_userdistrusts").attr("activedecision", "true")
    } else if (user_choice == 2) {
        $("#button_withexplanationquality_userunsure").attr("activedecision", "true")
    }
    $("#button_next").show()
    $("#button_next").removeAttr("disabled")
}

document.getElementById('button_withexplanationquality_usertrusts')?.addEventListener('click', () => registerWithExplanationQualityUserSelection(0));
document.getElementById('button_withexplanationquality_userdistrusts')?.addEventListener('click', () => registerWithExplanationQualityUserSelection(1));
document.getElementById('button_withexplanationquality_userunsure')?.addEventListener('click', () => registerWithExplanationQualityUserSelection(2));




function next_instructions(increment: number) {
    instruction_i += increment

    if (instruction_i == 0) {
        $("#button_instructions_prev").attr("disabled", "true")
    } else {
        $("#button_instructions_prev").removeAttr("disabled")
    }
    if (instruction_i >= 5) {
        $("#instructions_and_decorations").show()
        $("#button_instructions_next").val("Start study")
    } else {
        $("#instructions_and_decorations").hide()
        $("#button_instructions_next").val("Next")
    }
    if (instruction_i == 6) {
        $("#instructions_and_decorations").show()
        $("#main_box_instructions").hide()
        $("#main_box_experiment").show()
        next_question()
    }

    $("#main_box_instructions").children(":not(input)").each((_, el) => {
        $(el).hide()
    })
    $(`#instructions_${instruction_i}`).show()
}
$("#button_instructions_next").on("click", () => next_instructions(+1))
$("#button_instructions_prev").on("click", () => next_instructions(-1))

$("#button_next").on("click", () => {

    // Update the user balance
    let old_balance = balance
    update_balance()

    if (question_i != -1) {
        let logged_data = {
            "question_i": question_i,
            "user_selections": {
                "answeronly": userselection_answeronly,
                "withexplanation": userselection_withexplanation,
                "withexplanationquality": userselection_withexplanationquality
            },
            "user_is_correct": {
                "answeronly": is_user_correct(userselection_answeronly),
                "withexplanation": is_user_correct(userselection_withexplanation),
                "withexplanationquality": is_user_correct(userselection_withexplanationquality)
            },
            "balance": {
                "old": old_balance,
                "new": balance
            }
        }

        logged_data['question'] = question
        logged_data['count_exited_page'] = count_exited_page
        log_data(logged_data)
        count_exited_page = 0
    }
    

    next_question()
});



function is_user_correct(selection) {
    if (selection != 2) {
        let correct_selection = 1 - question["prediction_is_correct"] // 0 if AI is correct, 1 if incorrect
        return selection == correct_selection ? 1 : 0
    }
    return -1
}

function update_balance() {
    if (userselection_withexplanationquality != 2) {
        let correct_selection = 1 - question["prediction_is_correct"] // 0 if AI is correct, 1 if incorrect
        if (userselection_withexplanationquality == correct_selection) {
            balance += balance_increment
        }
    }
}

function next_question() {
    // restore previous state of UI

    $("#button_readytoanswer").removeAttr("activedecision")
    $("#button_readytoanswer").removeAttr("disabled")
    $("#button_readytoanswer").show()

    $("#button_answeronly_usertrusts").removeAttr("activedecision")
    $("#button_answeronly_usertrusts").removeAttr("disabled")
    $("#button_answeronly_userdistrusts").removeAttr("activedecision")
    $("#button_answeronly_userdistrusts").removeAttr("disabled")
    $("#button_answeronly_userunsure").removeAttr("activedecision")
    $("#button_answeronly_userunsure").removeAttr("disabled")

    $("#button_withexplanation_usertrusts").removeAttr("activedecision")
    $("#button_withexplanation_usertrusts").removeAttr("disabled")
    $("#button_withexplanation_userdistrusts").removeAttr("activedecision")
    $("#button_withexplanation_userdistrusts").removeAttr("disabled")
    $("#button_withexplanation_userunsure").removeAttr("activedecision")
    $("#button_withexplanation_userunsure").removeAttr("disabled")

    $("#button_withexplanationquality_usertrusts").removeAttr("activedecision")
    $("#button_withexplanationquality_usertrusts").removeAttr("disabled")
    $("#button_withexplanationquality_userdistrusts").removeAttr("activedecision")
    $("#button_withexplanationquality_userdistrusts").removeAttr("disabled")
    $("#button_withexplanationquality_userunsure").removeAttr("activedecision")
    $("#button_withexplanationquality_userunsure").removeAttr("disabled")

    $("#ai_explanation_div").hide()
    $("#ai_explanation_quality_div").hide()
    

    $("#button_next").hide()
    $('#button_quit').hide()
    //$("#range_val").val(user_trust)

    question_i += 1;
    if (question_i >= data.length) {
        // Hide the experiment container.
        $("#main_box_experiment").hide();
        $("#qualitative_section").show();
        return;
    }

    
    // Retrieve the current question object.
    question = data[question_i];
    
    // Always show Part 1 and hide Part 2 when a new question loads.
    $("#part1").show();
    $("#part2").hide();
    
    // --- Update Part 1 elements ---
    // For the image: assume a valid Base64 string for now.
    if (question["image"]) {
      $("#question_image").attr("src", "data:image/png;base64," + question["image"]);
    } else {
      $("#question_image").attr("src", "");
    }
    
    // Display the predicted text.
    // Build the predicted text HTML by concatenating token_info
    let predictedHtml = "";
    if (question["token_info"] && Array.isArray(question["token_info"])) {
        predictedHtml = question["token_info"]
            // Skip the end token
            .filter(item => item.token !== "<|im_end|>")
            .map(item => {
                // Replace the special "Ġ" character with a space
                let tokenText = item.token.replace(/Ġ/g, " ");
                // Get the probability from the first candidate in top_5_tokens.
                // If not available, default to 1 (no highlight).
                let prob = (item.top_5_tokens &&
                            item.top_5_tokens[0] &&
                            typeof item.top_5_tokens[0].probability === "number")
                            ? item.top_5_tokens[0].probability
                            : 1;
                // Compute the highlight intensity (0 if probability is 1, 1 if probability is 0)
                let intensity = 1 - prob;
                // Create a span with red background; adjust the opacity by intensity.
                if (question["is_highlighted"] == 1) {
                    return `<span style="background-color: rgba(255, 0, 0, ${intensity});">${tokenText}</span>`;
                } else {
                    return tokenText;
                }
            })
            .join('');
    }
    $("#predicted_text").html(predictedHtml);

    if (question["is_highlighted"] == 1) {
        $("#predicted_text_container strong").addClass("highlighted-title");
      } else {
        $("#predicted_text_container strong").removeClass("highlighted-title");
      }
      
    
    // Concatenate tokens (with replacement of Ġ and skipping <|im_end|>).
    let tokensConcatenated = "";
    if (question["token_info"] && Array.isArray(question["token_info"])) {
        tokensConcatenated = question["token_info"]
          .map(item => item.token)
          .filter(token => token !== "<|im_end|>")
          .map(token => token.replace(/Ġ/g, " "))
          .join('');
    }
    $("#token_input").val(tokensConcatenated);
    
    // (Update progress and other elements as necessary)
    $("#progress").text(`Progress: ${question_i + 1} / ${data.length}`);

    // Start a 20-second timer for Part 1
    // Clear any existing timer (just in case)
    clearTimeout(part1Timer);
    part1Timer = window.setTimeout(autoSubmitPart1, 20000);
    // Reset and start the timer for Part 1
    remainingTime = 20;
    $("#timer").text(remainingTime);
    $("#timer").show();

    // Clear any previous interval
    if (part1Interval) {
        clearInterval(part1Interval);
    }

    // Start a new interval that counts down every second
    part1Interval = window.setInterval(() => {
        remainingTime -= 1;
        $("#timer").text(remainingTime);
        if (remainingTime <= 0) {
            clearInterval(part1Interval);
            // Auto-submit Part 1 if time expires
            autoSubmitPart1();
            $("#timer").hide();
        }
    }, 1000);


}

// get user id and load queue
// try to see if start override was passed
const urlParams = new URLSearchParams(window.location.search);
const startOverride = urlParams.get('start');
const UIDFromURL = urlParams.get("uid")
globalThis.url_data = paramsToObject(urlParams.entries())

if (globalThis.url_data['study_id'] == null) {
    globalThis.url_data['study_id'] = "demo_study"
}
if (globalThis.url_data['prolific_id'] == null) {
    globalThis.url_data['prolific_id'] = "demo_user"
}
if (globalThis.url_data['session_id'] == null) {
    globalThis.url_data['session_id'] = "demo_session"
}

if (UIDFromURL != null) {
    globalThis.uid = UIDFromURL as string
    if (globalThis.uid == "prolific_random") {
        let queue_id = `${Math.floor(Math.random() * 10)}`.padStart(3, "0")
        globalThis.uid = `${urlParams.get("prolific_queue_name")}/${queue_id}`
    }
} else if (DEVMODE) {
    globalThis.uid = "demo"
} else {
    let UID_maybe: any = null
    while (UID_maybe == null) {
        UID_maybe = prompt("Enter your user id. Please get in touch if you were not assigned an id but wish to participate in this experiment.")
    }
    globalThis.uid = UID_maybe!
}

// version for paper
if (DEVMODE) {
    MOCKMODE = true
} else if (globalThis.url_data['session_id'].startsWith("demo")) {
    MOCKMODE = true
}

console.log("Running with UID", globalThis.uid)
load_data().catch((_error) => {
    //alert("Invalid user id.")
    console.log("Invalid user id.")
    console.log(globalThis.uid!)
    window.location.reload()
}
).then((new_data) => {
    data = new_data
    if (startOverride != null) {
        question_i = parseInt(startOverride) - 1
        console.log("Starting from", question_i)
    }
    // next_question()
    next_instructions(0)
    $("#main_box_instructions").show()
    $("#instructions_and_decorations").hide()
})

console.log("Starting session with UID:", globalThis.uid!)

let alert_active = false
document.onvisibilitychange = () => {
    if (!alert_active) {
        count_exited_page += 1
        alert_active = true
        //if (!(globalThis.uid!.startsWith("demo"))) {
        //    alert("Please don't leave the page. If you do so again, we may restrict paying you.")
        //}
        alert_active = false
    }
}

// When the DOM is ready:
$(document).ready(() => {
    // Transition from Part 1 (question) to Part 2 (confidence rating)
    $("#button_next_part1").on("click", () => {
      // Optionally, log or save any Part 1 data here.
      clearTimeout(part1Timer);
      $("#timer").hide();


      $("#part1").hide();
      $("#part2").show();
    });
  
    // Handle confidence rating selections:
    $(".confidence-button").on("click", function() {
        let rating = parseInt($(this).attr("data-rating") as string);
        // Remove 'selected' from all buttons, then add it to the clicked one.
        $(".confidence-button").removeClass("selected");
        $(this).addClass("selected");
        // Store the rating and enable the Part 2 Next button.
        confidenceRating = rating;
        $("#button_next_part2").removeAttr("disabled");
    });
  
    // Transition from Part 2 (confidence rating) to the next question.
    $("#button_next_part2").on("click", () => {
      // Log the confidence rating along with other data if needed.
      let logged_data = {
        "question_i": question_i,
        "confidence_rating": confidenceRating,
        // ... include other logging fields as desired
      };
      log_data(logged_data);
      
      // Reset Part 2 UI elements for the next question.
      $("#button_next_part2").attr("disabled", "true");
      $(".confidence-button").removeClass("selected");
      confidenceRating = -1;
      
      // Switch back to Part 1 and load the next question.
      $("#part2").hide();
      $("#part1").show();
      next_question();
    });
  });
  function autoSubmitPart1() {
    // Stop the timer if not already cleared
    clearInterval(part1Interval);
    $("#timer").hide();
    
    // Automatically transition to Part 2
    $("#part1").hide();
    $("#part2").show();
}
$("#qual_next").on("click", () => {
    const q1 = ($("#qual_q1").val() as string) || "";
    const q2 = ($("#qual_q2").val() as string) || "";
    const q3 = ($("#qual_q3").val() as string) || "";
    
    let valid = true;
    
    if (q1.length < 25) {
        $("#warn_q1").show();
        valid = false;
    } else {
        $("#warn_q1").hide();
    }
    
    if (q2.length < 25) {
        $("#warn_q2").show();
        valid = false;
    } else {
        $("#warn_q2").hide();
    }
    
    if (q3.length < 25) {
        $("#warn_q3").show();
        valid = false;
    } else {
        $("#warn_q3").hide();
    }
    
    // If validation fails, do not proceed
    if (!valid) {
        return;
    }
    
    // If all text boxes have at least 50 characters, log data and proceed
    const finalData = {
        qualitative: {
            q1: q1,
            q2: q2,
            q3: q3
        },
        // ... include any additional data if needed
    };
    log_data(finalData);
    
    // Transition to end-of-survey “Thank you” screen or similar.
    $("#qualitative_section").hide();
    if (MOCKMODE) {
        $('#reward_box_mock').text(`Your total reward is $${balance.toFixed(2)} (${question_i} questions answered) + $2.`);
        $('#reward_box_mock').show();
        $("#main_box_end_mock").show();    
    } else {
        $('#reward_box').text(`Your total reward is $${balance.toFixed(2)} (${question_i} questions answered) + $2.`);
        $('#reward_box').show();
        $("#main_box_end").show();    
    }
});
