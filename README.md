# jupyterlab-filesystem-access

[![ci-badge]][ci] [![lite-badge]][lite] [![docs-badge]][docs]

[ci-badge]: https://github.com/jupyterlab-contrib/jupyterlab-filesystem-access/workflows/Build/badge.svg
[ci]: https://github.com/jupyterlab-contrib/jupyterlab-filesystem-access/actions?query=branch%3Amain
[lite-badge]: https://jupyterlite.rtfd.io/en/latest/_static/badge.svg
[lite]: https://jupyterlab-filesystem-access.readthedocs.io/en/latest/lite/lab
[docs-badge]: https://readthedocs.org/projects/jupyterlab-filesystem-access/badge/?version=latest
[docs]: https://jupyterlab-filesystem-access.readthedocs.io/en/latest/?badge=latest

Browse local files using the non-standard Web Browser File System Access API.

⚠️ **This extension is compatible with Chromium-based browsers only (for now)** ⚠️

![image](https://user-images.githubusercontent.com/591645/162558622-3cc357a6-eb7c-4147-860d-1c8973eeee29.png)

More info on MDN: https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker

https://user-images.githubusercontent.com/591645/160241594-6b363b06-2103-445a-ac68-9ecc6104e0c4.mp4

## Motivation

The main motivation for this extension is to give access to local files in JupyterLite: https://github.com/jupyterlite/jupyterlite/issues/403

It can also be used on hosted and ephemeral JupyterLab deployments such as [Binder](https://mybinder.org).

## Requirements

- JupyterLab >= 3.0

## Install

To install the extension, execute:

```bash
pip install jupyterlab-filesystem-access
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyterlab_filesystem_access
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyterlab_filesystem_access directory
# Install package in development mode
pip install -e .
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall jupyterlab_filesystem_access
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `jupyterlab-filesystem-access` within that folder.

### Packaging the extension

See [RELEASE](RELEASE.md)
