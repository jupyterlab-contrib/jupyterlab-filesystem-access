import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IToolbarWidgetRegistry,
  setToolbar,
  ToolbarButton,
  ToolbarRegistry
} from '@jupyterlab/apputils';
import { FileBrowser, IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { IObservableList, ObservableList } from '@jupyterlab/observables';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator } from '@jupyterlab/translation';
import { folderIcon, listIcon } from '@jupyterlab/ui-components';
import { toArray } from '@lumino/algorithm';
import { JSONExt } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';
import { FileSystemDrive } from './drive';

/**
 * Initialization data for the jupyterlab-filesystem-access extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-filesystem-access:plugin',
  requires: [IFileBrowserFactory, ITranslator, IToolbarWidgetRegistry],
  optional: [ISettingRegistry],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    browser: IFileBrowserFactory,
    translator: ITranslator,
    toolbarRegistry: IToolbarWidgetRegistry,
    settingRegistry: ISettingRegistry | null
  ) => {
    if (!window.showDirectoryPicker) {
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

    // Adding a data attribute
    widget.node.setAttribute('data-is-filesystem-access', '');

    toolbarRegistry.registerFactory(
      'FileBrowser', // Factory name
      'OpenNewFolder',
      (browser: FileBrowser) => {
        const button = new ToolbarButton({
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
        button.addClass('jp-FilesystemOpenDirectory');
        return button;
      }
    );

    if (settingRegistry) {
      setToolbar(
        widget,
        Private.createToolbarFactory(
          toolbarRegistry,
          settingRegistry,
          'FileBrowser',
          'jupyterlab-filesystem-access:plugin',
          translator
        )
      );
    }

    app.shell.add(widget, 'left');
  }
};

export default plugin;

namespace Private {
  /**
   * Create the toolbar factory for a given container widget based
   * on a data description stored in settings
   *
   * @param toolbarRegistry Toolbar widgets registry
   * @param settingsRegistry Settings registry
   * @param factoryName Toolbar container factory name
   * @param pluginId Settings plugin id
   * @param translator Translator
   * @param propertyId Toolbar definition key in the settings plugin
   * @returns List of toolbar widgets factory
   */
  export function createToolbarFactory(
    toolbarRegistry: IToolbarWidgetRegistry,
    settingsRegistry: ISettingRegistry,
    factoryName: string,
    pluginId: string,
    translator: ITranslator,
    propertyId = 'toolbar'
  ): (widget: Widget) => IObservableList<ToolbarRegistry.IToolbarItem> {
    const items = new ObservableList<ISettingRegistry.IToolbarItem>({
      itemCmp: (a, b) => JSONExt.deepEqual(a as any, b as any)
    });

    // Get toolbar definition from the settings
    settingsRegistry
      .load(pluginId)
      .then(settings => {
        // React to customization by the user
        settings.changed.connect(() => {
          const newItems: ISettingRegistry.IToolbarItem[] =
            (settings.composite[propertyId] as any) ?? [];

          transferSettings(newItems);
        });

        const transferSettings = (
          newItems: ISettingRegistry.IToolbarItem[]
        ) => {
          // This is not optimal but safer because a toolbar item with the same
          // name cannot be inserted (it will be a no-op). But that could happen
          // if the settings are changing the items order.
          items.clear();
          items.pushAll(newItems.filter(item => !item.disabled));
        };

        // Initialize the toolbar
        transferSettings((settings.composite[propertyId] as any) ?? []);
      })
      .catch(reason => {
        console.error(
          `Failed to load toolbar items for factory ${factoryName} from ${pluginId}`,
          reason
        );
      });

    return (widget: Widget) => {
      const updateToolbar = (
        list: IObservableList<ToolbarRegistry.IWidget>,
        change: IObservableList.IChangedArgs<ToolbarRegistry.IWidget>
      ) => {
        switch (change.type) {
          case 'move':
            toolbar.move(change.oldIndex, change.newIndex);
            break;
          case 'add':
            change.newValues.forEach(item =>
              toolbar.push({
                name: item.name,
                widget: toolbarRegistry.createWidget(factoryName, widget, item)
              })
            );
            break;
          case 'remove':
            change.oldValues.forEach(() => toolbar.remove(change.oldIndex));
            break;
          case 'set':
            change.newValues.forEach(item =>
              toolbar.set(change.newIndex, {
                name: item.name,
                widget: toolbarRegistry.createWidget(factoryName, widget, item)
              })
            );
            break;
        }
      };

      const toolbar = new ObservableList<ToolbarRegistry.IToolbarItem>({
        values: toArray(items).map(item => {
          return {
            name: item.name,
            widget: toolbarRegistry.createWidget(factoryName, widget, item)
          };
        })
      });

      items.changed.connect(updateToolbar);
      widget.disposed.connect(() => {
        items.changed.disconnect(updateToolbar);
      });

      return toolbar;
    };
  }
}
