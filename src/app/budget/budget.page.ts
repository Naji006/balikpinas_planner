import { Component, OnInit } from '@angular/core';
import { addIcons } from 'ionicons';
import { addOutline, airplaneOutline, homeOutline, receiptOutline, removeOutline, trashOutline, walletOutline } from 'ionicons/icons';
import { PlannerStoreService } from '../planner-store.service';

interface BudgetLine {
  id: number;
  name: string;
  planned: number;
  spent: number;
}

@Component({
  selector: 'app-budget',
  templateUrl: './budget.page.html',
  styleUrls: ['./budget.page.scss'],
  standalone: false,
})
export class BudgetPage implements OnInit {
  showForm = false;
  draft = { name: '', planned: 0 };
  lines: BudgetLine[] = [
    { id: 1, name: 'Flights', planned: 18000, spent: 18000 },
    { id: 2, name: 'Accommodation', planned: 12000, spent: 2000 },
    { id: 3, name: 'Food & dining', planned: 8000, spent: 0 },
    { id: 4, name: 'Local transport', planned: 5000, spent: 0 },
    { id: 5, name: 'Activities', planned: 5000, spent: 0 },
    { id: 6, name: 'Shopping & extras', planned: 2000, spent: 0 }
  ];

  constructor(private readonly store: PlannerStoreService) {
    addIcons({ addOutline, airplaneOutline, homeOutline, receiptOutline, removeOutline, trashOutline, walletOutline });
  }

  async ngOnInit(): Promise<void> {
    this.lines = await this.store.load('budget', this.lines);
  }

  get plannedTotal(): number {
    return this.lines.reduce((total, line) => total + line.planned, 0);
  }

  get spentTotal(): number {
    return this.lines.reduce((total, line) => total + line.spent, 0);
  }

  formatPeso(amount: number): string {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount || 0);
  }

  save(): Promise<void> {
    return this.store.save('budget', this.lines);
  }

  async saveSpent(line: BudgetLine): Promise<void> {
    await this.save();
    await this.store.recordTransaction({
      action: 'expense-updated',
      description: line.name,
      amount: line.spent,
      createdAt: new Date().toISOString()
    });
  }

  async addLine(): Promise<void> {
    if (!this.draft.name.trim() || this.draft.planned <= 0) return;
    this.lines = [...this.lines, { id: Date.now(), name: this.draft.name.trim(), planned: this.draft.planned, spent: 0 }];
    await this.save();
    this.draft = { name: '', planned: 0 };
    this.showForm = false;
  }

  async removeLine(id: number): Promise<void> {
    this.lines = this.lines.filter(line => line.id !== id);
    await this.save();
  }
}
