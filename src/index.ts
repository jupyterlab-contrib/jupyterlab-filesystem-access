import { Widget } from '@lumino/widgets';

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { ToolbarButton, setToolbar } from '@jupyterlab/apputils';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { ITranslator } from '@jupyterlab/translation';

import {
  listIcon,
  folderIcon,
  newFolderIcon,
  refreshIcon
} from '@jupyterlab/ui-components';

import { FileSystemDrive } from './drive';

/**
 * Initialization data for the jupyterlab-filesystem-access extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-filesystem-access:plugin',
  requires: [IFileBrowserFactory, ITranslator],
  optional: [ISettingRegistry],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    browser: IFileBrowserFactory,
    translator: ITranslator,
    settingRegistry: ISettingRegistry | null
  ) => {
    if (!window.showDirectoryPicker) {
      // bail if the browser does not support the File System API
      console.warn(
        'The File System Access API is not supported in this browser.'
      );
      return;
    }

    if (settingRegistry) {
      settingRegistry.load(plugin.id);
    }

    const { serviceManager } = app;
    const { createFileBrowser } = browser;

    const trans = translator.load('jupyterlab-filesystem-access');
    const drive = new FileSystemDrive();

    serviceManager.contents.addDrive(drive);

    const widget = createFileBrowser('jp-filesystem-browser', {
      driveName: drive.name,
      // We don't want to restore old state, we don't have a drive handle ready
      restore: false
    });
    widget.title.caption = trans.__('Local File System');
    widget.title.icon = listIcon;

    // Adding a data attribute
    widget.node.setAttribute('data-is-filesystem-access', '');

    const openFolderButton = new ToolbarButton({
      icon: folderIcon,
      onClick: async () => {
        const directoryHandle = await window.showDirectoryPicker();

        if (directoryHandle) {
          drive.rootHandle = directoryHandle;

          // Go to root directory
          widget.model.cd('/');
        }
      },
      tooltip: trans.__('Open a new folder')
    });
    openFolderButton.addClass('jp-FilesystemOpenDirectory');

    setToolbar(widget, (browser: Widget) => [
      {
        name: 'open-folder',
        widget: openFolderButton
      },
      {
        name: 'new-folder',
        widget: new ToolbarButton({
          icon: newFolderIcon,
          onClick: () => {
            widget.createNewDirectory();
          },
          tooltip: trans.__('New Folder')
        })
      },
      {
        name: 'refresher',
        widget: new ToolbarButton({
          icon: refreshIcon,
          onClick: () => {
            widget.model.refresh().catch(reason => {
              console.error(
                'Failed to refresh file browser in open dialog.',
                reason
              );
            });
          },
          tooltip: trans.__('Refresh File List')
        })
      }
    ]);

    app.shell.add(widget, 'left');
  }
};

export default plugin;
