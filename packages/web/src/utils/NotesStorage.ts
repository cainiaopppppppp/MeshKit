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

  // 便签操作
  async saveNote(note: StickyNote) {
    await this.init();
    await this.db!.put('notes', note);
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

  async clearAllNotes() {
    await this.init();
    await this.db!.clear('notes');
  }
}

export const notesStorage = new NotesStorage();
