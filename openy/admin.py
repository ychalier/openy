from django.contrib import admin
from . import models

admin.site.register(models.Node)
admin.site.register(models.Exercise)
admin.site.register(models.PositionTraining)
admin.site.register(models.TrainingProfile)
