Openy
=====

**Openy** is a Django_ application to learn chess openings. It takes textual
notes as input, and provides tools to explore and memorize them.

Getting Started
---------------

Prerequisites
~~~~~~~~~~~~~

You'll need a version of Python that runs Django 3.0.4, ie. 3.6 or above.

Installation
~~~~~~~~~~~~

Installation follows basic Django applications installation process.

1. Install the module from its custom package repository:
    ::

      pip install --extra-index-url="https://packages.chalier.fr" django-openy

2. Add ``'openy'`` to your Django project ``INSTALLED_APPS``
3. Migrate the database:
    ::

      python manage.py migrate

4. Collect the new static files:
    ::

      python manage.py collecstatic

5. Integrate ``openy.urls`` in your project URLs

And that's it!

Database initialization
~~~~~~~~~~~~~~~~~~~~~~~

First, write notes in a text file, with the following format:
::

   1. e4 : Takes the center
      1. ... e5 : Again, black takes the center
          2. Nf3
              2. ... Nc6
                  3. d4 : Scotch opening
      1. ... c5 : Sicilian defence

Note that indentation is ignored by the parser, as well as blank lines or any
line not following that format (i.e. one move per line, in
`standard algebraic notation`_, possibly followed by a textual comment ;
respect punctuation and spaces in the example for lines to be correctly parsed).

Second, use the parsing script ``scripts/parser.py``. It requires a UCI chess
engine executable, such as Stockfish_ or Komodo_. It will output a JSON file
(called by default ``repertoire.json``).

Finally, upload this JSON file to the website through the form in Openy's
settings. This will populate the database with your notes.

Built With
----------

- Some SVG icons are imported from the `Bytesize Icons`_ library.
- Theme and piece graphics are from the `Chess.com`_ website.
- Python's chess mechanics are implemented by the `python-chess`_ module.

Contributing
------------

Contributions are welcomed. Open issues and pull requests when you want to
submit something.

License
-------

This project is licensed under the MIT License.

.. _Django: https://www.djangoproject.com/
.. _Bytesize Icons: https://github.com/danklammer/bytesize-icons
.. _Chess.com: https://www.chess.com/
.. _python-chess: https://python-chess.readthedocs.io/en/latest/
.. _standard algebraic notation: https://en.wikipedia.org/wiki/Algebraic_notation_(chess)
.. _Stockfish: https://stockfishchess.org/
.. _Komodo: https://komodochess.com/
