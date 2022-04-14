Access your local file system from JupyterLab
=============================================

Browse local files using the non-standard Web Browser File System Access API.

.. warning::

    This extension is compatible with Chromium-based browsers only (for now)

Motivation
----------

The main motivation for this extension is to give access to local files in JupyterLite: https://github.com/jupyterlite/jupyterlite/issues/403

It can also be used on hosted and ephemeral JupyterLab deployments such as [Binder](https://mybinder.org).

Requirements
------------

- JupyterLab >= 3.0

Install
-------

To install the extension, execute:

.. code::

    pip install jupyterlab-filesystem-access

Try it online
-------------

You can try jupyterlab-filesystem-access directly in this documentation page thanks to JupyterLite!

.. jupyterlite::
