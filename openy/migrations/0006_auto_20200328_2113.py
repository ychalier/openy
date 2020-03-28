# Generated by Django 3.0.3 on 2020-03-28 20:13

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('openy', '0005_auto_20200328_1601'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='positiontraining',
            name='depth',
        ),
        migrations.RemoveField(
            model_name='positiontraining',
            name='node',
        ),
        migrations.RemoveField(
            model_name='positiontraining',
            name='partial',
        ),
        migrations.AddField(
            model_name='positiontraining',
            name='node_leaf',
            field=models.ForeignKey(default=0, on_delete=django.db.models.deletion.CASCADE, related_name='leaf', to='openy.Node'),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='positiontraining',
            name='node_root',
            field=models.ForeignKey(default=0, on_delete=django.db.models.deletion.CASCADE, related_name='root', to='openy.Node'),
            preserve_default=False,
        ),
    ]