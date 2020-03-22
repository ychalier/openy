"""Notes parser for django-chess.

This script takes a text file as input and builds a JSON representation of the
openings repertoire, meant for upload on the web application. It requires a
stockfish installation.

See https://github.com/ychalier/django-chess for more details.
To get the engine, go to https://stockfishchess.org/.
"""

import re
import json
import codecs
import logging
import argparse
import tqdm
import chess
import chess.engine


logging.basicConfig(level=logging.CRITICAL)


class Node:

    """A node in the repertoire tree"""

    def __init__(self, uid, parent):
        self.uid = uid
        self.parent = parent
        self.board = None
        self.evaluation = None
        self.comment = ""
        self.label = ""
        self.illustrative = False
        self.children = list()
        self.line = ""
        self.note_line = None

    def to_dict(self):
        """Serialization"""
        return {
            "uid": self.uid,
            "fen": self.board.fen(),
            "ev": self.evaluation,
            "cmt": self.comment,
            "p": self.parent,
            "lbl": self.label,
            "line": self.line,
        }


def parse_notes(filename):
    """Build a Node list from the note text file"""
    with codecs.open(filename, "r", "utf8") as file:
        lines = file.readlines()
    valid_line_regex = re.compile(r"^ *(il. ?)?~?\d+")
    move_regex = re.compile(
        r"((?:[KQBNR][a-h]?[1-8]?|[a-h])?x?[a-h][1-8]\+?\#?|O-O-O|O-O|\*|\.\.\.)"
    )
    turn_regex = re.compile(r"(?:il. ?)?~?(\d+)\.+")
    root = Node(0, None)
    fullmove_number = 1
    turn = chess.WHITE
    root.board = chess.Board()
    nodes = [root]
    for i, text_line in enumerate(lines):
        if text_line.strip() == "" or not valid_line_regex.match(text_line):
            continue
        line, *comment = text_line.strip().split(":")
        for element in line.split(" "):
            if turn_regex.match(element):
                fullmove_number = int(turn_regex.match(element).group(1))
                turn = chess.WHITE
            elif element == "...":
                turn = chess.BLACK
            elif move_regex.match(element):
                j = len(nodes) - 1
                while j > 0:
                    if nodes[j].board.fullmove_number == fullmove_number\
                            and nodes[j].board.turn == turn:
                        break
                    j -= 1
                parent = nodes[j]
                child = Node(len(nodes), parent.uid)
                child.board = parent.board.copy()
                move_san = move_regex.match(element).group(1)
                if move_san == "*":
                    move = chess.Move.null()
                else:
                    try:
                        move = child.board.parse_san(move_san)
                    except ValueError:
                        print("Invalid move '%s' at line %d" %
                              (move_san, i + 1))
                        return None
                child.note_line = i + 1
                child.board.push(move)
                child.label = "%d. " % fullmove_number
                child.illustrative = "il. " in element
                if turn == chess.BLACK:
                    child.label += "... "
                child.label += move_san
                parent.children.append(child)
                nodes.append(child)
                turn = not turn
            elif element.startswith("(") and element.endswith(")"):
                nodes[-1].evaluation = element[1:-1]
        nodes[-1].comment = ":".join(comment).strip()
    return nodes


def evaluate(engine, board, depth):
    """Give the evaluation of a move"""
    score = engine.analyse(board, chess.engine.Limit(depth=depth))["score"]
    if score.is_mate():
        value = score.white().mate()
        if value >= 0:
            return "M%d" % value
        return "-M%d" % (- value)
    value = score.white().score()
    if value > 0:
        return "+%.2f" % (.01 * value)
    return "%.2f" % (.01 * value)


def evaluate_repertoire(repertoire, engine, depth, override):
    """Evaluate a set of nodes"""
    for node in tqdm.tqdm(repertoire):
        if node.evaluation is None or override:
            node.evaluation = evaluate(engine, node.board, depth)


def main():
    """Main script function"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "note_txt",
        help="Path to the text note file",
        type=str
    )
    parser.add_argument(
        "engine_exe",
        help="Path to the UCI engine executable (e.g. stockfish.exe)",
        type=str
    )
    parser.add_argument(
        "-o", "--output_json",
        help="Path to save the JSON result to",
        type=str,
        default="repertoire.json"
    )
    parser.add_argument(
        "-d", "--depth",
        help="Evaluation depth",
        type=int,
        default=20
    )
    parser.add_argument(
        "-v", "--override",
        help="Override evaluations",
        action="store_true"
    )
    args = parser.parse_args()
    repertoire = parse_notes(args.note_txt)
    if repertoire is not None:
        print("Loaded %d nodes from '%s'." % (len(repertoire), args.note_txt))
        pruned = []
        buffer = [repertoire[0]]
        while len(buffer) > 0:
            node = buffer.pop(0)
            pruned.append(node)
            for child in node.children:
                if not child.illustrative and chess.Move.null() not in child.board.move_stack:
                    child.line = chess.Board().variation_san(child.board.move_stack)
                    buffer.append(child)
        seen = dict()
        duplicates = False
        for node in pruned:
            if node.line in seen:
                duplicates = True
                print("Duplicate lines %d and %d (%s)"
                      % (seen[node.line], node.note_line, node.line))
            else:
                seen[node.line] = node.note_line
        if duplicates:
            print("Found duplicates, please remove them.")
            return True
        print("Kept %d nodes after pruning." % len(pruned))
        engine = chess.engine.SimpleEngine.popen_uci(args.engine_exe)
        print("Evaluating repertoire with engine '%s' at depth %d." %
              (args.engine_exe, args.depth))
        evaluate_repertoire(pruned, engine, args.depth, args.override)
        engine.quit()
        print("Writing output to '%s'." % args.output_json)
        with codecs.open(args.output_json, "w", "utf8") as file:
            json.dump([node.to_dict() for node in pruned], file)
    return True


if __name__ == "__main__":
    if not main():
        print(__doc__)
