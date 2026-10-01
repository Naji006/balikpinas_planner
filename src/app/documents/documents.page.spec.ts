import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlannerStoreService } from '../planner-store.service';
import { DocumentsPage } from './documents.page';

const store = {
  load: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback))
};

describe('DocumentsPage', () => {
  let component: DocumentsPage;
  let fixture: ComponentFixture<DocumentsPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PlannerStoreService, useValue: store }]
    });
    fixture = TestBed.createComponent(DocumentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
