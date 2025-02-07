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
        // (Handle end-of-study here)
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
    $("#predicted_text").html(question["predicted_text"]);
    
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
      $("#part1").hide();
      $("#part2").show();
    });
  
    // Handle confidence rating selections:
    $(".confidence-button").on("click", function() {
      let rating = parseInt($(this).attr("data-rating") as string);
      // Clear previous selections:
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
  