import { Component, OnInit } from '@angular/core';
import { addIcons } from 'ionicons';
import { addOutline, callOutline, mailOutline, peopleOutline, trashOutline } from 'ionicons/icons';
import { PlannerStoreService } from '../planner-store.service';

interface FamilyContact {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.page.html',
  styleUrls: ['./contacts.page.scss'],
  standalone: false,
})
export class ContactsPage implements OnInit {
  showForm = false;
  draft = { name: '', relationship: '', phone: '', email: '' };
  contacts: FamilyContact[] = [
    { id: 1, name: 'Christian Pildo Ligralde', relationship: 'Family', phone: '', email: '' },
    { id: 2, name: 'Jean Pangilinan', relationship: 'Family', phone: '', email: '' },
    { id: 3, name: 'Kendrix Flores', relationship: 'Family', phone: '', email: '' },
    { id: 4, name: 'Celine Leano', relationship: 'Family', phone: '', email: '' },
    { id: 5, name: 'Ruth Paulino', relationship: 'Family', phone: '', email: '' },
    { id: 6, name: 'Clarissa Joyce Maccalanga', relationship: 'Family', phone: '', email: '' }
  ];

  constructor(private readonly store: PlannerStoreService) {
    addIcons({ addOutline, callOutline, mailOutline, peopleOutline, trashOutline });
  }

  async ngOnInit(): Promise<void> {
    this.contacts = await this.store.load('contacts', this.contacts);
  }

  save(): Promise<void> {
    return this.store.save('contacts', this.contacts);
  }

  async addContact(): Promise<void> {
    if (!this.draft.name.trim()) return;
    this.contacts = [...this.contacts, { id: Date.now(), ...this.draft, name: this.draft.name.trim() }];
    await this.save();
    this.draft = { name: '', relationship: '', phone: '', email: '' };
    this.showForm = false;
  }

  async removeContact(id: number): Promise<void> {
    this.contacts = this.contacts.filter(contact => contact.id !== id);
    await this.save();
  }
}
