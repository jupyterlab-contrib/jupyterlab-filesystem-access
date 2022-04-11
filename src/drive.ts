import { Contents, ServerConnection } from '@jupyterlab/services';

import { PathExt } from '@jupyterlab/coreutils';

import { ISignal, Signal } from '@lumino/signaling';

async function toArray<T>(
  asyncIterator: AsyncIterableIterator<T>
): Promise<T[]> {
  const arr = [];

  for await (const i of asyncIterator) {
    arr.push(i);
  }

  return arr;
}

export class FileSystemDrive implements Contents.IDrive {
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
  }

  get name(): string {
    return 'FileSystem';
  }

  get serverSettings(): ServerConnection.ISettings {
    return ServerConnection.makeSettings();
  }

  get fileChanged(): ISignal<Contents.IDrive, Contents.IChangedArgs> {
    return this._fileChanged;
  }

  get rootHandle(): FileSystemDirectoryHandle | null {
    return this._rootHandle;
  }

  set rootHandle(handle: FileSystemDirectoryHandle | null) {
    this._rootHandle = handle;
  }

  async get(
    path: string,
    options?: Contents.IFetchOptions
  ): Promise<Contents.IModel> {
    const root = this._rootHandle;

    if (!root) {
      return {
        name: '',
        path: '',
        created: new Date().toISOString(),
        last_modified: new Date().toISOString(),
        format: 'json',
        content: null,
        writable: true,
        type: 'directory',
        mimetype: 'application/json'
      };
    }

    let parentHandle = root;
    // If requesting a file/directory that is not under root, we need the right directory handle
    for (const subPath of path.split('/').slice(0, -1)) {
      parentHandle = await parentHandle.getDirectoryHandle(subPath);
    }

    const parentPath = PathExt.dirname(path);
    const localPath = PathExt.basename(path);

    let localHandle: FileSystemDirectoryHandle | FileSystemFileHandle;

    const currentContent = await toArray(parentHandle.values());

    if (localPath) {
      localHandle = currentContent.filter(
        element => element.name === localPath
      )[0];
    } else {
      localHandle = parentHandle;
    }

    if (localHandle.kind === 'file') {
      const file = await localHandle.getFile();

      return {
        name: file.name,
        path: PathExt.join(parentPath, localPath),
        created: new Date(file.lastModified).toISOString(),
        last_modified: new Date(file.lastModified).toISOString(),
        format: 'text',
        content: await file.text(),
        writable: true,
        type: 'file',
        mimetype: 'text/plain'
      };
    } else {
      const content: Contents.IModel[] = [];

      for await (const value of localHandle.values()) {
        if (value.kind === 'file') {
          const file = await value.getFile();
          content.push({
            name: file.name,
            path: PathExt.join(parentPath, localPath, file.name),
            created: new Date(file.lastModified).toISOString(),
            last_modified: new Date(file.lastModified).toISOString(),
            format: 'text',
            content: await file.text(),
            writable: true,
            type: 'file',
            mimetype: 'text/plain'
          });
        } else {
          content.push({
            name: value.name,
            path: PathExt.join(parentPath, localPath, value.name),
            created: '',
            last_modified: '',
            format: 'json',
            content: null,
            writable: true,
            type: 'directory',
            mimetype: 'application/json'
          });
        }
      }

      return {
        name: PathExt.basename(parentPath),
        path: PathExt.join(parentPath, localPath),
        last_modified: '',
        created: '',
        format: 'json',
        mimetype: 'application/json',
        content,
        size: undefined,
        writable: true,
        type: 'directory'
      };
    }
  }

  getDownloadUrl(path: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  newUntitled(options?: Contents.ICreateOptions): Promise<Contents.IModel> {
    throw new Error('Method not implemented.');
  }

  delete(path: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  rename(oldPath: string, newPath: string): Promise<Contents.IModel> {
    throw new Error('Method not implemented.');
  }

  async save(
    path: string,
    options?: Partial<Contents.IModel>
  ): Promise<Contents.IModel> {
    const root = this._rootHandle;

    if (!root) {
      throw new Error('No root file handle');
    }

    let parentHandle = root;
    // If saving a file that is not under root, we need the right directory handle
    for (const subPath of path.split('/').slice(0, -1)) {
      parentHandle = await parentHandle.getDirectoryHandle(subPath);
    }

    const handle = await parentHandle.getFileHandle(PathExt.basename(path));
    const writable = await handle.createWritable({});

    const format = options?.format;
    const content = options?.content;
    if (format === 'json') {
      const data = JSON.stringify(content, null, 2);
      await writable.write(data);
    } else {
      await writable.write(content);
    }
    await writable.close();
    return this.get(path);
  }

  copy(path: string, toLocalDir: string): Promise<Contents.IModel> {
    throw new Error('Method not implemented.');
  }

  async createCheckpoint(path: string): Promise<Contents.ICheckpointModel> {
    return {
      id: 'test',
      last_modified: new Date().toISOString()
    };
  }

  async listCheckpoints(path: string): Promise<Contents.ICheckpointModel[]> {
    return [
      {
        id: 'test',
        last_modified: new Date().toISOString()
      }
    ];
  }

  restoreCheckpoint(path: string, checkpointID: string): Promise<void> {
    return Promise.resolve(void 0);
  }

  deleteCheckpoint(path: string, checkpointID: string): Promise<void> {
    return Promise.resolve(void 0);
  }

  private _isDisposed = false;
  private _fileChanged = new Signal<Contents.IDrive, Contents.IChangedArgs>(
    this
  );
  private _rootHandle: FileSystemDirectoryHandle | null = null;
}
