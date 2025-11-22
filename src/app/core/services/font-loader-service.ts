import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FontLoaderService {
  private readonly fontFileName = 'OpenSans-Regular.ttf';
  private readonly fontUrl = '/fonts/OpenSans-Regular.ttf';

  // Señales para el estado de carga
  readonly isLoaded: WritableSignal<boolean> = signal(false);
  readonly error: WritableSignal<string | null> = signal(null);

  async initFontLoader(): Promise<void> {
    // Asegurar que el código se ejecute solo en el entorno del navegador
    if (typeof window === 'undefined' || !('FontFace' in window)) {
      return;
    }

    if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
      console.warn('OPFS no es compatible con este navegador. Cargando desde URL.');
      await this.loadFontFromUrl(this.fontUrl);
      return;
    }

    try {
      const root = await navigator.storage.getDirectory();
      let blob: Blob;

      try {
        const fileHandle = await root.getFileHandle(this.fontFileName);
        const file = await fileHandle.getFile();
        blob = file;
        console.log('Fuente cargada desde OPFS.');
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'NotFoundError') {
          console.log('Fuente no encontrada en OPFS. Descargando...');
          blob = await this.downloadAndSaveFont(root);
        } else {
          throw error;
        }
      }

      await this.loadFontFace(blob);
    } catch (err) {
      console.error('Error en el proceso de carga de la fuente:', err);
      this.error.set(err instanceof Error ? err.message : 'Error desconocido');
      // Fallback a carga normal si OPFS falla
      await this.loadFontFromUrl(this.fontUrl);
    }
  }

  private async downloadAndSaveFont(root: FileSystemDirectoryHandle): Promise<Blob> {
    const response = await fetch(this.fontUrl);
    if (!response.ok) {
      throw new Error(`Error al descargar la fuente: ${response.statusText}`);
    }

    const blob = await response.blob();
    const fileHandle = await root.getFileHandle(this.fontFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    console.log('Fuente guardada en OPFS.');
    return blob;
  }

  private async loadFontFace(source: Blob | string): Promise<void> {
    try {
      const sourceUrl = typeof source === 'string' ? source : URL.createObjectURL(source);
      const font = new FontFace('OpenSans', `url(${sourceUrl})`);
      await font.load();
      document.fonts.add(font);
      this.isLoaded.set(true);
      console.log('Fuente OpenSans agregada al documento.');
    } catch (err) {
      console.error('Error al cargar FontFace', err);
      this.error.set(err instanceof Error ? err.message : 'Error al cargar FontFace');
    }
  }

  private async loadFontFromUrl(url: string): Promise<void> {
    await this.loadFontFace(url);
  }
}
