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

    repertoireStatus.getScale = function (targetRadius) {
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
                    this.camera.scale += 1;
                } else if (event.deltaY > 0) {
                    if (this.camera.scale > 1) {
                        this.camera.scale -= 1;
                    }
                }
                this.svg.setAttribute("viewBox", this.camera.toViewBox());
            });

            this.div.addEventListener("mousedown", (event) => {
                this.camera.moving = true;
                this.camera.moveStartX = event.clientX;
                this.camera.moveStartY = event.clientY;
                this.div.style.cursor = "grabbing";
            });

            window.addEventListener("mousemove", (event) => {
                if (this.camera.moving) {
                    let offsetX = event.clientX - this.camera.moveStartX;
                    let offsetY = event.clientY - this.camera.moveStartY;
                    this.camera.centerX -= 0.005 * this.camera.width * offsetX / this.camera.scale;
                    this.camera.centerY -= 0.005 * this.camera.height * offsetY / this.camera.scale;
                    this.camera.moveStartX = event.clientX;
                    this.camera.moveStartY = event.clientY;
                    this.svg.setAttribute("viewBox", this.camera.toViewBox());
                }
            });

            window.addEventListener("mouseup", (event) => {
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
            }

        }
    }

    return repertoireStatus;
}

function initRepertoire(div, url) {
    repertoireStatus = initRepertoireStatus();
    repertoireStatus.div = div;
    repertoireStatus.load(url);
}
