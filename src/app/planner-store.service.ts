import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

export interface PlannerTransaction {
  id?: number;
  action: 'registration' | 'login' | 'trip-created' | 'expense-updated' | 'file-uploaded';
  description: string;
  email?: string;
  amount?: number;
  createdAt: string;
}

export interface AccountProfile {
  email: string;
  fullName: string;
  phone: string;
}

@Injectable({ providedIn: 'root' })
export class PlannerStoreService {
  private readonly apiUrl = environment.apiUrl;
  private currentUser: AccountProfile | null = null;
  private readonly loadedCollections = new Set<string>();
  private readonly http = inject(HttpClient);

  async load<T>(key: string, fallback: T): Promise<T> {
    const result = await firstValueFrom(this.http.get<{ value: T | null }>(
      `${this.apiUrl}/collections/${encodeURIComponent(key)}`,
      { withCredentials: true }
    ));
    this.loadedCollections.add(key);
    return result.value ?? fallback;
  }

  async save<T>(key: string, value: T): Promise<void> {
    if (!this.loadedCollections.has(key)) {
      throw new Error(`Cannot save ${key} before it has loaded successfully`);
    }
    await firstValueFrom(this.http.put(
      `${this.apiUrl}/collections/${encodeURIComponent(key)}`,
      { value },
      { withCredentials: true }
    ));
  }

  async registerAccount(details: AccountProfile, password: string): Promise<boolean> {
    try {
      this.currentUser = await firstValueFrom(this.http.post<AccountProfile>(
        `${this.apiUrl}/auth/register`, { ...details, password }, { withCredentials: true }
      ));
      this.loadedCollections.clear();
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) return false;
      throw error;
    }
  }

  async authenticateUser(email: string, password: string): Promise<AccountProfile | null> {
    try {
      this.currentUser = await firstValueFrom(this.http.post<AccountProfile>(
        `${this.apiUrl}/auth/login`, { email, password }, { withCredentials: true }
      ));
      this.loadedCollections.clear();
      return this.currentUser;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) return null;
      throw error;
    }
  }

  setSession(user: AccountProfile): void {
    this.currentUser = user;
  }

  async getSession(): Promise<AccountProfile | null> {
    try {
      this.currentUser = await firstValueFrom(this.http.get<AccountProfile>(
        `${this.apiUrl}/auth/me`, { withCredentials: true }
      ));
      return this.currentUser;
    } catch {
      this.currentUser = null;
      return null;
    }
  }

  async clearSession(): Promise<void> {
    this.currentUser = null;
    this.loadedCollections.clear();
    await firstValueFrom(this.http.post(
      `${this.apiUrl}/auth/logout`, {}, { withCredentials: true }
    ));
  }

  async saveAttachment(id: number, file: File): Promise<void> {
    const form = new FormData();
    form.append('file', file, file.name);
    await firstValueFrom(this.http.post(
      `${this.apiUrl}/attachments/${id}`, form, { withCredentials: true }
    ));
  }

  getAttachment(id: number): Promise<Blob> {
    return firstValueFrom(this.http.get(
      `${this.apiUrl}/attachments/${id}`,
      { responseType: 'blob', withCredentials: true }
    ));
  }

  async removeAttachment(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(
      `${this.apiUrl}/attachments/${id}`, { withCredentials: true }
    ));
  }

  async recordTransaction(transaction: Omit<PlannerTransaction, 'id'>): Promise<void> {
    await firstValueFrom(this.http.post(
      `${this.apiUrl}/activity`, transaction, { withCredentials: true }
    ));
  }

  getTransactions(): Promise<PlannerTransaction[]> {
    return firstValueFrom(this.http.get<PlannerTransaction[]>(
      `${this.apiUrl}/activity`, { withCredentials: true }
    ));
  }
}