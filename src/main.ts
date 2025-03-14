import { DEVMODE } from "./globals"
export var UID: string
export var MOCKMODE: boolean = false
import { load_data, log_data } from './connector'
import { paramsToObject } from "./utils"

var data: any[] = []
let question: any = null
let userselection_answeronly: number = -1
let userselection_withexplanation: number = -1
let userselection_withexplanationquality: number = -1
let confidenceRating: number = -1;
let part1Timer: number = 0;
let part1Interval: number = 0;
let remainingTime: number = 20;
let currentConditionIndex = 0;
let currentQuestionIndex = 0;




let balance = 0
let balance_increment = 0.1     // Balance updates by $0.10 for every correct selection

let instruction_i: number = 0
let count_exited_page: number = 0

function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

function checkPreSurvey(): boolean {
    const latexExp = $("input[name='latexExperience']:checked").val();
    const latexFreq = $("input[name='latexFrequency']:checked").val();
    const chatbotFreq = $("input[name='chatbotFrequency']:checked").val();
  
    if (latexExp && latexFreq && chatbotFreq) {
      $("#button_instructions_next").show();
      return true;
    } else {
      $("#button_instructions_next").hide();
      return false;
    }
}


function next_instructions(increment: number) {
    instruction_i += increment

    if (instruction_i == 0) {
        $("#button_instructions_prev").attr("disabled", "true")
    } else {
        $("#button_instructions_prev").removeAttr("disabled")
    }
    if(instruction_i == 4 && !checkPreSurvey()) {
        $("#button_instructions_next").attr("disabled", "true")
        $("#button_instructions_next").hide()
    }
    else{
        $("#button_instructions_next").removeAttr("disabled")
        $("#button_instructions_next").show()
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
        // Reset our condition indices before starting the experiment

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

    if (currentQuestionIndex > 0) {
        let logged_data = {
            "question_i": currentQuestionIndex,
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

/* New function: Show start-of-condition page */
function showStartConditionPage(condition: string) {
    $("#main_box_experiment").hide();
    // Clear the container once.
    $("#start_condition_page").empty().show();

    // Determine header text based on condition.
    const headerText = (condition === "highlighted") 
                         ? "Uncertainty Highlighted Section" 
                         : "Non-Highlighted Section";

    // Create a flex container with header and Start Experiment button.
    const headerHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0;">${headerText}</h2>
          <input id="start_condition_next" type="button" value="Start Experiment" style="margin: 0;"/>
      </div>
    `;
    $("#start_condition_page").append(headerHtml);

    // Append a container for the practice round content if not already present.
    if ($("#practice_container").length === 0) {
      $("#start_condition_page").append('<div id="practice_container" style="margin-top:10px;"></div>');
    }

    loadPracticeQuestions().then((data) => {
        practiceQuestions = data;
        console.log("Practice questions loaded:", practiceQuestions);
        practiceIndex = 0; // Start at the first practice question.
        // Launch the practice round.
        showPracticeRound(() => {
          // When practice is complete, resume the normal experiment flow.
          // (At this point, you can now safely update experiment state.)
          currentQuestionIndex = 1;
          next_question();
        });
      }).catch((err) => {
        console.error("Error loading practice questions:", err);
      });
    

    $("#start_condition_next").on("click", () => {
        $("#start_condition_page").hide();
        // After start page, begin with first question (set index to 1)
        currentQuestionIndex = 1;
        next_question();
    });
}
let practiceQuestions: any[] = [];
let practiceIndex: number = 0;

// Function to load practice questions (assumes a JSON file with an array of example questions)
function loadPracticeQuestions(): Promise<any[]> {
  return new Promise<any[]>((resolve, reject) => {
    $.getJSON("practice_questions/Qwen_practice_Qs.json")
      .done(data => resolve(data))
      .fail((jqxhr, textStatus, error) => reject(error));
  });
}
function showPracticeRound(onComplete: () => void) {
    // Instead of emptying the entire page, update only the practice container.
    $("#practice_container").empty().show();
  
    // Build the practice round content inside a fixed container.
    const practiceContent = $(`
      <div id="practice_inner_container" style="padding: 20px; padding-top:0px; overflow-y: auto;">
        <div id="practice_header"></div>
        <div id="practice_content" style="margin-top: 10px;"></div>
        <div id="practice_nav" style="margin-top: 20px; margin-bottom: 25px;"></div>
      </div>
    `);
    $("#practice_container").append(practiceContent);
  
    // Set header for the practice round.
    $("#practice_header").html(`<h2>Practice Round (${practiceIndex + 1} of ${practiceQuestions.length})</h2>`);
  
    // Build content: image, predicted text, and input.
    const contentHtml = `
      <div id="practice_question_display" style="margin-top: 10px;">
        <img id="practice_question_image" src="" alt="Practice Question Image" style="max-width: 100%; height: 110px; object-fit: contain;margin-top: 20px;">
        <div id="practice_predicted_text_container" style="margin-top: 20px;">
          <div style="margin-top: 10px;">Predicted Text:</div>
          <div id="practice_predicted_text" style="margin-top: 20px;"></div>
        </div>
        <div id="practice_token_input_container" style="margin-top: 20px;">
          <input id="practice_token_input" type="text" style="width: 100%; font-size: 16px; padding: 8px;">
        </div>
      </div>
    `;
    $("#practice_content").html(contentHtml);
  
    // Get the current practice question.
    const question = practiceQuestions[practiceIndex];
  
    // Set the question image.
    if (question["image"]) {
      $("#practice_question_image").attr("src", "data:image/png;base64," + question["image"]);
    } else {
      $("#practice_question_image").attr("src", "");
    }
  
    // Render predicted text using token_info.
    let predictedHtml = "";
    if (question["token_info"] && Array.isArray(question["token_info"])) {
      predictedHtml = question["token_info"]
        .filter(item => item.token !== "<|im_end|>")
        .map(item => {
          const tokenText = item.token.replace(/Ġ/g, " ");
          const prob = (item.top_5_tokens &&
                        item.top_5_tokens[0] &&
                        typeof item.top_5_tokens[0].probability === "number")
                        ? item.top_5_tokens[0].probability
                        : 1;
          // Use the global condition from the main data to decide whether to apply highlighting.
          if (data[currentConditionIndex].condition === "highlighted") {
            const intensity = 1 - prob;
            return `<span style="background-color: rgba(255, 0, 0, ${intensity});">${tokenText}</span>`;
          } else {
            return tokenText;
          }
        })
        .join('');
    }
    $("#practice_predicted_text").html(predictedHtml);
  
    // Prepopulate the text input.
    let tokensConcatenated = "";
    if (question["token_info"] && Array.isArray(question["token_info"])) {
      tokensConcatenated = question["token_info"]
        .map(item => item.token)
        .filter(token => token !== "<|im_end|>")
        .map(token => token.replace(/Ġ/g, " "))
        .join('');
    }
    $("#practice_token_input").val(tokensConcatenated);
  
    // Build navigation buttons.
    const navHtml = `
      <div>
        <input id="practice_prev" type="button" value="Previous Example">
        <input id="practice_next" type="button" value="Next Example" style="margin-left: 10px;">
      </div>
    `;
    $("#practice_nav").html(navHtml);
  
    // Attach button handlers.
    $("#practice_prev").off("click").on("click", () => {
      practiceIndex = (practiceIndex - 1 + practiceQuestions.length) % practiceQuestions.length;
      showPracticeRound(onComplete);
    });
    $("#practice_next").off("click").on("click", () => {
      practiceIndex = (practiceIndex + 1) % practiceQuestions.length;
      showPracticeRound(onComplete);
    });
  }
  


/* New function: Show end-of-condition page */
function showEndConditionPage(condition: string) {
    $("#main_box_experiment").hide();
    const currentCondition = data[currentConditionIndex].condition;
    $("#condition_label").text(currentCondition);
    // Reset each slider to a default, e.g., 0
    $("#mental_demand").val("0");
    $("#hurried_demand").val("0");
    $("#performance").val("0");
    $("#effort").val("0");
    $("#frustration").val("0");

    $("#nasa_tlx_survey").show();
   
}



function next_question() {
    // restore previous state of UI
    $("#main_box_experiment").show();
    $("#button_next").hide()
    $('#button_quit').hide()
    //$("#range_val").val(user_trust)
    console.log("question index, condition index", currentQuestionIndex, currentConditionIndex)        

    if (currentConditionIndex >= data.length) {
        $("#main_box_experiment").hide();
        $("#qualitative_section").show();
        return;
    }
    let conditionBlock = data[currentConditionIndex];
    console.log("Condition block", conditionBlock)
    console.log(data)

    // If we are at the start page for this condition, show it.
    if (currentQuestionIndex === 0) {
        showStartConditionPage(conditionBlock.condition);
        return;
    }

    // If we've gone past all questions in this condition, show the end-of-condition page.
    if (currentQuestionIndex > conditionBlock.questions.length) {
        showEndConditionPage(conditionBlock.condition);
        return;
    }


    question = conditionBlock.questions[currentQuestionIndex - 1];
    console.log("Question", currentQuestionIndex, question)
    
    
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
                if (data[currentConditionIndex].condition == "highlighted") {
                    return `<span style="background-color: rgba(255, 0, 0, ${intensity});">${tokenText}</span>`;
                } else {
                    return tokenText;
                }
            })
            .join('');
    }
    $("#predicted_text").html(predictedHtml);
      
    
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
    $("#progress").text(`Section ${currentConditionIndex + 1} of ${data.length} | Question ${currentQuestionIndex} of ${conditionBlock.questions.length}`);
        // Always show Part 1 and hide Part 2 when a new question loads.
        $("#part1").show();
        $("#part2").hide();
    
// At the end of next_question(), after updating all Part 1 elements:
$("#token_input_container").hide();
$("#button_next_part1").hide();

// Start a 20-second timer for Part 1
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

    // When there are 15 seconds or less remaining, show the input box and Next button
    if (remainingTime <= 15) {
        $("#token_input_container").show();
        $("#button_next_part1").show();
    }

    if (remainingTime <= 0) {
        clearInterval(part1Interval);
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
        currentQuestionIndex = parseInt(startOverride) - 1
        console.log("Starting from", currentQuestionIndex)
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
        "question_i": currentQuestionIndex,
        "condition_i": currentConditionIndex,
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
      currentQuestionIndex++;
      next_question();
    });
    $("input[name='latexExperience'], input[name='latexFrequency'], input[name='chatbotFrequency']").on("change", () => {
        if(checkPreSurvey()) {
            $("#button_instructions_next").removeAttr("disabled")
            $("#button_instructions_next").show()            
        }

    });
    // keylog the input
    $("#token_input").on("input", function() {
        let currentText = $(this).val();
        console.log("User input:", currentText);
    }
    );

    // Define an interface for slider tracking
interface SliderState {
    mental_demand: boolean;
    hurried_demand: boolean;
    performance: boolean;
    effort: boolean;
    frustration: boolean;
}

// Initialize tracking object
const sliderChanged: SliderState = {
    mental_demand: false,
    hurried_demand: false,
    performance: false,
    effort: false,
    frustration: false
};

// Function to check if all sliders have been adjusted
function checkAllSlidersChanged(): boolean {
    return Object.values(sliderChanged).every(value => value === true);
}
function resetSliders() {
    // Reset tracking object
    for (let key in sliderChanged) {
        sliderChanged[key as keyof SliderState] = false;
    }

    // Reset slider values to 0
    $(".nasa-tlx-range").val("0");

    // Disable the "Next" button again
    nextButton.prop("disabled", true);
}

// Disable the "Next" button initially
const nextButton = $("#nasa_tlx_next") as JQuery<HTMLInputElement>;
nextButton.prop("disabled", true);

// Event listener for all sliders
$(".nasa-tlx-range").on("input", function () {
    const sliderId = $(this).attr("id") as keyof SliderState;
    
    // Ensure that the slider exists in our tracking object
    if (sliderId in sliderChanged) {
        const sliderValue = $(this).val();
        if (sliderValue !== "0") {
            sliderChanged[sliderId] = true;
        }

        // Enable the "Next" button if all sliders have been changed
        if (checkAllSlidersChanged()) {
            nextButton.prop("disabled", false);
        }
    }
});

// Event listener for "Next" button in NASA TLX survey
nextButton.on("click", () => {
    if (!checkAllSlidersChanged()) {
        alert("Please adjust all sliders before continuing.");
        return;
    }

    // Gather slider values safely
    const mentalDemand = ($("#mental_demand").val() as string) || "0";
    const hurriedDemand = ($("#hurried_demand").val() as string) || "0";
    const performance = ($("#performance").val() as string) || "0";
    const effort = ($("#effort").val() as string) || "0";
    const frustration = ($("#frustration").val() as string) || "0";

    // Log the data
    const tlxData = {
        mental_demand: parseInt(mentalDemand),
        hurried_demand: parseInt(hurriedDemand),
        performance: parseInt(performance),
        effort: parseInt(effort),
        frustration: parseInt(frustration)
    };

    log_data({
        condition: $("#condition_label").text(),
        tlx: tlxData
    });

    // Hide the NASA TLX page and move on
    resetSliders();
    $("#nasa_tlx_survey").hide();
    currentConditionIndex++;
    currentQuestionIndex = 0;
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
    
    if (q3.length < 0) {
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
        $('#reward_box_mock').text(`Your total reward is $3.00.`);
        $('#reward_box_mock').show();
        $("#main_box_end_mock").show();    
    } else {
        $('#reward_box').text(`Your total reward is $3.00.`);
        $('#reward_box').show();
        $("#main_box_end").show();    
    }
});
