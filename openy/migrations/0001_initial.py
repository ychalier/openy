# Generated by Django 3.0.3 on 2020-03-22 16:37

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Node',
            fields=[
                ('uid', models.IntegerField(primary_key=True, serialize=False, unique=True)),
                ('fen', models.CharField(max_length=100)),
                ('evaluation', models.CharField(default='', max_length=10)),
                ('comment', models.TextField(default='')),
                ('label', models.CharField(default='', max_length=20)),
                ('line', models.TextField(default='', max_length=500)),
                ('slug', models.SlugField(max_length=500, unique=True)),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='openy.Node')),
            ],
        ),
    ]
