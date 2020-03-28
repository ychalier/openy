console.log("Echo from exercise.js");

const EXERCISE_FAILURE = 0;
const EXERCISE_SUCCESS = 1;

function formatTime(millis) {
    let seconds = Math.floor(millis / 1000);
    let minutes = Math.floor(seconds / 60);
    seconds -= 60 * minutes;
    return (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0": "") + seconds;
}

function initTimer(wrapper) {
    let timer = {};
    timer.timeStart = null
    timer.timeFinish = null
    timer.interval = null
    timer.div = wrapper.querySelector(".exercise__sidebar__timer"),
    timer.start = function() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.timeStart = Date.now();
        this.update();
        this.interval = setInterval(() => {
            this.update();
        }, 100);
    }
    timer.stop = function() {
        clearInterval(this.interval);
        this.timeFinish = Date.now();
        this.div.textContent = formatTime(this.timeFinish - this.timeStart);
        this.interval = null;
    }
    timer.update = function() {
        this.div.textContent = formatTime(Date.now() - this.timeStart);
    }
    return timer;
}

function parseMove(string) {
    let move = {};
    let stringSplit = string.split(" ");
    move.ask = stringSplit[0].trim() == "1";
    move.move = stringSplit[1].trim();
    return move;
}

function initExercise(wrapper, boardStatus, startingPosition, moves, firstMove) {
    let exercise = {};
    exercise.wrapper = wrapper;
    exercise.boardStatus = boardStatus;
    exercise.boardStatus.disabled = true;
    exercise.status = {
        "started": false,
        "finished": false,
        "finishStatus": null,
    }
    exercise.started = false;
    exercise.finished = false;
    exercise.timer = initTimer(wrapper);
    exercise.startingPosition = startingPosition;
    exercise.moves = [];
    exercise.progress = 0;
    exercise.firstMove = firstMove;
    exercise.clickedOnPopup = false;
    exercise.didReceiveUrl = false;
    exercise.receivedUrl = null;

    let movesSplit = moves.split(",");
    exercise.nothingToAsk = true;
    for (let i = 0; i < movesSplit.length; i++) {
        exercise.moves.push(parseMove(movesSplit[i]));
        exercise.nothingToAsk = exercise.nothingToAsk && !exercise.moves[i].ask;
    }

    if (exercise.nothingToAsk) {
        console.log("This exercise has nothing to ask...");
    }

    exercise.start = function() {
        this.wrapper.querySelector(".exercise__start_button").style.display = "none";
        this.wrapper.classList.remove("exercise--blurred");
        this.timer.start();
        this.boardStatus.disabled = false;
        this.status.started = true;
        this.status.finished = false;
        this.status.finishStatus = null;
        this.boardStatus.pushFen(this.startingPosition);
        this.progress = 0;
        this.wrapper.querySelector(".exercise__sidebar__line").textContent = "";
        if (!this.moves[0].ask) {
            this.boardStatus.pushUciMove(this.moves[0].move);
        }
        this.clickedOnPopup = false;
        this.didReceivedUrl = false;
        this.receivedUrl = null;
    }

    exercise.stop = function() {
        this.status.finished = true;
        this.timer.stop();
        this.boardStatus.disabled = true;
        let request = new XMLHttpRequest();
        let self = this;
        if (this.status.finishStatus != null) {
            let url = window.location.href + (this.status.finishStatus == EXERCISE_SUCCESS ? "/success" : "/failure?progress=" + this.progress);
            request.open("GET", url, true);
            request.onload = function() {
                self.receivedUrl = request.responseURL;
                self.didReceiveUrl = true;
                if (self.clickedOnPopup) {
                    window.location.href = self.receivedUrl;
                }
            }
            request.send(null);
        } 
    }

    exercise.fail = function() {
        this.status.finishStatus = EXERCISE_FAILURE;
        this.stop();
        this.wrapper.querySelector("#exercise_popup__failure").classList.add("show");
    }

    exercise.succeed = function() {
        this.status.finishStatus = EXERCISE_SUCCESS;
        this.stop();
        this.wrapper.querySelector("#exercise_popup__success").classList.add("show");
    }

    exercise.checkProgress = function(fen, move) {
        if (this.moves[this.progress].ask) {
            if (this.moves[this.progress].move == move) {
                if (this.progress == this.moves.length - 1) {
                    this.succeed();
                } else {
                    this.progress++;
                }
            } else {
                this.fail();
            }
        } else {
            this.progress++;
        }
        this.wrapper.querySelector(".exercise__sidebar__line").textContent = this.boardStatus.history.line();
        if (this.progress == this.moves.length) { // Finish by a non asked move
            this.stop();
        } else if (!this.moves[this.progress].ask) {
            this.boardStatus.pushUciMove(this.moves[this.progress].move);
        }
    }

    wrapper.querySelector(".exercise__start_button").addEventListener("click", (event) => {
        if (!exercise.status.started) {
            exercise.start();
        }
    });

    wrapper.querySelector(".exercise__sidebar__buttons__restart").addEventListener("click", (event) => {
        if (exercise.status.started) {
            exercise.wrapper.querySelectorAll(".exercise_popup").forEach((item, i) => {
                item.classList.remove("show");
            });
            exercise.start();
        }
    });

    wrapper.querySelector(".exercise__sidebar__buttons__copy").addEventListener("click", (event) => {
        let dummyInput = document.createElement("input");
        document.body.appendChild(dummyInput);
        dummyInput.value = exercise.boardStatus.getFen();
        dummyInput.select();
        document.execCommand("copy", false);
        dummyInput.remove();
    });

    boardStatus.callback = (fen, move) => {
        if (exercise.status.started && !exercise.status.finished) {
            exercise.checkProgress(fen, move);
        }
    }

    wrapper.querySelectorAll(".exercise_popup").forEach((item, i) => {
        item.querySelector(".exercise_popup__button").addEventListener("click", (event) => {
            event.target.parentNode.classList.remove("show");
            exercise.clickedOnPopup = true;
            if (exercise.didReceiveUrl) {
                window.location.href = exercise.receivedUrl;
            }
        });
    });

    if (!exercise.firstMove) {
        exercise.boardStatus.reverse();
    }

    return exercise;
}
