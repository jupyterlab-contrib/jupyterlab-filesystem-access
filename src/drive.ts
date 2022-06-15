import { Contents, ServerConnection } from '@jupyterlab/services';

import { PathExt } from '@jupyterlab/coreutils';

import { ISignal, Signal } from '@lumino/signaling';

export const DRIVE_NAME = 'FileSystem';
const DRIVE_PREFIX = `${DRIVE_NAME}:`;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return window.btoa(binary);
}

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
    return DRIVE_NAME;
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
    path = this.cleanPath(path);

    const root = this._rootHandle;

    if (!root) {
      return {
        name: '',
        path: '',
        created: new Date().toISOString(),
        last_modified: new Date().toISOString(),
        format: null,
        mimetype: '',
        content: null,
        writable: true,
        type: 'directory'
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
      return this.getFileModel(localHandle, parentPath, true);
    } else {
      const content: Contents.IModel[] = [];

      for await (const value of localHandle.values()) {
        if (value.kind === 'file') {
          content.push(
            await this.getFileModel(value, PathExt.join(parentPath, localPath))
          );
        } else {
          content.push({
            name: value.name,
            path: PathExt.join(parentPath, localPath, value.name),
            created: '',
            last_modified: '',
            format: null,
            mimetype: '',
            content: null,
            writable: true,
            type: 'directory'
          });
        }
      }

      return {
        name: localPath,
        path: PathExt.join(parentPath, localPath),
        last_modified: '',
        created: '',
        format: null,
        mimetype: '',
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
    let parentPath = '';
    if (options && options.path) {
      parentPath = this.cleanPath(options.path);
    }

    const type = options?.type || 'directory';
    const path = PathExt.join(
      parentPath,
      type === 'directory' ? 'Untitled Folder' : 'untitled'
    );
    const ext = options?.ext || 'txt';

    const parentHandle = await this.getParentHandle(path);

    let localPath = PathExt.basename(path);
    const name = localPath;

    let data: Contents.IModel;
    if (type === 'directory') {
      let i = 1;
      while (await this.hasHandle(parentHandle, localPath)) {
        localPath = `${name} ${i++}`;
      }

      await parentHandle.getDirectoryHandle(localPath, { create: true });

      data = await this.get(PathExt.join(parentPath, localPath));
    } else {
      let i = 1;
      while (await this.hasHandle(parentHandle, `${localPath}.${ext}`)) {
        localPath = `${name}${i++}`;
      }

      const filename = `${localPath}.${ext}`;

      await parentHandle.getFileHandle(filename, { create: true });

      data = await this.get(PathExt.join(parentPath, filename));
    }

    this._fileChanged.emit({
      type: 'new',
      oldValue: null,
      newValue: data
    });

    return data;
  }

  async delete(path: string): Promise<void> {
    path = this.cleanPath(path);

    const parentHandle = await this.getParentHandle(path);

    await parentHandle.removeEntry(PathExt.basename(path), { recursive: true });

    this._fileChanged.emit({
      type: 'delete',
      oldValue: { path: path },
      newValue: null
    });
  }

  async rename(oldPath: string, newPath: string): Promise<Contents.IModel> {
    // Best effort, we are lacking proper APIs for renaming
    oldPath = this.cleanPath(oldPath);
    newPath = this.cleanPath(newPath);

    await this.doCopy(oldPath, newPath);

    await this.delete(oldPath);

    return this.get(newPath);
  }

  async save(
    path: string,
    options?: Partial<Contents.IModel>
  ): Promise<Contents.IModel> {
    path = this.cleanPath(path);

    const parentHandle = await this.getParentHandle(path);

    if (options?.type === 'directory') {
      await parentHandle.getDirectoryHandle(PathExt.basename(path), {
        create: true
      });

      return this.get(path);
    }

    const handle = await parentHandle.getFileHandle(PathExt.basename(path), {
      create: true
    });
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

  async copy(path: string, toLocalDir: string): Promise<Contents.IModel> {
    // Best effort, we are lacking proper APIs for copying
    path = this.cleanPath(path);

    const toCopy = await this.get(path);
    const parentPath = PathExt.dirname(path);

    let newName = toCopy.name;
    if (parentPath === toLocalDir) {
      const ext = PathExt.extname(toCopy.name);

      if (ext) {
        newName = `${newName.slice(
          0,
          newName.length - ext.length
        )} (Copy)${ext}`;
      } else {
        newName = `${newName} (Copy)`;
      }
    }

    const newPath = PathExt.join(toLocalDir, newName);

    await this.doCopy(path, newPath);

    return this.get(newPath);
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

  private async getFileModel(
    handle: FileSystemFileHandle,
    path: string,
    content?: boolean
  ): Promise<Contents.IModel> {
    const file = await handle.getFile();
    let format: Contents.FileFormat;
    let fileContent: any = null;

    // We assume here image, audio and video mimetypes are all and only binary files we'll encounter
    if (
      file.type &&
      file.type.split('/') &&
      ['image', 'audio', 'video'].includes(file.type.split('/')[0])
    ) {
      format = 'base64';
    } else {
      format = 'text';
    }

    if (content) {
      if (format === 'base64') {
        fileContent = arrayBufferToBase64(await file.arrayBuffer());
      } else {
        fileContent = await file.text();
      }
    }

    return {
      name: file.name,
      path: PathExt.join(path, file.name),
      created: new Date(file.lastModified).toISOString(),
      last_modified: new Date(file.lastModified).toISOString(),
      format,
      content: fileContent,
      writable: true,
      type: 'file',
      mimetype: file.type
    };
  }

  private async doCopy(oldPath: string, newPath: string): Promise<void> {
    // Best effort, we are lacking proper APIs for copying
    const oldParentHandle = await this.getParentHandle(oldPath);

    const oldLocalPath = PathExt.basename(oldPath);

    let oldHandle: FileSystemDirectoryHandle | FileSystemFileHandle;

    if (oldLocalPath) {
      oldHandle = await this.getHandle(oldParentHandle, oldLocalPath);
    } else {
      oldHandle = oldParentHandle;
    }

    const newParentHandle = await this.getParentHandle(newPath);

    const newLocalPath = PathExt.basename(newPath);

    if (oldHandle.kind === 'directory') {
      // If it's a directory, create directory, then doCopy for the directory content
      await newParentHandle.getDirectoryHandle(newLocalPath, { create: true });

      for await (const content of oldHandle.values()) {
        await this.doCopy(
          PathExt.join(oldPath, content.name),
          PathExt.join(newPath, content.name)
        );
      }
    } else {
      // If it's a file, copy the file content
      const newFileHandle = await newParentHandle.getFileHandle(newLocalPath, {
        create: true
      });

      const writable = await newFileHandle.createWritable({});
      const file = await oldHandle.getFile();
      const data = await file.arrayBuffer();
      writable.write(data);
      await writable.close();
    }
  }

  private cleanPath(path: string): string {
    if (path.includes(DRIVE_PREFIX)) {
      return path.replace(DRIVE_PREFIX, '');
    }
    return path;
  }

  private _isDisposed = false;
  private _fileChanged = new Signal<Contents.IDrive, Contents.IChangedArgs>(
    this
  );
  private _rootHandle: FileSystemDirectoryHandle | null = null;
}
