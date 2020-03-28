from django.urls import path
from . import views

app_name = "openy"

urlpatterns = [
    path("", views.home, name="home"),
    path("settings", views.settings, name="settings"),
    path("upload", views.upload, name="upload"),
    path("draw", views.draw, name="draw"),
    path("explore", views.explore, name="explore_root"),
    path("explore/<slug>", views.explore, name="explore"),
    path("node/<uid>", views.explore_node, name="explore_node"),
    path("find_entry", views.find_entry, name="find_entry"),
    path("train", views.train, name="train"),
    path("train-position", views.train_position, name="train_position"),
    path("board", views.board, name="board"),
    path("exercise/<eid>", views.exercise, name="exercise"),
    path("exercise/<eid>/delete", views.exercise_delete, name="exercise_delete"),
    path("exercise/<eid>/failure", views.exercise_failure, name="exercise_failure"),
    path("exercise/<eid>/success", views.exercise_success, name="exercise_success"),
    path("graph", views.graph, name="graph"),
    path("summary", views.summary, name="summary"),
    path("notes", views.notes, name="notes"),
]
