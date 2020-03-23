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
        "vmargin": float(request.GET.get("vmargin", 10)),
        "hmargin": float(request.GET.get("hmargin", 10)),
        "lines": int(request.GET.get("lines", 0)),
    }
    breadth = get_breadth(root, tree)
    position = get_position(root, tree, breadth, params)
    content = ""
    for uid, pos in position.items():
        if params["lines"] == 1:
            content += '<g style="stroke: black; ">'
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
    return HttpResponse('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s">%s</svg>' % (
        get_viewbox(position, params),
        content
    ), content_type="image/svg+xml")


@login_required
def train(request):
    return render(request, "openy/train.html", {})


@login_required
def request_train(request):
    if request.method == "POST":
        turn = "w"
        if "turn" in request.POST:
            turn = "b"
        fen = request.POST["fen"].split(" ")[0].replace("/", "-")
        return redirect("openy:do_train", turn=turn, fen=fen)
    return redirect("openy:train")


@login_required
def do_train(request, turn, fen):
    turn = turn == "w"
    nodes = models.Node.objects.filter(fen__startswith=fen.replace("-", "/"))
    if not nodes.exists():
        return redirect("openy:train")
    start = random.choice(nodes)
    exercise = [{
        "node": start,
        "ask": (start.turn() ^ turn)
    }]
    while True:
        children = models.Node.objects.filter(parent__uid=exercise[-1]["node"].uid)
        if not children.exists():
            break
        if exercise[-1]["node"].turn() ^ turn:
            child = random.choice(children)
        else:
            child = sorted(children, reverse=turn)[0]
        exercise.append({
            "node": child,
            "ask": (child.turn() ^ turn)
        })
    if exercise[0]["ask"]:
        exercise.pop(0)
    if not exercise[-1]["ask"]:
        exercise.pop()
    return render(request, "openy/do_train.html", {
        "exercise": exercise,
        "start": start,
    })


def board(request):
    return render(request, "openy/board.html", {})
