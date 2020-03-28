"""This module builds a SVG Tree representation of the nodes in the database."""

from .. import models
from .train import get_node_coverage


class Position:
    """Simple 2D coordinates wrapper"""

    def __init__(self, x, y):
        self.x = x
        self.y = y


class SvgNode:
    """Wrapper for graphic information relative to a node"""

    def __init__(self, node, params):
        self.node = node
        self.params = params
        self.breadth = 0
        self.position = None
        self.coverage = ""

    def scan_breadth(self, tree, index):
        """Set its breadth after having computed its children breadth"""
        if self.node not in index or len(tree[self.node]) == 0:
            self.breadth = 1
        else:
            for child in tree[self.node]:
                child_svg_node = index.get(child, None)
                if child_svg_node is not None:
                    child_svg_node.scan_breadth(tree, index)
                    self.breadth += child_svg_node.breadth
                else:
                    self.breadth = 1

    def scan_position(self, tree, index):
        """Given that its position is set, sets its children's"""
        for i, child in enumerate(tree[self.node]):
            child_svg_node = index.get(child, None)
            if child_svg_node is not None:
                child_svg_node.position = Position(
                    self.position.x - .5 * self.width() + .5 * child_svg_node.width()
                    + sum(index[tree[self.node][j]].width() for j in range(i)),
                    self.position.y + self.params["radius"] * 2 + self.params["vmargin"]
                )
                child_svg_node.scan_position(tree, index)

    def set_coverage(self, index):
        """Set coverage information from a global index"""
        data = index[self.node.uid]
        if data[True] and data[False]:
            self.coverage = "#bf3b3b"
        elif data[True]:
            self.coverage = "#3ba7bf"
        elif data[False]:
            self.coverage = "#bfae3b"

    def width(self):
        """Map this node's breadth to its width in pixels"""
        return (self.params["radius"] * 2 + self.params["hmargin"]) * float(self.breadth)

    def svg(self):
        """Generate the SVG data to plot this node"""
        template = """
        <g class="node" uid="{UID}">
        <a href="{HREF}">
            <circle stroke="{STROKE_COLOR}" cx="{X}" cy="{Y}" r="{RADIUS}" fill="{NODE_COLOR}" />
            <text x="{X}" y="{Y}" fill="{TEXT_COLOR}" dy=".3em">{LABEL}</text>
        </a>
        </g>
        """
        return template.format(
            X=self.position.x,
            Y=self.position.y,
            RADIUS=self.params["radius"],
            NODE_COLOR=self.node.color(),
            TEXT_COLOR="white",
            LABEL=self.node.label.replace(". ...", "..."),
            UID=self.node.uid,
            HREF=self.node.href_short(),
            STROKE_COLOR=self.coverage,
        ).strip()


class SvgLine:
    """Wrapper for graphic information relative to a line between two nodes"""

    def __init__(self, start, end, params):
        self.start = start
        self.end = end
        self.params = params

    def svg(self):
        """Generate the SVG data to plot this link"""
        template = """
        <line x1="{START_X}" y1="{START_Y}" x2="{END_X}" y2="{END_Y}" />
        """
        return template.format(
            START_X=self.start.position.x,
            START_Y=self.start.position.y,
            END_X=self.end.position.x,
            END_Y=self.end.position.y
        ).strip()


def get_viewbox(index, params):
    """Compute the SVG viewBox given the set of computed node positions"""
    positions_x, positions_y = list(), list()
    for node in index.values():
        positions_x.append(node.position.x)
        positions_y.append(node.position.y)
    min_x, max_x = min(positions_x), max(positions_x)
    min_y, max_y = min(positions_y), max(positions_y)
    return "%.2f %.2f %.2f %.2f" % (
        min_x - params["radius"] - params["hmargin"],
        min_y - params["radius"] - params["vmargin"],
        max_x - min_x + 2 * params["radius"] + 2 * params["hmargin"],
        max_y - min_y + 2 * params["radius"] + 2 * params["vmargin"]
    )


def repertoire_to_svg(params):
    """Generate the SVG data plotting nodes from the database.
       Needed parameters are:
       center       Center node UID
       pred         Number of ancestors to include, relative to the center
       succ         Number of successors to include, relative to the center
       radius       Radius of a node in pixels
       hmargin      Horizontal margin between nodes in pixels
       vmargin      Vertical margin between nodes in pixels
       lwidth       Line width in pixels
       lcolor       Line color
       bcolor       Background color (in hexadecimal, without the #)
       coverage     Show nodes coverage (0 (False) or 1 (True))
    """
    root, tree = models.Node.objects.get(uid=params["center"]).tree(
        pred=params["pred"],
        succ=params["succ"]
    )
    svg_nodes = dict()
    for node in tree:
        svg_nodes[node] = SvgNode(node, params)
    svg_lines = list()
    for parent in tree:
        for child in tree[parent]:
            child_svg_node = svg_nodes.get(child, None)
            if child_svg_node is not None:
                svg_lines.append(SvgLine(svg_nodes[parent], child_svg_node, params))
    svg_nodes[root].scan_breadth(tree, svg_nodes)
    svg_nodes[root].position = Position(0, 0)
    svg_nodes[root].scan_position(tree, svg_nodes)
    if params["coverage"]:
        coverage = get_node_coverage()
        for node in svg_nodes.values():
            node.set_coverage(coverage)
    template = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEWBOX}" style="background: #{BG_COLOR}">
    <g>
        <g stroke-width="{LINE_WIDTH}" stroke="{LINE_COLOR}">
        {LINES}
        </g>
        <g text-anchor="middle" stroke-width="{STROKE_WIDTH}">
        {NODES}
        </g>
    </g>
    </svg>
    """
    return template.format(
        NODES="".join(node.svg() for node in svg_nodes.values()),
        VIEWBOX=get_viewbox(svg_nodes, params),
        LINES="".join(line.svg() for line in svg_lines),
        LINE_WIDTH=params["lwidth"],
        LINE_COLOR=params["lcolor"],
        BG_COLOR=params["bcolor"],
        STROKE_WIDTH=params["swidth"],
    ).strip()
