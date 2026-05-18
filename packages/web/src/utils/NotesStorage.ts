/**
 * 便签墙 - IndexedDB 存储层
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { StickyNote, Room } from '../types/stickyNote';

interface NotesDB extends DBSchema {
  notes: {
    key: string;
    value: StickyNote;
    indexes: { 'by-room': string };
  };
  rooms: {
    key: string;
    value: Room;
  };
}

class NotesStorage {
  private db: IDBPDatabase<NotesDB> | null = null;
  private readonly DESTROYED_ROOM_PREFIX = 'sticky_notes_destroyed_room_';
  private readonly DESTROYED_ROOM_TTL = 24 * 60 * 60 * 1000;

  async init() {
    if (this.db) return;

    this.db = await openDB<NotesDB>('StickyNotesDB', 1, {
      upgrade(db) {
        // 创建便签表
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('by-room', 'roomId');
        }

        // 创建房间表
        if (!db.objectStoreNames.contains('rooms')) {
          db.createObjectStore('rooms', { keyPath: 'id' });
        }
      },
    });
  }

  // 房间操作
  async saveRoom(room: Room) {
    await this.init();
    await this.db!.put('rooms', room);
  }

  async getRoom(roomId: string): Promise<Room | undefined> {
    await this.init();
    return await this.db!.get('rooms', roomId);
  }

  async getAllRooms(): Promise<Room[]> {
    await this.init();
    return await this.db!.getAll('rooms');
  }

  async deleteRoom(roomId: string) {
    await this.init();
    await this.db!.delete('rooms', roomId);
  }

  private getDestroyedRoomKey(roomId: string) {
    return `${this.DESTROYED_ROOM_PREFIX}${roomId}`;
  }

  markRoomDestroyed(roomId: string, destroyedAt = Date.now()) {
    try {
      localStorage.setItem(this.getDestroyedRoomKey(roomId), String(destroyedAt));
    } catch (error) {
      console.warn('[NotesStorage] Failed to persist destroyed room marker:', error);
    }
  }

  getDestroyedRoomAt(roomId: string): number | null {
    try {
      const raw = localStorage.getItem(this.getDestroyedRoomKey(roomId));
      if (!raw) {
        return null;
      }

      const destroyedAt = Number.parseInt(raw, 10);
      if (!Number.isFinite(destroyedAt)) {
        localStorage.removeItem(this.getDestroyedRoomKey(roomId));
        return null;
      }

      if (Date.now() - destroyedAt > this.DESTROYED_ROOM_TTL) {
        localStorage.removeItem(this.getDestroyedRoomKey(roomId));
        return null;
      }

      return destroyedAt;
    } catch (error) {
      console.warn('[NotesStorage] Failed to read destroyed room marker:', error);
      return null;
    }
  }

  isRoomDestroyed(roomId: string) {
    return this.getDestroyedRoomAt(roomId) !== null;
  }

  clearDestroyedRoomMarker(roomId: string) {
    try {
      localStorage.removeItem(this.getDestroyedRoomKey(roomId));
    } catch (error) {
      console.warn('[NotesStorage] Failed to clear destroyed room marker:', error);
    }
  }

  // 便签操作
  async saveNote(note: StickyNote) {
    await this.init();
    await this.db!.put('notes', note);
  }

  async getNotesByRoom(roomId: string): Promise<StickyNote[]> {
    await this.init();
    return await this.db!.getAllFromIndex('notes', 'by-room', roomId);
  }

  async getNote(noteId: string): Promise<StickyNote | undefined> {
    await this.init();
    return await this.db!.get('notes', noteId);
  }

  async getAllNotes(): Promise<StickyNote[]> {
    await this.init();
    return await this.db!.getAll('notes');
  }

  async deleteNote(noteId: string) {
    await this.init();
    await this.db!.delete('notes', noteId);
  }

  async clearRoomNotes(roomId: string) {
    await this.init();
    const tx = this.db!.transaction('notes', 'readwrite');
    const index = tx.store.index('by-room');
    let cursor = await index.openCursor(roomId);

    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }

    await tx.done;
  }

  async clearAllNotes() {
    await this.init();
    await this.db!.clear('notes');
  }
}

export const notesStorage = new NotesStorage();
