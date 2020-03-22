console.log("Echo from repertoire.js");

function min(a, b) {
    if (a < b) {
        return a;
    } else {
        return b;
    }
}

function max(a, b) {
    if (a > b) {
        return a;
    } else {
        return b;
    }
}

function initEvaluationBar(bar, value) {
    let filler = document.createElement("div");
    filler.classList.add("evaluation_bar__fill");
    let evalLabel = document.createElement("div");
    evalLabel.innerHTML = value;
    evalLabel.classList.add("evaluation_bar__label");
    if (value.includes("-")) {
        evalLabel.classList.add("evaluation_bar__label--black");
    } else {
        evalLabel.classList.add("evaluation_bar__label--white");
    }
    bar.appendChild(filler);
    bar.appendChild(evalLabel);
    if (value.includes("M")) {
        if (value.includes("-")) {
            filler.style.height = "0%";
        } else {
            filler.style.height = "100%";
        }
    } else {
        let floatVal = parseFloat(value);
        let relWidth = min(100, max(0, floatVal * 12.5 + 50.0));
        filler.style.height = relWidth + "%";
    }
}
