console.log("Echo from board.js");

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const PIECE_HTML_SYMBOLS = {
    "wk": "♔",
    "wq": "♕",
    "wr": "♖",
    "wb": "♗",
    "wn": "♘",
    "wp": "♙",
    "bk": "♚",
    "bq": "♛",
    "br": "♜",
    "bb": "♝",
    "bn": "♞",
    "bp": "♟",
}

const PIECE_HTML_CODES = {
    "wk": "&#9812;",
    "wq": "&#9813;",
    "wr": "&#9814;",
    "wb": "&#9815;",
    "wn": "&#9816;",
    "wp": "&#9817;",
    "bk": "&#9818;",
    "bq": "&#9819;",
    "br": "&#9820;",
    "bb": "&#9821;",
    "bn": "&#9822;",
    "bp": "&#9823;",
}

function initMatrix() {
    let matrix = {};
    matrix.get = function(rank, file) {
        return this[rank + "," + file];
    }
    matrix.set = function(rank, file, value) {
        this[rank + "," + file] = value;
    }
    matrix.remove = function(rank, file) {
        if (this.has(rank, file)) {
            delete this[rank + "," + file];
        }
    }
    matrix.has = function(rank, file) {
        return rank + "," + file in this
    }
    return matrix;
}

function keyToPos(key) {
    return {
        "rank": parseInt(key.split(",")[0]),
        "file": parseInt(key.split(",")[1]),
    }
}

function uciToPos(uci) {
    return {
        "file": uci.charCodeAt(0) - 96,
        "rank": parseInt(uci[1]),
    }
}

function moveToUci(startRank, startFile, endRank, endFile) {
    return fileChar(startFile) + startRank + fileChar(endFile) + endRank;
}

function isNumeric(str) {
    return /^\d+$/.test(str);
}

function isUppercase(str) {
    return str === str.toUpperCase();
}

function formatPieceImage(piece) {
    return "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/" + piece + ".png";
}

function fileChar(file) {
    return "abcdefgh" [file - 1];
}

