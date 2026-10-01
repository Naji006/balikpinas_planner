import { Component, OnInit } from '@angular/core';
import { addIcons } from 'ionicons';
import { cloudUploadOutline, documentTextOutline, downloadOutline, receiptOutline, trashOutline } from 'ionicons/icons';
import { PlannerStoreService } from '../planner-store.service';

interface StoredFile {
  id: number;
  name: string;
  fileName: string;
  category: 'document' | 'receipt';
  updated: string;
  amount: number;
}

@Component({
  selector: 'app-documents',
  templateUrl: './documents.page.html',
  styleUrls: ['./documents.page.scss'],
  standalone: false,
})
export class DocumentsPage implements OnInit {
  selectedCategory: 'document' | 'receipt' = 'document';
  files: StoredFile[] = [
    { id: 1, name: 'Passport', fileName: 'passport.jpg', category: 'document', updated: 'Aug 12, 2026', amount: 0 },
    { id: 2, name: 'Visa', fileName: 'visa.pdf', category: 'document', updated: 'Aug 15, 2026', amount: 0 },
    { id: 3, name: 'Flight Ticket', fileName: 'ticket.pdf', category: 'document', updated: 'Sep 02, 2026', amount: 0 },
    { id: 4, name: 'Hotel deposit', fileName: 'hotel-receipt.jpg', category: 'receipt', updated: 'Sep 12, 2026', amount: 12000 }
  ];
  statusMessage = '';

  constructor(private readonly store: PlannerStoreService) {
    addIcons({ cloudUploadOutline, documentTextOutline, downloadOutline, receiptOutline, trashOutline });
  }

  async ngOnInit(): Promise<void> {
    this.files = await this.store.load('files', this.files);
  }

  get visibleFiles(): StoredFile[] {
    return this.files.filter(file => file.category === this.selectedCategory);
  }

  get receiptTotal(): number {
    return this.files.filter(file => file.category === 'receipt').reduce((sum, file) => sum + (file.amount || 0), 0);
  }

  async filesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    const added = selected.map((file, index) => ({
      id: Date.now() + index,
      name: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      category: this.selectedCategory,
      updated: new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date()),
      amount: 0
    }));
    this.files = [...added, ...this.files];
    await this.store.save('files', this.files);
    input.value = '';
    try {
      await Promise.all(added.map((file, index) => this.store.saveAttachment(file.id, selected[index])));
      this.statusMessage = `${added.length} file${added.length === 1 ? '' : 's'} added.`;
      for (const file of added) {
        await this.store.recordTransaction({
          action: 'file-uploaded',
          description: file.fileName,
          createdAt: new Date().toISOString()
        });
      }
    } catch {
      this.statusMessage = 'File details were saved, but browser file storage is unavailable.';
    }
  }

  saveFiles(): Promise<void> {
    return this.store.save('files', this.files);
  }

  async downloadFile(file: StoredFile): Promise<void> {
    try {
      const blob = await this.store.getAttachment(file.id);
      if (!blob) {
        this.statusMessage = 'This sample file has no uploaded attachment.';
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.statusMessage = 'This file could not be downloaded from the server.';
    }
  }

  async removeFile(id: number): Promise<void> {
    this.files = this.files.filter(file => file.id !== id);
    await this.saveFiles();
    await this.store.removeAttachment(id).catch(() => undefined);
  }
}
