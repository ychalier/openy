"""Django views"""

import re
import json
import random
from django.http import HttpResponse
from django.shortcuts import render
from django.shortcuts import redirect
from django.contrib.auth.decorators import login_required
from django.template.defaultfilters import slugify
from django.urls import reverse
from django.db.models import Sum
import chess
from .utils.draw import repertoire_to_svg
from .utils.train import build_trainable_exercises
from .utils.misc import weighted_choice
from . import models


def home(request):
    """Short presentation abstract"""
    return render(request, "openy/home.html", {})


@login_required
def settings(request):
    """Control the application behavior"""
    profile = models.TrainingProfile.load()
    if request.method == "POST":
        profile.failure_coef = float(request.POST.get("failure_coef", 1))
        profile.inactivity_coef = float(request.POST.get("inactivity_coef", 1))
        profile.ease_coef = float(request.POST.get("ease_coef", 1))
        profile.elo_volatility = float(request.POST.get("elo_volatility", 10))
        profile.elo_spreading = float(request.POST.get("elo_spreading", 400))
        profile.save()
    return render(request, "openy/settings.html", {
        "profile": profile,
    })


@login_required
def upload(request):
    """Upload a new repertoire, which overrides any previous data"""
    if request.method == "POST" and request.FILES["file"]:
        models.Exercise.objects.exclude(positiontraining=None).delete()
        models.Node.objects.all().delete()
        data = json.load(request.FILES["file"])
        models.Node.objects.bulk_create([
            models.Node(
                uid=node["uid"],
                fen=node["fen"],
                evaluation=node["ev"],
                comment=node["cmt"],
                label=node["lbl"],
                parent_id=node["p"],
                line=node["line"],
                slug=slugify(node["line"]),
            )
            for node in data
        ])
        build_trainable_exercises()
    return redirect("openy:settings")


@login_required
def explore(request, slug=""):
    """Explore the node database"""
    if not models.Node.objects.filter(slug=slug).exists():
        return redirect("openy:home")
    node = models.Node.objects.get(slug=slug)
    return render(request, "openy/explore.html", {
        "node": node,
    })


@login_required
def explore_node(_, uid):
    """Same as explore view but with shortened URL"""
    if not models.Node.objects.filter(uid=uid).exists():
        return redirect("openy:home")
    return redirect("openy:explore", slug=models.Node.objects.get(uid=uid).slug)


@login_required
def find_entry(request):
    """Check if given a node, a given FEN string corresponds to one of its children"""
    if request.method == "POST" and "fen" in request.POST and "uid" in request.POST:
        children = models.Node.objects.filter(
            parent__uid=int(request.POST["uid"]),
            fen__startswith=request.POST["fen"]
        )
        if children.exists():
            return HttpResponse(
                reverse("openy:explore", kwargs={"slug": children.get().slug}),
                content_type="text/plain"
            )
    return HttpResponse("null", content_type="text/plain")


@login_required
def draw(request):
    """Build a SVG from the database"""
    params = {
        "center": int(request.GET.get("center", 0)),
        "pred": None,
        "succ": None,
        "radius": float(request.GET.get("radius", 40)),
        "vmargin": float(request.GET.get("vmargin", 10)),
        "hmargin": float(request.GET.get("hmargin", 10)),
        "lwidth": int(request.GET.get("lwidth", 2)),
        "lcolor": request.GET.get("lcolor", "black"),
        "bcolor": request.GET.get("bcolor", ""),
        "coverage": int(request.GET.get("coverage", 0)),
        "swidth": int(request.GET.get("swidth", 5)),
    }
    if "pred" in request.GET:
        params["pred"] = int(request.GET["pred"])
    if "succ" in request.GET:
        params["succ"] = int(request.GET["succ"])
    return HttpResponse(repertoire_to_svg(params), content_type="image/svg+xml")


@login_required
def train(request):
    """Main view to manage training navigation"""
    if request.method == "POST":
        if "start_custom" in request.POST:
            turn = "turn" not in request.POST
            moves = list()
            judge_board = chess.Board()
            for move_san in request.POST["line"].split(" "):
                move_san = move_san.strip()
                if re.match(r"\d+\.", move_san):
                    continue
                try:
                    move = judge_board.parse_san(move_san)
                except ValueError:
                    return redirect("openy:train")
                if judge_board.turn == turn:
                    moves.append("1 " + move.uci())
                else:
                    moves.append("0 " + move.uci())
                judge_board.push(move)
            exercise_obj = models.Exercise.objects.create(
                title="Custom Exercise #%d"
                % (models.Exercise.objects.filter(positiontraining=None).count() + 1),
                description="This exercise was created by a user.",
                starting_position="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                cover_position=judge_board.fen(),
                moves=",".join(moves),
                first_move=turn,
            )
            return redirect("openy:exercise", eid=exercise_obj.id)
        if "start_training" in request.POST:
            trainings = models.PositionTraining.objects.all()
            profile = models.TrainingProfile.load()
            weights = [
                training.get_training_weight(
                    failure_coef=profile.failure_coef,
                    inactivity_coef=profile.inactivity_coef,
                    ease_coef=profile.ease_coef
                )
                for training in trainings
            ]
            choice = weighted_choice(trainings, weights)
            return redirect("openy:exercise", eid=choice.exercise.id)
    successes = 0
    failures = 0
    success_coverage = ""
    success_ratio = ""
    if models.PositionTraining.objects.exists():
        successes = models.PositionTraining.objects.aggregate(Sum("successes"))[
            "successes__sum"]
        failures = models.PositionTraining.objects.aggregate(Sum("failures"))[
            "failures__sum"]
        success_coverage = "%.1f" % (
            100
            * models.PositionTraining.objects.filter(successes__gte=1).count()
            / models.PositionTraining.objects.all().count()
        )
        if failures + successes == 0:
            success_ratio = ""
        else:
            success_ratio = "%.1f" % (100 * successes / (failures + successes))
    return render(request, "openy/train.html", {
        "recent_trainings":
        models.PositionTraining.objects.exclude(
            last_try=None).order_by("-last_try")[:5],
        "custom_exercises":
        models.Exercise.objects.filter(
            positiontraining=None).order_by("-date_creation"),
        "total_tries": successes + failures,
        "success_ratio": success_ratio.rstrip("0").rstrip("."),
        "success_coverage": success_coverage.rstrip("0").rstrip("."),
        "elo": models.TrainingProfile.load().elo,
    })


