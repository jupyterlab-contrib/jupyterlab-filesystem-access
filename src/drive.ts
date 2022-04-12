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

    const parentHandle = await this.getParentHandle(path);

    const parentPath = PathExt.dirname(path);
    const localPath = PathExt.basename(path);

    let localHandle: FileSystemDirectoryHandle | FileSystemFileHandle;

    if (localPath) {
      localHandle = await this.getHandle(parentHandle, localPath);
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
        name: localPath,
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

  async newUntitled(
    options?: Contents.ICreateOptions
  ): Promise<Contents.IModel> {
    const type = options?.type || 'directory';
    const path = PathExt.join(
      options?.path || '',
      type === 'directory' ? 'Untitled Folder' : 'untitled'
    );
    const ext = options?.ext || 'txt';

    const parentHandle = await this.getParentHandle(path);

    const parentPath = PathExt.dirname(path);
    let localPath = PathExt.basename(path);
    const name = localPath;

    if (type === 'directory') {
      let i = 1;
      while (await this.hasHandle(parentHandle, localPath)) {
        localPath = `${name} ${i++}`;
      }

      await parentHandle.getDirectoryHandle(localPath, { create: true });

      return this.get(PathExt.join(parentPath, localPath));
    } else {
      let i = 1;
      while (await this.hasHandle(parentHandle, `${localPath}.${ext}`)) {
        localPath = `${name}${i++}`;
      }

      const filename = `${localPath}.${ext}`;

      await parentHandle.getFileHandle(filename, { create: true });

      return this.get(PathExt.join(parentPath, filename));
    }
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
    const parentHandle = await this.getParentHandle(path);

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

  private async getParentHandle(
    path: string
  ): Promise<FileSystemDirectoryHandle> {
    const root = this._rootHandle;

    if (!root) {
      throw new Error('No root file handle');
    }

    let parentHandle = root;
    // If saving a file that is not under root, we need the right directory handle
    for (const subPath of path.split('/').slice(0, -1)) {
      parentHandle = await parentHandle.getDirectoryHandle(subPath);
    }

    return parentHandle;
  }

  private async getHandle(
    parentHandle: FileSystemDirectoryHandle,
    localPath: string
  ): Promise<FileSystemDirectoryHandle | FileSystemFileHandle> {
    const content = await toArray(parentHandle.values());

    const matches = content.filter(element => element.name === localPath);

    if (matches.length) {
      return matches[0];
    }

    throw new Error(`${localPath} does not exist.`);
  }

  private async hasHandle(
    parentHandle: FileSystemDirectoryHandle,
    localPath: string
  ): Promise<boolean> {
    const content = await toArray(parentHandle.values());

    const matches = content.filter(element => element.name === localPath);

    return Boolean(matches.length);
  }

  private _isDisposed = false;
  private _fileChanged = new Signal<Contents.IDrive, Contents.IChangedArgs>(
    this
  );
  private _rootHandle: FileSystemDirectoryHandle | null = null;
}
