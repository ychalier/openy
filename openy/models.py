from django.utils import timezone
from django.db import models
from django.urls import reverse
import chess.svg
import chess


def hexify(rgb):
    return "#%02x%02x%02x" % tuple(map(int, rgb))


def evaluation_to_float(evaluation):
    if "M" in str(evaluation):
        if "-" in str(evaluation):
            return -1000
        return 1000
    return float(evaluation)


class Node(models.Model):

    uid = models.IntegerField(unique=True, primary_key=True)
    fen = models.CharField(max_length=100)
    evaluation = models.CharField(max_length=10, default="")
    comment = models.TextField(default="")
    label = models.CharField(max_length=20, default="")
    parent = models.ForeignKey("self", on_delete=models.CASCADE, null=True, blank=True)
    line = models.TextField(default="", max_length=500)
    slug = models.SlugField(max_length=500, unique=True)

    def __str__(self):
        return self.line

    def __lt__(self, other):
        return evaluation_to_float(self.evaluation) < evaluation_to_float(other.evaluation)

    def __add__(self, other):
        return evaluation_to_float(self.evaluation) + evaluation_to_float(other.evaluation)

    def __sub__(self, other):
        return evaluation_to_float(self.evaluation) - evaluation_to_float(other.evaluation)

    def board(self):
        return chess.Board(fen=self.fen)

    def depth(self):
        fullmove = int(self.fen.split(" ")[-1])
        if self.turn():
            return 2 * fullmove
        return 2 * fullmove + 1

    def svg(self):
        return chess.svg.board(board=self.board())

    def children(self):
        return Node.objects.filter(parent__uid=self.uid)

    def siblings(self):
        return Node.objects.filter(parent=self.parent).exclude(uid=self.uid)

    def is_leaf(self):
        return len(self.children()) == 0

    def is_pre_leaf(self):
        children = self.children()
        return len(children) == 1 and children[0].is_leaf()

    def move_san(self):
        return self.label.split(" ")[-1]

    def move_uci(self):
        if self.parent is not None:
            move = self.parent.board().parse_san(self.move_san())
            return move.uci()
        return None

    def ancestors(self):
        result = [self]
        while True:
            if result[-1].parent is not None and result[-1].parent.label != "":
                result.append(result[-1].parent)
            else:
                break
        return result

    def color(self):
        target_black = (118, 150, 86)
        target_white = (137, 105, 169)
        rgb = (128, 127, 129)
        if "M0" in str(self.evaluation):
            if "..." in str(self.label):
                rgb = target_black
            else:
                rgb = target_white
        elif "M" in str(self.evaluation):
            if "-" in str(self.evaluation):
                rgb = target_black
            else:
                rgb = target_white
        else:
            value = float(self.evaluation)
            cursor = min(1., max(0., value * .25 + .5))
            rgb = (
                cursor * target_white[0] + (1 - cursor) * target_black[0],
                cursor * target_white[1] + (1 - cursor) * target_black[1],
                cursor * target_white[2] + (1 - cursor) * target_black[2]
            )
        return hexify(rgb)

    def turn(self):
        return self.fen.split(" ")[1] == "w"

    def href(self):
        if self.slug == "":
            return reverse("openy:explore_root")
        return reverse("openy:explore", kwargs={"slug": self.slug})

    def tree(self, pred=None, succ=None):
        if pred is not None:
            pred = int(pred)
        if succ is not None:
            succ = int(succ)
        if pred is not None and pred > 0 and self.parent is not None:
            if succ is None:
                return self.parent.tree(pred - 1)
            return self.parent.tree(pred - 1, succ + 1)
        result = dict()
        result[self.uid] = list()
        for child in sorted(self.children()):
            result[self.uid].append(child.uid)
            child_tree = None
            if succ is None:
                _, child_tree = child.tree()
            else:
                if succ > 0:
                    _, child_tree = child.tree(succ=succ - 1)
            if child_tree is not None:
                for key, value in child_tree.items():
                    result[key] = value
        return self.uid, result


class Exercise(models.Model):

    title = models.CharField(max_length=255)
    description = models.TextField(default="")
    starting_position = models.CharField(max_length=100)
    moves = models.TextField(default="")
    date_creation = models.DateTimeField(auto_now=False, auto_now_add=True)
    cover_position = models.CharField(max_length=100)
    first_move = models.BooleanField(default=True)


def get_days_delta(start, end):
    time_delta = end - start
    return time_delta.days + float(time_delta.seconds) / (24. * 3600.)


class PositionTraining(models.Model):

    exercise = models.OneToOneField(Exercise, on_delete=models.CASCADE, primary_key=True)
    node = models.OneToOneField(Node, on_delete=models.CASCADE)
    depth = models.PositiveIntegerField()
    partial = models.BooleanField()
    successes = models.PositiveIntegerField(default=0)
    failures = models.PositiveIntegerField(default=0)
    tries = models.PositiveIntegerField(default=0)
    last_try = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now=False, auto_now_add=True)

    def add_try(self, outcome):
        self.tries += 1
        if outcome:
            self.successes += 1
        else:
            self.failures += 1
        self.last_try = timezone.now()
        self.save()

    def add_success(self):
        self.add_try(True)

    def add_failure(self):
        self.add_try(False)

    def get_failure_ratio(self):
        if self.tries > 0:
            return self.failures / self.tries
        return 0

    def get_inactivity_ratio(self):
        now = timezone.now()
        creation_delta = get_days_delta(self.date_creation, now)
        last_try_delta = creation_delta
        if self.last_try is not None:
            last_try_delta = get_days_delta(self.last_try, now)
        return last_try_delta / creation_delta

    def get_ease_ratio(self):
        return 1. / (self.depth + 1.)

    def get_training_weight(self, failure_coef=1., inactivity_coef=1., ease_coef=0.):
        return (
            failure_coef * self.get_failure_ratio()
            + inactivity_coef * self.get_inactivity_ratio()
            + ease_coef * self.get_ease_ratio()
        ) / (failure_coef + inactivity_coef + ease_coef)
