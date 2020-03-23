console.log("Echo from explore.js");


function createBoardCallback(uid) {
    let callback = (fen) => {
        let request = new XMLHttpRequest();
        request.open("POST", findEntryUrl, true);
        request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        request.onload = function() {
            if (request.readyState === 4 && request.status == 200) {
                if (request.response.trim() != "null") {
                    window.location.href = request.response;
                }
            }
        }
        request.send("csrfmiddlewaretoken=" + csrfToken + "&fen=" + fen.split(" ")[0] + "&uid=" + uid);
    }
    return callback;
}

function slugify(string) {
    return string.toLowerCase().replace(/[\+#\.]/g, "").replace(/ /g, "-");
}

function filterLine(line) {
    if (line.classList.contains("disable_mutations")) {
        return null;
    }
    line.classList.add("disable_mutations");
    let text = line.textContent.split(" ");
    line.innerHTML = "";
    // line.classList.add("line");
    for (let i = 0; i < text.length; i++) {
        if (/\d+\./.test(text[i])) {
            let span = document.createElement("span");
            span.textContent = text[i];
            span.classList.add("move_number");
            line.appendChild(span);
        } else {
            let prefix = slugify(text.slice(0, i + 1).join(" "));
            let link = document.createElement("a");
            link.href = "/chess/explore/" + prefix;
            link.textContent = text[i];
            link.classList.add("move");
            line.appendChild(link);
        }
    }
    setTimeout(function () {
        line.classList.remove("disable_mutations");
    }, 100);

}

let lines = document.querySelectorAll(".line");
for (let i = 0; i < lines.length; i++) {
    let target = lines[i];
    filterLine(target);
    let observer = new MutationObserver((mutationRecord, mutationObserver) => {
        if (!target.classList.contains("disable_mutations")) {
            filterLine(target);
        }
    });
    observer.observe(target, {childList: true});
}
