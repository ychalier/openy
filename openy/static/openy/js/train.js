console.log("Echo from train.js");

function initTrainingProcess(program) {
    trainingProcess = {};
    trainingProcess.program = program;
    trainingProcess.index = 0;
    trainingProcess.size = Math.floor(program.length / 2);

    document.getElementById("train__step_total").innerHTML = trainingProcess.size;
    document.getElementById("train__step").innerHTML = trainingProcess.index;
    document.getElementById("train__explore_link").href = trainingProcess.program[2 * trainingProcess.index].href;
    document.getElementById("train__current_line").innerHTML = trainingProcess.program[2 * trainingProcess.index].line;
    document.getElementById("train__trophy").style.display = "none";

    trainingProcess.done = function() {
        return this.index == this.size;
    }

    trainingProcess.getNextTargetFen = function() {
        return this.program[2 * this.index + 1].fen;
    }

    trainingProcess.step = function() {
        this.index++;
        document.getElementById("train__step").innerHTML = trainingProcess.index;
        if (!this.done()) {
            document.getElementById("train__explore_link").href = trainingProcess.program[2 * trainingProcess.index].href;
            document.getElementById("train__current_line").innerHTML = trainingProcess.program[2 * trainingProcess.index].line;
            return this.program[2 * this.index].fen;
        } else {
            document.getElementById("train__trophy").style.display = "block";
            document.getElementById("train__trophy").classList.add("zoom_in");
            document.getElementById("train__explore_link").href = trainingProcess.program[trainingProcess.program.length - 1].href;
            document.getElementById("train__current_line").innerHTML = trainingProcess.program[trainingProcess.program.length - 1].line;
        }
    }

    return trainingProcess;
}

function initTrainingProgram(board, program) {
    let boardStatus = initBoard(board, program[0].fen, null);
    let trainingProcess = initTrainingProcess(program);
    let callback = (fen) => {
        if (!trainingProcess.done()) {
            if (trainingProcess.getNextTargetFen().startsWith(fen)) {
                console.log("Correct move!");
                let nextFen = trainingProcess.step();
                if (nextFen) {
                    boardStatus.pushFen(nextFen);
                } else {
                    console.log("Done!");
                }
            } else {
                console.log("Wrong move...");
                // Wrong try
            }
        }
    }
    boardStatus.callback = callback;

}
