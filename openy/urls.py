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
    path("find_entry", views.find_entry, name="find_entry"),
    path("train", views.train, name="train"),
    path("request_train", views.request_train, name="request_train"),
    path("train/<turn>/<fen>", views.do_train, name="do_train"),
    path("board", views.board, name="board"),
]
