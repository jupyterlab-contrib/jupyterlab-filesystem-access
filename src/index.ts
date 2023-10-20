import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  createToolbarFactory,
  setToolbar,
  IToolbarWidgetRegistry,
  ToolbarButton
} from '@jupyterlab/apputils';

import { IFileBrowserFactory, FileBrowser } from '@jupyterlab/filebrowser';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import { listIcon, folderIcon } from '@jupyterlab/ui-components';

import { FileSystemDrive } from './drive';

/**
 * The file browser factory
 */
const FILE_BROWSER_FACTORY = 'FileSystemAccess';

/**
 * Initialization data for the jupyterlab-filesystem-access extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-filesystem-access:plugin',
  requires: [IFileBrowserFactory, ITranslator],
  optional: [ISettingRegistry, IToolbarWidgetRegistry],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    browser: IFileBrowserFactory,
    translator: ITranslator,
    settingRegistry: ISettingRegistry | null,
    toolbarRegistry: IToolbarWidgetRegistry | null
  ) => {
    const showDirectoryPicker = window.showDirectoryPicker;
    if (!showDirectoryPicker) {
      // bail if the browser does not support the File System API
      console.warn(
        'The File System Access API is not supported in this browser.'
      );
      return;
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

    const toolbar = widget.toolbar;
    toolbar.id = 'jp-filesystem-toolbar';

    if (toolbarRegistry && settingRegistry) {
      // Set toolbar
      setToolbar(
        toolbar,
        createToolbarFactory(
          toolbarRegistry,
          settingRegistry,
          FILE_BROWSER_FACTORY,
          plugin.id,
          translator ?? nullTranslator
        ),
        toolbar
      );

      toolbarRegistry.addFactory(
        FILE_BROWSER_FACTORY,
        'open-folder',
        (browser: FileBrowser) => {
          const openDirectoryButton = new ToolbarButton({
            icon: folderIcon,
            onClick: async () => {
              const directoryHandle = await showDirectoryPicker();

              if (directoryHandle) {
                drive.rootHandle = directoryHandle;

                // Go to root directory
                widget.model.cd('/');
              }
            },
            tooltip: trans.__('Open a new folder')
          });
          return openDirectoryButton;
        }
      );
    }

    app.shell.add(widget, 'left', { type: 'FileSystemAccess' });
  }
};

export default plugin;
