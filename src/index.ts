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

import {
  IFileBrowserFactory,
  FileBrowser,
  Uploader
} from '@jupyterlab/filebrowser';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import {
  listIcon,
  folderIcon,
  trustedIcon,
  IScore,
  FilenameSearcher
} from '@jupyterlab/ui-components';

import { DRIVE_NAME, FileSystemDrive } from './drive';

/**
 * The class name added to the filebrowser filterbox node.
 */
const FILTERBOX_CLASS = 'jp-FileBrowser-filterBox';

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

    // set some defaults for now
    widget.showFileCheckboxes = false;

    const toolbar = widget.toolbar;
    toolbar.id = 'jp-filesystem-toolbar';

    if (toolbarRegistry && settingRegistry) {
      // Set toolbar
      setToolbar(
        toolbar,
        createToolbarFactory(
          toolbarRegistry,
          settingRegistry,
          DRIVE_NAME,
          plugin.id,
          translator ?? nullTranslator
        ),
        toolbar
      );

      toolbarRegistry.addFactory(
        DRIVE_NAME,
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

      toolbarRegistry.addFactory(
        DRIVE_NAME,
        'open-opfs',
        (browser: FileBrowser) => {
          const openOPFSButton = new ToolbarButton({
            icon: trustedIcon,
            onClick: async () => {
              const directoryHandle = await navigator.storage.getDirectory();
              if (directoryHandle) {
                drive.rootHandle = directoryHandle;
                widget.model.cd('/');
              }
            },
            tooltip: trans.__('Open the Origin Private File System')
          });
          return openOPFSButton;
        }
      );

      toolbarRegistry.addFactory(
        DRIVE_NAME,
        'uploader',
        (browser: FileBrowser) =>
          new Uploader({
            model: widget.model,
            translator
          })
      );

      toolbarRegistry.addFactory(
        DRIVE_NAME,
        'filename-searcher',
        (browser: FileBrowser) => {
          const searcher = FilenameSearcher({
            updateFilter: (
              filterFn: (item: string) => Partial<IScore> | null,
              query?: string
            ) => {
              widget.model.setFilter(value => {
                return filterFn(value.name.toLowerCase());
              });
            },
            useFuzzyFilter: true,
            placeholder: trans.__('Filter files by name'),
            forceRefresh: false
          });
          searcher.addClass(FILTERBOX_CLASS);
          return searcher;
        }
      );
    }

    app.shell.add(widget, 'left', { type: 'FileSystemAccess' });
  }
};

export default plugin;
