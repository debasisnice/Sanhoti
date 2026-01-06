import { DatabaseHelper } from './DatabaseHelper.js';
import { Document } from '../models/types.js';

export class DocumentDataHelper extends DatabaseHelper {
  private readonly filename = 'documents.json';

  async findAll(): Promise<Document[]> {
    return this.readFile<Document>(this.filename);
  }

  async findById(id: string): Promise<Document | null> {
    const documents = await this.findAll();
    return documents.find(d => d.id === id) || null;
  }

  async findPublic(): Promise<Document[]> {
    const documents = await this.findAll();
    return documents
      .filter(d => d.isPublic)
      .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
  }

  async findByAccessCode(code: string): Promise<Document | null> {
    const documents = await this.findAll();
    return documents.find(d => d.specialAccessCode === code) || null;
  }

  async create(document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    const documents = await this.findAll();
    const newDocument: Document = {
      ...document,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    documents.push(newDocument);
    this.writeFile(this.filename, documents);
    return newDocument;
  }

  async update(id: string, updates: Partial<Document>): Promise<Document | null> {
    const documents = await this.findAll();
    const index = documents.findIndex(d => d.id === id);
    if (index === -1) return null;
    
    documents[index] = {
      ...documents[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.writeFile(this.filename, documents);
    return documents[index];
  }

  async delete(id: string): Promise<boolean> {
    const documents = await this.findAll();
    const filtered = documents.filter(d => d.id !== id);
    if (filtered.length === documents.length) return false;
    this.writeFile(this.filename, filtered);
    return true;
  }
}