def board(request):
    """Simple board view"""
    return render(request, "openy/board.html", {})


@login_required
def exercise(request, eid):
    """View for one exercise session"""
    if not models.Exercise.objects.filter(id=eid).exists():
        return redirect("openy:train")
    exercise_obj = models.Exercise.objects.get(id=eid)
    return render(request, "openy/exercise.html", {
        "exercise": exercise_obj,
    })


@login_required
def exercise_delete(_, eid):
    """Handle exercise deletion link"""
    if not models.Exercise.objects.filter(id=eid).exists():
        return redirect("openy:train")
    models.Exercise.objects.get(id=eid).delete()
    return redirect("openy:train")


@login_required
def exercise_success(_, eid):
    """Notify server that an exercise has been completed with success"""
    if not models.Exercise.objects.filter(id=eid).exists():
        return redirect("openy:train")
    exercise_obj = models.Exercise.objects.get(id=eid)
    if hasattr(exercise_obj, "positiontraining"):
        exercise_obj.positiontraining.add_success()
    return redirect("openy:train")


@login_required
def exercise_failure(request, eid):
    """Notify server that an exercise has been completed without success"""
    if not models.Exercise.objects.filter(id=eid).exists():
        return redirect("openy:train")
    exercise_obj = models.Exercise.objects.get(id=eid)
    if hasattr(exercise_obj, "positiontraining"):
        exercise_obj.positiontraining.add_failure()
        if "progress" in request.GET:
            progress = int(request.GET["progress"]) - 1
            node = exercise_obj.positiontraining.node_leaf
            target = list(reversed(node.ancestors()))[progress]
            return redirect("openy:explore", slug=target.slug)
        return redirect("openy:explore", slug=exercise_obj.positiontraining.node.slug)
    return redirect("openy:train")


@login_required
def graph(request):
    """Fancy draw of the whole repertoire"""
    return render(request, "openy/graph.html", {})


@login_required
def summary(request):
    """Debug interface for exercise ELOs and weights"""
    positions = models.PositionTraining.objects.all()
    profile = models.TrainingProfile.load()
    order_by = request.GET.get("order_by", "computed_weight")
    desc = int(request.GET.get("desc", 1))
    for position in positions:
        position.failure_ratio = position.get_failure_ratio()
        position.inactivity_ratio = position.get_inactivity_ratio()
        position.ease_ratio = position.get_ease_ratio()
        position.computed_weight = position.get_training_weight(
            failure_coef=profile.failure_coef,
            inactivity_coef=profile.inactivity_coef,
            ease_coef=profile.ease_coef
        )
    return render(request, "openy/summary.html", {
        "positions": sorted(
            positions,
            key=lambda position: getattr(position, order_by),
            reverse=desc
        ),
        "order_by": order_by,
        "desc": desc
    })


@login_required
def notes(request):
    """Re-generate a note file with the repertoire"""
    indent = int(request.GET.get("indent", 4))
    text = ""
    for node in models.Node.objects.all().order_by("uid"):
        if node.label == "":
            continue
        text += " " * (node.depth() - 3) * indent + \
            "%s (%s)" % (node.label, node.evaluation)
        if node.comment != "":
            text += " : " + node.comment
        text += "\n"
    response = HttpResponse(text, content_type="text/plain; charset=utf-8")
    if int(request.GET.get("dl", 0)) == 1:
        response["Content-Disposition"] = 'attachment; filename="repertoire.txt"'
    return response


@login_required
def train_position(request):
    """Find an exercise that includes a given FEN position"""
    if request.method == "POST":
        fen = request.POST.get("fen", "").split(" ")[0]
        if models.Node.objects.filter(fen__startswith=fen).exists():
            nodes = list(models.Node.objects
                         .get(fen__startswith=fen)
                         .tree(pred=None, succ=None)[1])
            random.shuffle(nodes)
            for node in nodes:
                query = models.PositionTraining.objects.filter(
                    node_leaf__uid=node.uid)
                if query.exists():
                    return redirect("openy:exercise", eid=query.get().exercise.id)
    return redirect("openy:train")