function initPosition() {
    let position = {};
    position.castling = {
        "K": true,
        "Q": true,
        "k": true,
        "q": true
    }
    position.enPassant = null,
        position.pieces = initMatrix();
    position.turn = "w";
    position.halfMoves = 0;
    position.fullMoves = 1;
    position.result = {
        "check": null,
        "stalemate": false,
        "checkmate": false,
    }

    position.copy = function() {
        let newPosition = initPosition();
        newPosition.castling = Object.assign({}, this.castling);
        newPosition.enPassant = this.enPassant;
        newPosition.pieces = Object.assign({}, this.pieces);
        newPosition.turn = this.turn;
        return newPosition;
    }

    position.isLegalLinearDisplacement = function(startRank, startFile, endRank, endFile, testCallback) {
        let direction = [0, 0];
        if (startRank < endRank) {
            direction[0] = 1;
        } else if (startRank > endRank) {
            direction[0] = -1;
        }
        if (startFile < endFile) {
            direction[1] = 1;
        } else if (startFile > endFile) {
            direction[1] = -1;
        }
        let rankDistance = Math.abs(endRank - startRank);
        let fileDistance = Math.abs(endFile - startFile);
        let distance = (rankDistance > fileDistance ? rankDistance : fileDistance);
        if (direction[0] != 0 && direction[1] != 0) {
            if ((startRank - endRank) / direction[0] != (startFile - endFile) / direction[1]) {
                return false;
            }
        }
        if (!testCallback(direction, distance)) {
            return false;
        }
        for (let k = 1; k < distance; k++) {
            if (this.pieces.has(startRank + k * direction[0], startFile + k * direction[1])) {
                return false;
            }
        }
        if (this.pieces.has(endRank, endFile)) {
            if (this.pieces.get(endRank, endFile)[0] == this.pieces.get(startRank, startFile)[0]) {
                return false;
            }
            return true;
        }
        return true;
    }

    position.isLegalDisplacement = function(startRank, startFile, endRank, endFile) {
        if (!(1 <= startRank <= 8 && 1 <= startFile <= 8 && 1 <= endRank <= 8 && 1 <= endFile <= 8)) {
            return false;
        }
        let piece = this.pieces.get(startRank, startFile);
        if (piece) {
            if (piece[1] == "p") {
                if (piece[0] == "w") {
                    if (startRank == endRank - 1 && startFile == endFile
                        && !this.pieces.has(endRank, endFile)) {
                        return true;
                    }
                    if (startRank == endRank - 2 && startFile == endFile
                        && startRank == 2 && !this.pieces.has(endRank, endFile)
                        && !this.pieces.has(endRank - 1, endFile)) {
                        return true;
                    }
                    if (this.pieces.has(endRank, endFile)
                    && this.pieces.get(endRank, endFile)[0] == "b"
                    && startRank == endRank - 1
                    && Math.abs(startFile - endFile) == 1) {
                        return true;
                    }
                    if (this.enPassant && this.enPassant.rank == endRank
                        && this.enPassant.file == endFile
                        && this.pieces.has(endRank - 1, endFile)
                        && this.pieces.get(endRank - 1, endFile)[0] == "b"
                        && startRank == endRank - 1
                        && Math.abs(startFile - endFile) == 1) {
                        return true;
                    }
                    return false;
                } else {
                    if (startRank == endRank + 1 && startFile == endFile
                        && !this.pieces.has(endRank, endFile)) {
                        return true;
                    }
                    if (startRank == endRank + 2 && startFile == endFile
                        && startRank == 7 && !this.pieces.has(endRank, endFile)
                        && !this.pieces.has(endRank + 1, endFile)) {
                        return true;
                    }
                    if (this.pieces.has(endRank, endFile)
                    && this.pieces.get(endRank, endFile)[0] == "w"
                    && startRank == endRank + 1
                    && Math.abs(startFile - endFile) == 1) {
                        return true;
                    }
                    if (this.enPassant && this.enPassant.rank == endRank
                        && this.enPassant.file == endFile
                        && this.pieces.has(endRank + 1, endFile)
                        && this.pieces.get(endRank + 1, endFile)[0] == "w"
                        && startRank == endRank + 1
                        && Math.abs(startFile - endFile) == 1) {
                        return true;
                    }
                    return false;
                }
            } else if (piece[1] == "n") {
                if (!this.pieces.has(endRank, endFile)
                || this.pieces.get(endRank, endFile)[0] != piece[0]) {
                    if (Math.abs(startRank - endRank) == 1
                    && Math.abs(startFile - endFile) == 2) {
                        return true;
                    } else if (Math.abs(startRank - endRank) == 2
                    && Math.abs(startFile - endFile) == 1) {
                        return true;
                    }
                }
                return false;
            } else if (piece[1] == "b") {
                return this.isLegalLinearDisplacement(startRank, startFile, endRank, endFile, (direction, distance) => {
                    if (direction[0] == 0 || direction[1] == 0) {
                        return false;
                    }
                    return distance > 0;
                });
            } else if (piece[1] == "r") {
                return this.isLegalLinearDisplacement(startRank, startFile, endRank, endFile, (direction, distance) => {
                    if (direction[0] != 0 && direction[1] != 0) {
                        return false;
                    }
                    return distance > 0;
                });
            } else if (piece[1] == "q") {
                return this.isLegalLinearDisplacement(startRank, startFile, endRank, endFile, (direction, distance) => {
                    return distance > 0;
                });
            } else if (piece[1] == "k") {
                let regularMove = this.isLegalLinearDisplacement(startRank, startFile, endRank, endFile, (direction, distance) => {
                    return distance == 1;
                });
                if (regularMove) {
                    return true;
                }
                if (piece[0] == "w") {
                    if (this.castling["K"] && startRank == 1 && endRank == 1
                    && startFile == 5 && endFile == 7 && !this.pieces.has(1, 6)
                    && !this.pieces.has(1, 7)
                    && this.getThreats(piece[0], 1, 6).length == 0
                    && this.getThreats(piece[0], 1, 7).length == 0
                    && this.getThreats(piece[0], startRank, startFile).length == 0) {
                        return true;
                    }
                    if (this.castling["Q"] && startRank == 1 && endRank == 1
                    && startFile == 5 && endFile == 3 && !this.pieces.has(1, 4)
                    && !this.pieces.has(1, 3) && !this.pieces.has(1, 2)
                    && this.getThreats(piece[0], 1, 4).length == 0
                    && this.getThreats(piece[0], 1, 3).length == 0
                    && this.getThreats(piece[0], 1, 2).length == 0
                    && this.getThreats(piece[0], startRank, startFile).length == 0) {
                        return true;
                    }
                } else {
                    if (this.castling["k"] && startRank == 8 && endRank == 8
                    && startFile == 5 && endFile == 7 && !this.pieces.has(8, 6)
                    && !this.pieces.has(8, 7)
                    && this.getThreats(piece[0], 8, 6).length == 0
                    && this.getThreats(piece[0], 8, 7).length == 0
                    && this.getThreats(piece[0], startRank, startFile).length == 0) {
                        return true;
                    }
                    if (this.castling["q"] && startRank == 8 && endRank == 8
                    && startFile == 5 && endFile == 3 && !this.pieces.has(8, 4)
                    && !this.pieces.has(8, 3) && !this.pieces.has(8, 2)
                    && this.getThreats(piece[0], 8, 4).length == 0
                    && this.getThreats(piece[0], 8, 3).length == 0
                    && this.getThreats(piece[0], 8, 2).length == 0
                    && this.getThreats(piece[0], startRank, startFile).length == 0) {
                        return true;
                    }
                }
                return false;
            }
        }
        return false;
    }

    position.canPlayMove = function(startRank, startFile, endRank, endFile) {
        let piece = this.pieces.get(startRank, startFile);
        if (!piece) {
            return false;
        }
        if (piece[0] != this.turn) {
            return false;
        }
        if (!this.isLegalDisplacement(startRank, startFile, endRank, endFile)) {
            return false;
        }
        let ghostPosition = this.copy();
        ghostPosition.pushMove(startRank, startFile, endRank, endFile);
        for (key in ghostPosition.pieces) {
            let target = this.turn + "k";
            if (ghostPosition.pieces[key] == target) {
                let pos = keyToPos(key);
                if (ghostPosition.getThreats(this.turn, pos.rank, pos.file).length > 0) {
                    return false;
                }
            }
        }
        return true;
    }

    position.parseFen = function(fen) {
        this.pieces = initMatrix();
        if (fen) {
            let splitFen = fen.split(" ");
            let split = splitFen[0].split("/");
            for (let i = 0; i < split.length; i++) {
                let rank = 8 - i;
                let file = 1;
                for (let j = 0; j < split[i].length; j++) {
                    if (isNumeric(split[i][j])) {
                        file += parseInt(split[i][j]);
                    } else if (isUppercase(split[i][j])) {
                        this.pieces.set(rank, file, "w" + split[i][j].toLowerCase());
                        file++;
                    } else {
                        this.pieces.set(rank, file, "b" + split[i][j]);
                        file++;
                    }
                }
            }
            this.turn = splitFen[1];
            for (castlingKind in this.castling) {
                this.castling[castlingKind] = splitFen[2].includes(castlingKind);
            }
            if (splitFen[3] == "-") {
                this.enPassant = null;
            } else {
                this.enPassant = keyToPos(splitFen[3]);
            }
            this.halfMoves = parseInt(splitFen[4]);
            this.fullMoves = parseInt(splitFen[5]);
        }
    }

    position.getThreats = function(defender, rank, file) {
        let threats = [];
        for (key in this.pieces) {
            let pos = keyToPos(key);
            if (defender != this.pieces[key][0]
                && this.isLegalDisplacement(pos.rank, pos.file, rank, file)) {
                threats.push(key);
            }
        }
        return threats;
    }

    position.nameMove = function(startRank, startFile, endRank, endFile) {
        let piece = this.pieces.get(startRank, startFile);
        if (piece) {
            let isPawnMove = piece[1] == "p";
            let isKingMove = piece[1] == "k";
            let endIsOccupied = this.pieces.has(endRank, endFile);
            let isEnPassantMove = isPawnMove && startFile != endFile && !endIsOccupied;
            let isCastling = isKingMove && Math.abs(endFile - startFile) == 2;
            let isCapture = isEnPassantMove || endIsOccupied;
            let isPromotion = (piece == "wp" && endRank == 8) || (piece == "bp" && endRank == 1);
            let prefix = "";
            if (isCastling) {
                if (endFile == 3) {
                    prefix = "O-O-O";
                } else {
                    prefix = "O-O";
                }
            } else {
                let piecePrefix = "";
                if (piece[1] != "p") {
                    piecePrefix += piece[1].toUpperCase();
                    let possiblyIdentical = {
                        "count": 0,
                        "ranks": new Set(),
                        "files": new Set(),
                    }
                    for (let key in this.pieces) {
                        if (this.pieces[key] == piece) {
                            let start = keyToPos(key);
                            if (this.isLegalDisplacement(start.rank, start.file, endRank, endFile)) {
                                possiblyIdentical.count++;
                                possiblyIdentical.ranks.add(start.rank);
                                possiblyIdentical.files.add(start.file);
                            }
                        }
                    }
                    if (possiblyIdentical.count > 1) {
                        if (possiblyIdentical.count == possiblyIdentical.files.size) {
                            piecePrefix += fileChar(startFile);  // All files are different
                        } else if (possiblyIdentical.count == possiblyIdentical.ranks.size) {
                            piecePrefix += startRank;  // All ranks are different
                        } else {
                            piecePrefix += fileChar(startFile) + startRank;
                        }
                    }
                } else if (isCapture) {
                    piecePrefix = fileChar(startFile);
                }
                prefix += piecePrefix;
                if (isCapture) {
                    prefix += "x";
                }
                prefix += fileChar(endFile) + endRank;
            }
            if (isPromotion) {
                prefix += "=Q";
            }
            let ghostPosition = this.copy();
            ghostPosition.pushMove(startRank, startFile, endRank, endFile);
            ghostPosition.updateResult();
            if (ghostPosition.result.checkmate) {
                prefix += "#";
            } else if (ghostPosition.result.check) {
                prefix += "+";
            }
            return prefix;
        }
    }

    position.pushMove = function(startRank, startFile, endRank, endFile) {
        let piece = this.pieces.get(startRank, startFile);
        if (piece) {
            // Updating en passant
            let isPawnMove = piece[1] == "p";
            let isEnPassantMove = isPawnMove && startFile != endFile && !this.pieces.has(endRank, endFile);
            this.enPassant = null;
            if (isPawnMove && Math.abs(startRank - endRank) == 2) {
                if (this.turn == "w") {
                    this.enPassant = {
                        "rank": startRank + 1,
                        "file": startFile
                    };
                } else {
                    this.enPassant = {
                        "rank": startRank - 1,
                        "file": startFile
                    };
                }
            }

            // Updating castling rights
            if (piece[1] == "k") {
                if (this.turn == "w") {
                    this.castling["K"] = false;
                    this.castling["Q"] = false;
                } else {
                    this.castling["k"] = false;
                    this.castling["q"] = false;
                }
            }
            if (piece[1] == "r") {
                if (startRank == 1 && startFile == 1) {
                    this.castling["Q"] = false;
                } else if (startRank == 1 && startFile == 8) {
                    this.castling["K"] = false;
                } else if (startRank == 8 && startFile == 1) {
                    this.castling["q"] = false;
                } else if (startRank == 8 && startFile == 8) {
                    this.castling["k"] = false;
                }
            }

            // Performing move
            let isCapture = false;
            let captured = null;
            if (isEnPassantMove) {
                isCapture = true;
                captured = {
                    "rank": startRank,
                    "file": endFile
                }
            } else {
                isCapture = this.pieces.has(endRank, endFile);
                captured = {
                    "rank": endRank,
                    "file": endFile
                }
            }
            if (isCapture) {
                this.pieces.remove(captured.rank, captured.file);
            }
            this.pieces.set(endRank, endFile, piece);
            this.pieces.remove(startRank, startFile);

            // Updating half moves
            if (isCapture || isPawnMove) {
                this.halfMoves = 0;
            } else {
                this.halfMoves++;
            }

            // Castling
            if (piece[1] == "k" && Math.abs(endFile - startFile) == 2) {
                if (startRank == 1) {
                    if (endFile == 7) { // White O-O
                        this.pieces.set(1, 7, piece);
                        this.pieces.set(1, 6, this.pieces.get(1, 8));
                        this.pieces.remove(1, 5);
                        this.pieces.remove(1, 8);
                    } else if (endFile == 3) { // White O-O-O
                        this.pieces.set(1, 3, piece);
                        this.pieces.set(1, 4, this.pieces.get(1, 1));
                        this.pieces.remove(1, 5);
                        this.pieces.remove(1, 1);
                    }
                } else if (startRank == 8) {
                    if (endFile == 7) { // Black O-O
                        this.pieces.set(8, 7, piece);
                        this.pieces.set(8, 6, this.pieces.get(8, 8));
                        this.pieces.remove(8, 5);
                        this.pieces.remove(8, 8);
                    } else if (endFile == 3) { // Black O-O-O
                        this.pieces.set(8, 3, piece);
                        this.pieces.set(8, 4, this.pieces.get(8, 1));
                        this.pieces.remove(8, 5);
                        this.pieces.remove(8, 1);
                    }
                }
            }

            // Promotion
            if ((piece == "wp" && endRank == 8) || (piece == "bp" && endRank == 1)) {
                this.pieces.remove(endRank, endFile);
                this.pieces.set(endRank, endFile, piece[0] + "q");
            }

            // Updating turns
            if (this.turn == "w") {
                this.turn = "b";
            } else {
                this.turn = "w";
                this.fullMoves++;
            }
        }
    }

    position.updateResult = function() {
        this.result.check = null;
        this.result.stalemate = false;
        this.result.checkmate = false;
        let hasLegalMove = false;
        let numberOfKings = 0;
        for (let key in this.pieces) {
            if (this.pieces[key][1] == "k") {
                numberOfKings++;
                if (this.pieces[key][0] == this.turn) {
                    let pos = keyToPos(key);
                    if (this.getThreats(this.turn, pos.rank, pos.file).length > 0) {
                        this.result.check = pos;
                    }
                }
            }
        }
        if (numberOfKings != 2) {
            return;
        }
        for (let key in this.pieces) {
            if (hasLegalMove) {
                break;
            }
            if (this.pieces[key][0] == this.turn) {
                if (!hasLegalMove) {
                    let pos = keyToPos(key);
                    for (let endRank = 1; endRank <= 8; endRank++) {
                        for (let endFile = 1; endFile <= 8; endFile++) {
                            if (this.canPlayMove(pos.rank, pos.file, endRank, endFile)) {
                                hasLegalMove = true;
                                break;
                            }
                        }
                        if (hasLegalMove) {
                            break;
                        }
                    }
                }
            }
        }
        if (!hasLegalMove) {
            this.result.checkmate = this.result.check != null;
            this.result.stalemate = this.result.check == null;
        }
    }

    position.countMaterial = function() {
        let counts = {
            "b": 0,
            "w": 0
        }
        let value = {
            "p": 1,
            "n": 3,
            "b": 3,
            "r": 5,
            "q": 9,
            "k": 0,
        }
        for (key in this.pieces) {
            counts[this.pieces[key][0]] += value[this.pieces[key][1]];
        }
        return counts.w - counts.b;
    }

    position.toFen = function() {
        let fen = "";
        for (let rank = 8; rank >= 1; rank--) {
            let padding = 0;
            for (let file = 1; file <= 8; file++) {
                let piece = this.pieces.get(rank, file);
                if (piece) {
                    if (padding > 0) {
                        fen += padding.toString();
                    }
                    padding = 0;
                    if (piece[0] == "w") {
                        fen += piece[1].toUpperCase();
                    } else {
                        fen += piece[1].toLowerCase();
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
        fen += " " + this.turn + " ";
        if (!this.castling["K"] && !this.castling["Q"]
        && !this.castling["k"] && !this.castling["q"]) {
            fen += "-";
        } else {
            let order = "KQkq";
            for (let i = 0; i < 4; i++) {
                if (this.castling[order[i]]) {
                    fen += order[i];
                }
            }
        }
        fen += " ";
        if (this.enPassant) {
            fen += fileChar(this.enPassant.file) + this.enPassant.rank;
        } else {
            fen += "-";
        }
        fen += " " + this.halfMoves + " " + this.fullMoves;
        return fen;
    }

    return position;
}

function initBoardStatus() {
    let boardStatus = {};
    boardStatus.board = null;
    boardStatus.matrix = initMatrix();
    boardStatus.disabled = false;

    boardStatus.drag = {
        "piece": null,
        "startRank": null,
        "startFile": null,
        "startX": null,
        "startY": null,
    }

    boardStatus.highlight = {
        "lastMoveStart": null,
        "lastMoveEnd": null,
    }

    boardStatus.history = {
        "stack": [],
        "index": -1,
    }

    boardStatus.history.set = function(fen) {
        this.index = 0;
        this.stack = [];
        this.stack.push({
            "fen": fen,
            "lastMoveSan": null,
            "lastMoveUci": null,
        })
    }

    boardStatus.history.add = function(moveSan, moveUci, fen) {
        this.index++;
        this.stack = this.stack.slice(0, this.index);
        this.stack.push({
            "fen": fen,
            "lastMoveSan": moveSan,
            "lastMoveUci": moveUci,
        });
    }

    boardStatus.history.get = function() {
        return this.stack[this.index];
    }

    boardStatus.history.line = function() {
        let text = "";
        for (let i = 1; i < this.stack.length; i++) {
            let fenSplit = this.stack[i].fen.split(" ");
            if (i == 1 && fenSplit[1] == "w") {
                text += (fenSplit[5] - 1) + ". ... ";
            }
            if (fenSplit[1] == "b") {
                text += fenSplit[5] + ". " + this.stack[i].lastMoveSan + " ";
            } else {
                text += this.stack[i].lastMoveSan + " ";
            }
        }
        return text.trim();
    }

    boardStatus.position = initPosition();

    boardStatus.callback = null;

    boardStatus.setBoard = function() {
        this.board.innerHTML = "";
        let boardWrapper = document.createElement("div");
        boardWrapper.classList.add("board_wrapper");
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
            boardWrapper.appendChild(rankDiv);
        }
        this.board.appendChild(boardWrapper);
        let resultDiv = document.createElement("div");
        resultDiv.classList.add("board_result");
        this.board.appendChild(resultDiv);
        let materialDiv = document.createElement("div");
        materialDiv.classList.add("board_material");
        this.board.appendChild(materialDiv);
    }

    boardStatus.parseFen = function(fen) {
        this.position.parseFen(fen);
    }

    boardStatus.canPlayMove = function(startRank, startFile, endRank, endFile) {
        return this.position.canPlayMove(startRank, startFile, endRank, endFile);
    }

    boardStatus.update = function() {
        let pieces = this.board.querySelectorAll(".piece");
        for (let i = 0; i < pieces.length; i++) {
            pieces[i].remove();
        }
        for (let rank = 8; rank >= 1; rank--) {
            for (let file = 1; file <= 8; file++) {
                let square = this.matrix.get(rank, file);
                square.classList.remove("square--check");
                square.classList.remove("square--highlight");
                if (this.position.pieces.has(rank, file)) {
                    let piece = document.createElement("img");
                    piece.classList.add("piece");
                    if (this.position.pieces.get(rank, file)[0] == "w") {
                        piece.classList.add("piece--white");
                    } else {
                        piece.classList.add("piece--black");
                    }
                    piece.addEventListener("dragstart", (event) => {
                        event.preventDefault();
                    });
                    piece.src = formatPieceImage(this.position.pieces.get(rank, file));
                    piece.alt = PIECE_HTML_SYMBOLS["b" + this.position.pieces.get(rank, file)[1]];
                    square.appendChild(piece);
                }
            }
        }
        if (this.position.result.check) {
            this.matrix.get(this.position.result.check.rank, this.position.result.check.file).classList.add("square--check");
        }
        let resultDiv = this.board.querySelector(".board_result");
        resultDiv.classList.remove("board_result--shown");
        if (this.position.result.stalemate) {
            resultDiv.textContent = "Stalemate";
            resultDiv.classList.add("board_result--shown");
        }
        if (this.position.result.checkmate) {
            resultDiv.textContent = "Checkmate";
            resultDiv.classList.add("board_result--shown");
        }
        if (this.highlight.lastMoveStart) {
            this.matrix.get(this.highlight.lastMoveStart.rank, this.highlight.lastMoveStart.file).classList.add("square--highlight");
        }
        if (this.highlight.lastMoveEnd) {
            this.matrix.get(this.highlight.lastMoveEnd.rank, this.highlight.lastMoveEnd.file).classList.add("square--highlight");
        }
        let materialCount = this.position.countMaterial();
        if (materialCount > 0) {
            this.board.querySelector(".board_material").textContent = "+" + materialCount;
        } else {
            this.board.querySelector(".board_material").textContent = materialCount;
        }
    }

    boardStatus.setFen = function(fen) {
        this.parseFen(fen);
        this.position.updateResult();
        this.highlight.lastMoveStart = null;
        this.highlight.lastMoveEnd = null;
        this.update();
    }

    boardStatus.pushFen = function(fen) {
        this.setFen(fen);
        this.history.set(fen);
    }

    boardStatus.getFen = function() {
        return this.position.toFen();
    }

    boardStatus.pushUciMove = function(uciMove) {
        let start = uciToPos(uciMove.slice(0, 2));
        let end = uciToPos(uciMove.slice(2));
        return this.pushMove(start.rank, start.file, end.rank, end.file);
    }

    boardStatus.pushMove = function(startRank, startFile, endRank, endFile) {
        let move = this.position.nameMove(startRank, startFile, endRank, endFile);
        this.position.pushMove(startRank, startFile, endRank, endFile);
        this.position.updateResult();
        let newFen = this.position.toFen();
        this.history.add(move, moveToUci(startRank, startFile, endRank, endFile), newFen);
        this.highlight.lastMoveStart = {
            "rank": startRank,
            "file": startFile
        }
        this.highlight.lastMoveEnd = {
            "rank": endRank,
            "file": endFile
        }
        this.update();
        if (this.callback) {
            this.callback(newFen, fileChar(startFile) + startRank + fileChar(endFile) + endRank);
        }
    }

    boardStatus.undo = function() {
        if (this.history.index > 0) {
            this.history.index--;
            this.parseFen(this.history.get().fen);
            this.position.updateResult();
            this.highlight.lastMoveStart = null;
            this.highlight.lastMoveEnd = null;
            if (this.history.get().lastMoveUci) {
                let lastMoveUci = this.history.get().lastMoveUci;
                this.highlight.lastMoveStart = uciToPos(lastMoveUci.slice(0, 2));
                this.highlight.lastMoveEnd = uciToPos(lastMoveUci.slice(2));
            }
            this.update();
        }
    }

    boardStatus.redo = function() {
        if (this.history.index < this.history.stack.length - 1) {
            this.history.index++;
            this.parseFen(this.history.get().fen);
            this.position.updateResult();
            this.highlight.lastMoveStart = null;
            this.highlight.lastMoveEnd = null;
            if (this.history.get().lastMoveUci) {
                let lastMoveUci = this.history.get().lastMoveUci;
                this.highlight.lastMoveStart = uciToPos(lastMoveUci.slice(0, 2));
                this.highlight.lastMoveEnd = uciToPos(lastMoveUci.slice(2));
            }
            this.update();
        }
    }

    boardStatus.setEventListeners = function() {

        for (let rank = 8; rank >= 1; rank--) {
            for (let file = 1; file <= 8; file++) {
                let square = this.matrix.get(rank, file);
                square.addEventListener("mousedown", (event) => {
                    if (!this.disabled) {
                        let piece = square.querySelector(".piece");
                        if (piece) {
                            piece.classList.add("piece--moving");
                            this.drag.piece = piece;
                            this.drag.startRank = rank;
                            this.drag.startFile = file;
                            this.drag.startX = event.clientX;
                            this.drag.startY = event.clientY;
                        }
                    }
                });
            }
        }

        document.addEventListener("mousemove", (event) => {
            if (this.drag.piece) {
                this.drag.piece.style.transform = "translate(" +
                    (event.clientX - this.drag.startX) + "px, " +
                    (event.clientY - this.drag.startY) + "px)";
            }
        });

        document.addEventListener("mouseup", (event) => {
            if (this.drag.piece) {
                let squareWidth = this.matrix.get(1, 1).clientWidth;
                let squareHeight = this.matrix.get(1, 1).clientHeight;
                let rank = 8 - parseInt((event.clientY - this.board.getBoundingClientRect().top) / squareHeight);
                let file = parseInt((event.clientX - this.board.getBoundingClientRect().left) / squareWidth) + 1;
                let square = this.matrix.get(rank, file);
                if (square) {
                    if (rank != this.drag.startRank || file != this.drag.startFile) {
                        if (this.canPlayMove(this.drag.startRank, this.drag.startFile, rank, file)) {
                            this.pushMove(this.drag.startRank, this.drag.startFile, rank, file);
                        }
                    }
                }
                this.drag.piece.classList.remove("piece--moving");
                this.drag.piece.style.transform = "none";
                this.drag.piece = null;
            }
        });

        document.addEventListener("keydown", (event) => {
            if (!this.disabled) {
                if (event.keyCode == 37) {
                    this.undo();
                } else if (event.keyCode == 39) {
                    this.redo();
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
        entries[0].target.style.fontSize = (0.09 * entries[0].target.offsetWidth) + "px";
    });
    resizeObserver.observe(board);
    boardStatus.board = board;
    boardStatus.callback = callback;
    boardStatus.setBoard();
    boardStatus.pushFen(fen);
    boardStatus.setEventListeners();
    boardStatus.disabled = board.hasAttribute("disabled");
    return boardStatus;
}
