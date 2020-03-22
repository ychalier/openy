console.log("Echo from board.js");

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

function initMatrix() {
    let matrix = {};
    matrix.get = function(rank, file) {
        return this[rank + "," + file];
    }
    matrix.set = function(rank, file, value) {
        this[rank + "," + file] = value;
    }
    matrix.has = function(rank, file) {
        return rank + "," + file in this
    }
    return matrix;
}

function isNumeric(str){
    return /^\d+$/.test(str);
}

function isUppercase(str) {
    return str === str.toUpperCase();
}

function formatPieceImage(piece) {
    return "http://images.chesscomfiles.com/chess-themes/pieces/neo/150/" + piece + ".png";
}

function initBoardStatus() {
    let boardStatus = {};
    boardStatus.board = null;
    boardStatus.fenHistory = [];
    boardStatus.fenHistoryIndex = -1;
    boardStatus.matrix = initMatrix();
    boardStatus.dragging = false;
    boardStatus.dragStartRank = null;
    boardStatus.dragStartFile = null;
    boardStatus.dragStartX = null;
    boardStatus.dragStartY = null;
    boardStatus.callback = null;

    boardStatus.setBoard = function() {
        this.board.innerHTML = "";
        for (let rank = 8; rank >= 1; rank--) {
            let rankDiv = document.createElement("div");
            rankDiv.classList.add("rank");
            for (let file = 1; file <= 8; file++) {
                let square = document.createElement("div");
                square.classList.add("square");
                if ((rank + file) % 2 == 0) {
                    square.classList.add("square--black");
                } else {
                    square.classList.add("square--white");
                }
                rankDiv.appendChild(square);
                this.matrix.set(rank, file, square);
            }
            this.board.appendChild(rankDiv);
        }
    }

    boardStatus.setFen = function(fen) {
        let pieces = this.board.querySelectorAll(".piece");
        for (let i = 0; i < pieces.length; i++) {
            pieces[i].remove();
        }
        let logic = initMatrix();
        let split = fen.split(" ")[0].split("/");
        for (let i = 0; i < split.length; i++) {
            let rank = 8 - i;
            let file = 1;
            for (let j = 0; j < split[i].length; j++) {
                if (isNumeric(split[i][j])) {
                    file += parseInt(split[i][j]);
                } else if (isUppercase(split[i][j])) {
                    logic.set(rank, file, "w" + split[i][j].toLowerCase());
                    file++;
                } else {
                    logic.set(rank, file, "b" + split[i][j]);
                    file++;
                }
            }
        }
        for (let rank = 8; rank >= 1; rank--) {
            for (let file = 1; file <= 8; file++) {
                let square = this.matrix.get(rank, file);
                if (logic.has(rank, file)) {
                    let piece = document.createElement("img");
                    piece.classList.add("piece");
                    piece.addEventListener("dragstart", (event) => {
                        event.preventDefault();
                    });
                    piece.src = formatPieceImage(logic.get(rank, file));
                    piece.alt = logic.get(rank, file);
                    square.appendChild(piece);
                }
            }
        }
    }

    boardStatus.pushFen = function(fen) {
        this.setFen(fen);
        this.fenHistoryIndex++;
        this.fenHistory = this.fenHistory.slice(0, this.fenHistoryIndex);
        this.fenHistory.push(fen);
    }

    boardStatus.getFen = function() {
        let fen = "";
        for (let rank = 8; rank >= 1; rank--) {
            let padding = 0;
            for (let file = 1; file <= 8; file++) {
                let piece = this.matrix.get(rank, file).querySelector(".piece");
                if (piece) {
                    if (padding > 0) {
                        fen += padding.toString();
                    }
                    padding = 0;
                    let pieceContent = piece.getAttribute("alt");
                    if (pieceContent[0] == "w") {
                        fen += pieceContent[1].toUpperCase();
                    } else {
                        fen += pieceContent[1].toLowerCase();
                    }
                } else {
                    padding++;
                }
            }
            if (padding > 0) {
                fen += padding.toString();
            }
            if (rank > 1) {
                fen += "/";
            }
        }
        return fen;
    }

    boardStatus.setEventListeners = function() {

        for (let rank = 8; rank >= 1; rank--) {
            for (let file = 1; file <= 8; file++) {
                let square = this.matrix.get(rank, file);
                square.addEventListener("mousedown", (event) => {
                    let piece = square.querySelector(".piece");
                    if (piece) {
                        piece.classList.add("piece--moving");
                        this.dragging = piece;
                        this.dragStartRank = rank;
                        this.dragStartFile = file;
                        this.dragStartX = event.clientX;
                        this.dragStartY = event.clientY;
                    }
                });
            }
        }

        document.addEventListener("mousemove", (event) => {
            if (this.dragging) {
                this.dragging.style.transform = "translate("
                    + (event.clientX - this.dragStartX) + "px, "
                    + (event.clientY - this.dragStartY) + "px)";
            }
        });

        document.addEventListener("mouseup", (event) => {
            if (this.dragging) {
                let squareWidth = this.matrix.get(1, 1).clientWidth;
                let squareHeight = this.matrix.get(1, 1).clientHeight;
                let rank = 8 - parseInt((event.clientY - this.board.getBoundingClientRect().top) / squareHeight);
                let file = parseInt((event.clientX - this.board.getBoundingClientRect().left) / squareWidth) + 1;
                let square = this.matrix.get(rank, file);
                if (square) {
                    if (rank != this.dragStartRank || file != this.dragStartFile) {
                        square.innerHTML = "";
                        square.appendChild(this.dragging);
                        let newFen = this.getFen();
                        this.fenHistoryIndex++;
                        this.fenHistory = this.fenHistory.slice(0, this.fenHistoryIndex);
                        this.fenHistory.push(newFen);
                        if (this.callback) {
                            this.callback(newFen);
                        }
                    }
                }
                this.dragging.classList.remove("piece--moving");
                this.dragging.style.transform = "none";
                this.dragging = null;
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.keyCode == 37) {
                if (this.fenHistoryIndex > 0) {
                    this.fenHistoryIndex--;
                    this.setFen(this.fenHistory[this.fenHistoryIndex]);
                }
            } else if (event.keyCode == 39) {
                if (this.fenHistoryIndex < this.fenHistory.length - 1) {
                    this.fenHistoryIndex++;
                    this.setFen(this.fenHistory[this.fenHistoryIndex]);
                }
            }
        });
    }

    return boardStatus;
}

function initBoard(board, fen, callback) {
    let boardStatus = initBoardStatus();
    let resizeObserver = new ResizeObserver(entries => {
        entries[0].target.style.height = entries[0].target.offsetWidth + "px";
    });
    resizeObserver.observe(board);
    boardStatus.board = board;
    boardStatus.callback = callback;
    boardStatus.setBoard();
    boardStatus.pushFen(fen);
    boardStatus.setEventListeners();
    return boardStatus;
}
