"""Django views"""

import json
import random
from django.http import HttpResponse
from django.shortcuts import render
from django.shortcuts import redirect
from django.contrib.auth.decorators import login_required
from django.template.defaultfilters import slugify
from django.urls import reverse
from . import models


@login_required
def home(request):
    """Short presentation abstract"""
    return render(request, "openy/home.html", {})


@login_required
def settings(request):
    """Control the application behavior"""
    return render(request, "openy/settings.html", {})


@login_required
def upload(request):
    """Upload a new repertoire, which overrides any previous data"""
    if request.method == "POST" and request.FILES["file"]:
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


def get_breadth(root, tree):
    """Compute the maximum breadth of a tree"""
    breadth = dict()

    def set_breadth(uid):
        if uid not in breadth:
            if uid not in tree:
                tree[uid] = list()
                breadth[uid] = 1
            elif len(tree[uid]) == 0:
                breadth[uid] = 1
            else:
                breadth[uid] = sum([set_breadth(child_uid)
                                    for child_uid in tree[uid]])
        return breadth[uid]
    set_breadth(root)
    return breadth


def get_position(root, tree, breadth, params):
    """Compute the positions of nodes before drawing them"""
    def width(uid):
        return (params["radius"] * 2 + params["hmargin"]) * float(breadth[uid])
    position = {root: (0, 0)}

    def set_position(uid):
        for i, child in enumerate(tree[uid]):
            position[child] = [
                position[uid][0]
                - .5 * width(uid)
                + .5 * width(child)
                + sum(width(tree[uid][j]) for j in range(i)),
                position[uid][1] + params["radius"] * 2 + params["vmargin"]
            ]
            set_position(child)
    set_position(root)
    return position


def get_viewbox(position, params):
    """Compute the SVG viewBox given the set of computed node positions"""
    min_x = min([p[0] for p in position.values()])
    max_x = max([p[0] for p in position.values()])
    min_y = min([p[1] for p in position.values()])
    max_y = max([p[1] for p in position.values()])
    return "%.2f %.2f %.2f %.2f" % (
        min_x - params["radius"] - params["hmargin"],
        min_y - params["radius"] - params["vmargin"],
        max_x - min_x + 2 * params["radius"] + 2 * params["hmargin"],
        max_y - min_y + 2 * params["radius"] + 2 * params["vmargin"]
    )


@login_required
def draw(request):
    """Build a SVG from the database"""
    index = {node.uid: node for node in models.Node.objects.all()}
    root, tree = index[int(request.GET.get("center", 0))].tree(
        pred=request.GET.get("pred", None),
        succ=request.GET.get("succ", None)
    )
    params = {
        "radius": float(request.GET.get("radius", 50)),
        "vmargin": float(request.GET.get("vmargin", 20)),
        "hmargin": float(request.GET.get("hmargin", 20)),
        "lines": int(request.GET.get("lines", 0)),
    }
    breadth = get_breadth(root, tree)
    position = get_position(root, tree, breadth, params)
    content = ""
    for uid, pos in position.items():
        if params["lines"] == 1:
            content += '<g style="stroke: white; ">'
        else:
            content += "<g>"
        for child in tree[uid]:
            content += '<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f" />'\
                % (pos[0], pos[1], position[child][0], position[child][1])
        content += "</g>"
        content += "".join([
            '<a class="node" uid="%s" href="%s">'
            % (uid, index[uid].href()),
            '<circle cx="%.2f" cy="%.2f" r="%.2f" fill="%s" />'
            % (pos[0], pos[1], params["radius"], index[uid].color()),
            '<text x="%.2f" y="%.2f" text-anchor="middle" fill="#FFF" dy=".3em">%s</text>'
            % (pos[0], pos[1], index[uid].label),
            '</a>'
        ])
    style = ""
    # if params["lines"] == 1:
    #     style = 'style="background: #202020; font-family: Segoe UI"'
    return HttpResponse('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" %s >%s</svg>' % (
        get_viewbox(position, params),
        style,
        content
    ), content_type="image/svg+xml")


@login_required
def train(request):
    if request.method == "POST":
        turn = "turn" not in request.POST
        fen = request.POST["fen"]
        nodes = models.Node.objects.filter(fen__startswith=fen.split(" ")[0])
        if nodes.exists():
            start = random.choice(nodes)
            node_selection = list()
            for ancestor in reversed(start.ancestors()):
                node_selection.append({
                    "node": ancestor,
                    "ask": False,
                })
            while True:
                children = models.Node.objects.filter(parent__uid=node_selection[-1]["node"].uid)
                if not children.exists():
                    break
                if node_selection[-1]["node"].turn() ^ turn:
                    child = random.choice(children)
                else:
                    child = sorted(children, reverse=turn)[0]
                node_selection.append({
                    "node": child,
                    "ask": (child.turn() ^ turn)
                })
            if not node_selection[-1]["ask"]:
                node_selection.pop()
            cover_position = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            for selected in node_selection:
                if selected["ask"]:
                    break
                cover_position = selected["node"].fen
            def format_bool(var):
                if var:
                    return "1"
                return "0"
            exercise_obj = models.Exercise.objects.create(
                title="Opening Training",
                description="This exercise was generated by the Openy trainer.",
                starting_position="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                cover_position=cover_position,
                moves=",".join([
                    "%s %s" % (format_bool(selected["ask"]), selected["node"].move_uci())
                    for selected in node_selection
                    if selected["node"].uid > 0
                ]),
                first_move=turn,
            )
            return redirect("openy:exercise", eid=exercise_obj.id)
    remaining_exercises = models.Exercise.objects.all().order_by("date_creation")
    return render(request, "openy/train.html", {
        "remaining_exercises": remaining_exercises,
    })


def board(request):
    return render(request, "openy/board.html", {})


@login_required
def exercise(request, eid):
    if not models.Exercise.objects.filter(id=eid).exists():
        return redirect("openy:train")
    exercise_obj = models.Exercise.objects.get(id=eid)
    return render(request, "openy/exercise.html", {
        "exercise": exercise_obj,
    })


@login_required
def exercise_done(_, eid):
    if not models.Exercise.objects.filter(id=eid).exists():
        return redirect("openy:train")
    models.Exercise.objects.get(id=eid).delete()
    return redirect("openy:train")


@login_required
def graph(request):
    return render(request, "openy/graph.html", {})
