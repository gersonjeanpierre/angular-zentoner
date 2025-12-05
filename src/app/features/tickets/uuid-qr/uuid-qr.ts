import { Component, ViewChild, ElementRef, signal, computed, effect } from '@angular/core';
import { v7 as uuidv7 } from 'uuid';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';

interface UuidHistoryItem {
  id: number;
  uuid: string;
  type: 'generated' | 'scanned';
  timestamp: string;
}

@Component({
  selector: 'app-uuid-qr',
  templateUrl: './uuid-qr.html',
})
export class UuidQr {
  @ViewChild('qrCanvas', { static: false }) qrCanvas?: ElementRef<HTMLCanvasElement>;

  protected uuid = signal<string | null>(null);
  protected scannedUuid = signal<string | null>(null);
  protected scannerActive = signal(false);
  protected uuidHistory = signal<UuidHistoryItem[]>([]);

  private qrCodeScanner: any = null;

  protected timestampInfo = computed(() => {
    if (!this.uuid()) return '';
    return `Generado el ${this.formatDate(new Date())}`;
  });

  protected validBadgeText = computed(() => {
    return this.isValidUuid(this.scannedUuid()) ? 'UUID Válido' : 'No es un UUID válido';
  });
  protected validBadgeClass = computed(() => {
    return this.isValidUuid(this.scannedUuid())
      ? 'bg-green-100 text-green-800'
      : 'bg-amber-100 text-amber-800';
  });
  protected validBadgeIcon = computed(() => {
    return this.isValidUuid(this.scannedUuid()) ? 'fa-check' : 'fa-exclamation-triangle';
  });

  protected generateUuid() {
    const uuidValue = this.generateUuidV7();
    this.uuid.set(uuidValue);
    this.scannedUuid.set(null);
    this.addToHistory(uuidValue, 'generated');
    setTimeout(() => this.renderQrCode(), 100);
  }

  protected copyUuid(uuidValue: string) {
    navigator.clipboard.writeText(uuidValue);
  }

  protected startScanner() {
    this.scannerActive.set(true);
    setTimeout(() => this.initQRScanner(), 300);
  }

  protected stopScanner() {
    if (this.qrCodeScanner && this.qrCodeScanner.isScanning) {
      this.qrCodeScanner.stop().then(() => {
        this.qrCodeScanner.clear();
        this.scannerActive.set(false);
        this.qrCodeScanner = null;
      });
    } else {
      this.scannerActive.set(false);
    }
  }

  protected useScannedUuid() {
    const scanned = this.scannedUuid();
    if (this.isValidUuid(scanned)) {
      this.uuid.set(scanned);
      this.scannedUuid.set(null);
      this.addToHistory(scanned!, 'generated');
      setTimeout(() => this.renderQrCode(), 100);
      alert('UUID escaneado ahora está listo para usar');
    } else {
      alert('El UUID escaneado no es válido. No se puede usar.');
    }
  }

  protected copyScannedUuid() {
    const scanned = this.scannedUuid();
    if (scanned) navigator.clipboard.writeText(scanned);
  }

  protected addToHistory(uuid: string, type: 'generated' | 'scanned') {
    const history = this.uuidHistory();
    const item: UuidHistoryItem = {
      id: history.length + 1,
      uuid,
      type,
      timestamp: new Date().toISOString(),
    };
    const newHistory = [item, ...history].slice(0, 5);
    this.uuidHistory.set(newHistory);
  }

  protected formatDate(dateStr: string | Date): string {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  protected generateUuidV7(): string {
    // Simulación de UUID v7 usando v4 y timestamp
    const uuidV7 = uuidv7();
    const timestamp = Date.now();
    const timestampHex = timestamp.toString(16).padStart(12, '0');
    return `${timestampHex.substring(0, 8)}-${timestampHex.substring(8, 12)}-7${uuidV7.substring(14, 18)}-${uuidV7.substring(19, 23)}-${uuidV7.substring(24)}`;
  }

  protected isValidUuid(uuidStr: string | null): boolean {
    if (!uuidStr) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuidStr);
  }

  protected renderQrCode() {
    if (!this.qrCanvas || !this.uuid()) return;
    const canvas = this.qrCanvas.nativeElement;
    const uuidValue = this.uuid() ?? '';
    QRCode.toCanvas(
      canvas,
      uuidValue,
      {
        width: 150,
        margin: 1,
        color: {
          dark: '#1e3a8a',
          light: '#ffffff',
        },
      },
      (error: any) => {
        if (error) {
          canvas.innerHTML = 'Error generando código QR';
        }
      },
    );
  }

  protected initQRScanner() {
    if (!document.getElementById('qr-reader')) return;
    this.qrCodeScanner = new Html5Qrcode('qr-reader');
    this.qrCodeScanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
        (decodedText: string) => this.onScanSuccess(decodedText),
        (error: string) => this.onScanError(error),
      )
      .catch(() => {
        alert('No se pudo iniciar la cámara.');
        this.stopScanner();
      });
  }

  protected onScanSuccess(decodedText: string) {
    this.stopScanner();
    this.scannedUuid.set(decodedText);
    this.addToHistory(decodedText, 'scanned');
  }

  protected onScanError(error: string) {
    if (!error.includes('NotFoundException')) {
      console.warn(`Error en escáner QR: ${error}`);
    }
  }
}
