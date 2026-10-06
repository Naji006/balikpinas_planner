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

export interface SelectedTrip {
  id: number;
  destination: string;
  originAirport?: string;
  destinationAirport?: string;
  airline?: string;
  terminal?: string;
  bookingReference?: string;
  hotel?: string;
  travelers?: number;
  startDate: string;
  endDate: string;
  flight: string;
}

@Injectable({ providedIn: 'root' })
export class PlannerStoreService {
  private readonly apiUrl = environment.apiUrl;
  private currentUser: AccountProfile | null = null;
  private readonly loadedCollections = new Set<string>();
  private readonly collectionWrites = new Map<string, Promise<void>>();
  private readonly http = inject(HttpClient);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.flushPendingWrites());
    }
  }

  async load<T>(key: string, fallback: T): Promise<T> {
    const pending = this.readPendingWrites();
    if (Object.hasOwn(pending, key)) {
      try {
        await this.writeCollection(key, pending[key]);
        this.clearPendingWrite(key, pending[key]);
        this.cacheCollection(key, pending[key]);
      } catch (error) {
        if (!this.isNetworkError(error)) throw error;
      }
      this.loadedCollections.add(key);
      return pending[key] as T;
    }

    try {
      const result = await firstValueFrom(this.http.get<{ value: T | null }>(
        `${this.apiUrl}/collections/${encodeURIComponent(key)}`,
        { withCredentials: true }
      ));
      const value = result.value ?? fallback;
      this.cacheCollection(key, value);
      this.loadedCollections.add(key);
      return value;
    } catch (error) {
      if (!this.isNetworkError(error)) throw error;
      this.loadedCollections.add(key);
      const cached = this.readCachedCollection<T>(key);
      return cached.found ? cached.value : fallback;
    }
  }

  async save<T>(key: string, value: T): Promise<void> {
    if (!this.loadedCollections.has(key)) {
      throw new Error(`Cannot save ${key} before it has loaded successfully`);
    }
    this.cacheCollection(key, value);
    this.queueWrite(key, value);
    try {
      await this.writeCollection(key, value);
      this.clearPendingWrite(key, value);
    } catch (error) {
      if (!this.isNetworkError(error)) throw error;
    }
  }

  async registerAccount(details: AccountProfile, password: string): Promise<boolean> {
    try {
      this.setSession(await firstValueFrom(this.http.post<AccountProfile>(
        `${this.apiUrl}/auth/register`, { ...details, password }, { withCredentials: true }
      )));
      this.loadedCollections.clear();
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) return false;
      throw error;
    }
  }

  async authenticateUser(email: string, password: string): Promise<AccountProfile | null> {
    try {
      this.setSession(await firstValueFrom(this.http.post<AccountProfile>(
        `${this.apiUrl}/auth/login`, { email, password }, { withCredentials: true }
      )));
      this.loadedCollections.clear();
      return this.currentUser;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) return null;
      throw error;
    }
  }

  setSession(user: AccountProfile): void {
    this.currentUser = user;
    this.writeStorage(this.userStorageKey(), user);
  }

  async getSession(): Promise<AccountProfile | null> {
    try {
      this.setSession(await firstValueFrom(this.http.get<AccountProfile>(
        `${this.apiUrl}/auth/me`, { withCredentials: true }
      )));
      await this.flushPendingWrites();
      return this.currentUser;
    } catch (error) {
      if (this.isNetworkError(error)) {
        this.currentUser = this.readStorage<AccountProfile>(this.userStorageKey());
        return this.currentUser;
      }
      this.currentUser = null;
      this.removeStorage(this.userStorageKey());
      return null;
    }
  }

  async clearSession(): Promise<void> {
    const userStorageKey = this.userStorageKey();
    this.currentUser = null;
    this.loadedCollections.clear();
    this.removeStorage(userStorageKey);
    try {
      await firstValueFrom(this.http.post(
        `${this.apiUrl}/auth/logout`, {}, { withCredentials: true }
      ));
    } catch (error) {
      if (!this.isNetworkError(error)) throw error;
    }
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

  setSelectedTrip(trip: SelectedTrip | null): void {
    if (!trip) {
      this.removeStorage(this.selectedTripStorageKey());
      return;
    }
    this.writeStorage(this.selectedTripStorageKey(), trip);
  }

  getSelectedTrip(): SelectedTrip | null {
    return this.readStorage<SelectedTrip>(this.selectedTripStorageKey());
  }

  private async flushPendingWrites(): Promise<void> {
    if (!this.currentUser) return;
    const pending = this.readPendingWrites();
    for (const [key, value] of Object.entries(pending)) {
      try {
        await this.writeCollection(key, value);
        this.clearPendingWrite(key, value);
      } catch {
        return;
      }
    }
  }

  private writeCollection(key: string, value: unknown): Promise<void> {
    const send = () => firstValueFrom(this.http.put(
        `${this.apiUrl}/collections/${encodeURIComponent(key)}`,
        { value },
        { withCredentials: true }
      )).then(() => undefined);
    const previous = this.collectionWrites.get(key);
    const write = previous ? previous.catch(() => undefined).then(send) : send();
    this.collectionWrites.set(key, write);
    return write.finally(() => {
      if (this.collectionWrites.get(key) === write) this.collectionWrites.delete(key);
    });
  }

  private isNetworkError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
  }

  private userStorageKey(): string {
    return 'balikpinas:last-session';
  }

  private collectionStorageKey(key: string): string {
    const email = encodeURIComponent(this.currentUser?.email.toLowerCase() ?? 'anonymous');
    return `balikpinas:${email}:collection:${key}`;
  }

  private pendingStorageKey(): string {
    const email = encodeURIComponent(this.currentUser?.email.toLowerCase() ?? 'anonymous');
    return `balikpinas:${email}:pending`;
  }

  private selectedTripStorageKey(): string {
    return 'balikpinas:selected-trip';
  }

  private cacheCollection(key: string, value: unknown): void {
    this.writeStorage(this.collectionStorageKey(key), { value });
  }

  private readCachedCollection<T>(key: string): { found: boolean; value: T } {
    const cached = this.readStorage<{ value: T }>(this.collectionStorageKey(key));
    return cached ? { found: true, value: cached.value } : { found: false, value: undefined as T };
  }

  private readPendingWrites(): Record<string, unknown> {
    return this.readStorage<Record<string, unknown>>(this.pendingStorageKey()) ?? {};
  }

  private queueWrite(key: string, value: unknown): void {
    const pending = this.readPendingWrites();
    pending[key] = value;
    this.writeStorage(this.pendingStorageKey(), pending);
  }

  private clearPendingWrite(key: string, syncedValue: unknown): void {
    const pending = this.readPendingWrites();
    if (!Object.hasOwn(pending, key) || JSON.stringify(pending[key]) !== JSON.stringify(syncedValue)) return;
    delete pending[key];
    this.writeStorage(this.pendingStorageKey(), pending);
  }

  private readStorage<T>(key: string): T | null {
    try {
      const value = localStorage.getItem(key);
      return value === null ? null : JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
    }
  }

  private removeStorage(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
    }
  }
}