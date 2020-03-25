console.log("Echo from repertoire.js");

function createCamera(originalViewBox) {
    camera = {};
    camera.width = parseFloat(originalViewBox[2]);
    camera.height = parseFloat(originalViewBox[3]);
    camera.scale = 1.0;
    camera.centerX = parseFloat(originalViewBox[0]) + camera.width / 2;
    camera.centerY = parseFloat(originalViewBox[1]) + camera.height / 2;
    camera.moving = false;
    camera.moveStartX = 0;
    camera.moveStartY = 0;
    camera.toViewBox = function() {
        let curWidth = this.width / this.scale;
        let curHeight = this.height / this.scale;
        let curX = this.centerX - curWidth / 2;
        let curY = this.centerY - curHeight / 2;
        return curX + " " + curY + " " + curWidth + " " + curHeight;
    }
    return camera;
}

function initRepertoireStatus() {
    repertoireStatus = {};
    repertoireStatus.div = null;
    repertoireStatus.svg = null;
    repertoireStatus.camera = null;
    repertoireStatus.currentViewBox = {};

    repertoireStatus.getScale = function(targetRadius) {
        let radius = parseFloat(this.svg.querySelector(".node > circle").getAttribute("r"));
        let scaleWidth = this.camera.width * targetRadius / (this.div.offsetWidth * radius);
        let scaleHeight = this.camera.height * targetRadius / (this.div.offsetHeight * radius);
        return (scaleWidth < scaleHeight ? scaleWidth : scaleHeight);
    }

    repertoireStatus.load = function(url) {
        let request = new XMLHttpRequest();
        request.open("GET", url, true);
        let self = this;
        request.onload = function() {
            self.receiveSvg(request);
        }
        request.send(null);
    }

    repertoireStatus.receiveSvg = function(request) {
        if (request.readyState === 4 && request.status == 200) {
            console.log("Received repertoire SVG");
            let buffer = document.createElement("div");
            buffer.innerHTML = request.response.trim();
            this.svg = buffer.children[0];
            this.camera = createCamera(this.svg.getAttribute("viewBox").split(" "));
            this.svg.setAttribute("height", this.div.offsetHeight + "px");
            this.svg.setAttribute("width", this.div.offsetWidth + "px");
            this.svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
            this.div.appendChild(this.svg);

            this.div.addEventListener("wheel", (event) => {
                event.preventDefault();
                if (event.deltaY < 0) {
                    this.camera.scale *= 1.2;
                } else if (event.deltaY > 0) {
                    this.camera.scale /= 1.2;
                }
                this.svg.setAttribute("viewBox", this.camera.toViewBox());
            });

            this.div.addEventListener("mousedown", (event) => {
                this.camera.moving = true;
                this.camera.moveStartX = event.clientX;
                this.camera.moveStartY = event.clientY;
                this.div.style.cursor = "grabbing";
            });
            this.div.addEventListener("touchstart", (event) => {
                this.camera.moving = true;
                this.camera.moveStartX = event.changedTouches[0].clientX;
                this.camera.moveStartY = event.changedTouches[0].clientY;
                this.div.style.cursor = "grabbing";
            });

            window.addEventListener("mousemove", (event) => {
                if (this.camera.moving) {
                    let offsetX = event.clientX - this.camera.moveStartX;
                    let offsetY = event.clientY - this.camera.moveStartY;
                    let movementX = 0.001 * this.camera.width / this.camera.scale;
                    let movementY = 0.001 * this.camera.height / this.camera.scale;
                    this.camera.centerX -= (movementX > movementY ? movementX : movementY) * offsetX;
                    this.camera.centerY -= (movementX > movementY ? movementX : movementY) * offsetY;
                    this.camera.moveStartX = event.clientX;
                    this.camera.moveStartY = event.clientY;
                    this.svg.setAttribute("viewBox", this.camera.toViewBox());
                }
            });
            window.addEventListener("touchmove", (event) => {
                if (this.camera.moving) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    let offsetX = event.changedTouches[0].clientX - this.camera.moveStartX;
                    let offsetY = event.changedTouches[0].clientY - this.camera.moveStartY;
                    let movementX = 0.001 * this.camera.width / this.camera.scale;
                    let movementY = 0.001 * this.camera.height / this.camera.scale;
                    this.camera.centerX -= (movementX > movementY ? movementX : movementY) * offsetX;
                    this.camera.centerY -= (movementX > movementY ? movementX : movementY) * offsetY;
                    this.camera.moveStartX = event.changedTouches[0].clientX;
                    this.camera.moveStartY = event.changedTouches[0].clientY;
                    this.svg.setAttribute("viewBox", this.camera.toViewBox());
                }
            });

            window.addEventListener("mouseup", (event) => {
                this.camera.moving = false;
                this.div.style.cursor = "grab";
            });
            window.addEventListener("touchend", (event) => {
                this.camera.moving = false;
                this.div.style.cursor = "grab";
            });

            let targetUid = this.div.getAttribute("target");
            let targetNode = this.svg.querySelector(".node[uid=\"" + targetUid + "\"] > circle");
            if (targetNode) {
                this.camera.centerX = parseFloat(targetNode.getAttribute("cx"));
                this.camera.centerY = parseFloat(targetNode.getAttribute("cy"));
                this.camera.scale = this.getScale(35);
                this.svg.setAttribute("viewBox", this.camera.toViewBox());
            } else {
                this.camera.scale = 0.8;
                this.svg.setAttribute("viewBox", this.camera.toViewBox());
            }

        }
    }

    return repertoireStatus;
}

function initRepertoire(div, url) {
    repertoireStatus = initRepertoireStatus();
    repertoireStatus.div = div;
    repertoireStatus.load(url);

    let centerButton = div.querySelector("#repertoire_center_button");
    if (centerButton) {
        centerButton.addEventListener("click", (event) => {
            let targetUid = div.getAttribute("target");
            let targetNode = repertoireStatus.svg.querySelector(".node[uid=\"" + targetUid + "\"] > circle");
            if (targetNode) {
                repertoireStatus.camera.centerX = parseFloat(targetNode.getAttribute("cx"));
                repertoireStatus.camera.centerY = parseFloat(targetNode.getAttribute("cy"));
                repertoireStatus.camera.scale = repertoireStatus.getScale(35);
                repertoireStatus.svg.setAttribute("viewBox", repertoireStatus.camera.toViewBox());
            }
        });
    }

}
