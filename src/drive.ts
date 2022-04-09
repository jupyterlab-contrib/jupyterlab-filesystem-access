import { Contents, ServerConnection } from '@jupyterlab/services';

import { ISignal, Signal } from '@lumino/signaling';

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
    localPath: string,
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

    if (localPath) {
      const handle = await root.getFileHandle(localPath);
      const file = await handle.getFile();
      return {
        name: file.name,
        path: file.name,
        created: new Date(file.lastModified).toISOString(),
        last_modified: new Date(file.lastModified).toISOString(),
        format: 'text',
        content: await file.text(),
        writable: true,
        type: 'file',
        mimetype: 'text/plain'
      };
    }

    const content: Contents.IModel[] = [];

    for await (const value of root.values()) {
      if (value.kind === 'file') {
        const file = await value.getFile();
        content.push({
          name: file.name,
          path: file.name,
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
          path: value.name,
          created: new Date().toISOString(),
          last_modified: new Date().toISOString(),
          format: 'json',
          content: null,
          writable: true,
          type: 'directory',
          mimetype: 'application/json'
        });
      }
    }

    const date = new Date();
    return {
      name: 'root',
      path: '',
      last_modified: date.toISOString(),
      created: date.toISOString(),
      format: 'json',
      mimetype: 'application/json',
      content,
      size: undefined,
      writable: true,
      type: 'directory'
    };
  }

  getDownloadUrl(localPath: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  newUntitled(options?: Contents.ICreateOptions): Promise<Contents.IModel> {
    throw new Error('Method not implemented.');
  }

  delete(localPath: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  rename(oldLocalPath: string, newLocalPath: string): Promise<Contents.IModel> {
    throw new Error('Method not implemented.');
  }

  async save(
    localPath: string,
    options?: Partial<Contents.IModel>
  ): Promise<Contents.IModel> {
    const root = this._rootHandle;

    if (!root) {
      throw new Error('No root file handle');
    }

    const handle = await root.getFileHandle(localPath);
    const writable = await handle.createWritable({});
    const content = options?.content;
    await writable.write(content);
    await writable.close();
    return this.get(localPath);
  }

  copy(localPath: string, toLocalDir: string): Promise<Contents.IModel> {
    throw new Error('Method not implemented.');
  }

  async createCheckpoint(
    localPath: string
  ): Promise<Contents.ICheckpointModel> {
    return {
      id: 'test',
      last_modified: new Date().toISOString()
    };
  }

  async listCheckpoints(
    localPath: string
  ): Promise<Contents.ICheckpointModel[]> {
    return [
      {
        id: 'test',
        last_modified: new Date().toISOString()
      }
    ];
  }

  restoreCheckpoint(localPath: string, checkpointID: string): Promise<void> {
    return Promise.resolve(void 0);
  }

  deleteCheckpoint(localPath: string, checkpointID: string): Promise<void> {
    return Promise.resolve(void 0);
  }

  private _isDisposed = false;
  private _fileChanged = new Signal<Contents.IDrive, Contents.IChangedArgs>(
    this
  );
  private _rootHandle: FileSystemDirectoryHandle | null = null;
}
