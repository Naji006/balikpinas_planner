import { Component, inject, OnInit } from '@angular/core';
import { addIcons } from 'ionicons';
import { addOutline, checkmarkCircleOutline, listOutline, trashOutline } from 'ionicons/icons';
import { PlannerStoreService } from '../planner-store.service';

interface ChecklistTask {
  id: number;
  title: string;
  category: string;
  done: boolean;
}

@Component({
  selector: 'app-checklist',
  templateUrl: './checklist.page.html',
  styleUrls: ['./checklist.page.scss'],
  standalone: false,
})
export class ChecklistPage implements OnInit {
  private readonly store = inject(PlannerStoreService);
  draftTitle = '';
  activeFilter: 'all' | 'open' = 'all';
  tasks: ChecklistTask[] = [
    { id: 1, title: 'Check passport validity', category: 'Documents', done: true },
    { id: 2, title: 'Save a copy of flight tickets', category: 'Documents', done: true },
    { id: 3, title: 'Confirm accommodation', category: 'Before you go', done: false },
    { id: 4, title: 'Pack travel adapters', category: 'Packing', done: false },
    { id: 5, title: 'Prepare medications', category: 'Packing', done: false },
    { id: 6, title: 'Share itinerary with family', category: 'Before you go', done: false }
  ];

  constructor() {
    addIcons({ addOutline, checkmarkCircleOutline, listOutline, trashOutline });
  }

  async ngOnInit(): Promise<void> {
    this.tasks = await this.store.load('checklist', this.tasks);
  }

  get visibleTasks(): ChecklistTask[] {
    return this.activeFilter === 'open' ? this.tasks.filter(task => !task.done) : this.tasks;
  }

  get completedCount(): number {
    return this.tasks.filter(task => task.done).length;
  }

  get progress(): number {
    return this.tasks.length ? this.completedCount / this.tasks.length * 100 : 0;
  }

  save(): Promise<void> {
    return this.store.save('checklist', this.tasks);
  }

  async addTask(): Promise<void> {
    const title = this.draftTitle.trim();
    if (!title) return;
    this.tasks = [...this.tasks, { id: Date.now(), title, category: 'Packing', done: false }];
    this.draftTitle = '';
    await this.save();
  }

  async removeTask(id: number): Promise<void> {
    this.tasks = this.tasks.filter(task => task.id !== id);
    await this.save();
  }
}
