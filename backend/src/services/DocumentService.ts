import { DocumentDataHelper } from '../data/DocumentDataHelper.js';
import { Document } from '../models/types.js';

export class DocumentService {
  private documentDataHelper: DocumentDataHelper;

  constructor() {
    this.documentDataHelper = new DocumentDataHelper();
  }

  async getPublicDocuments(): Promise<Document[]> {
    return this.documentDataHelper.findPublic();
  }

  async getAllDocuments(): Promise<Document[]> {
    return this.documentDataHelper.findAll();
  }

  async getDocumentById(id: string): Promise<Document | null> {
    return this.documentDataHelper.findById(id);
  }

  async getDocumentByAccessCode(code: string): Promise<Document | null> {
    return this.documentDataHelper.findByAccessCode(code);
  }

  async createDocument(data: {
    title: string;
    description?: string;
    fileUrl: string;
    coverImageUrl?: string;
    isPublic: boolean;
    specialAccessCode?: string;
    publishDate: string;
    createdBy: string;
  }): Promise<Document> {
    return this.documentDataHelper.create(data);
  }

  async updateDocument(id: string, updates: Partial<Omit<Document, 'id' | 'createdAt' | 'createdBy'>>): Promise<Document | null> {
    return this.documentDataHelper.update(id, updates);
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documentDataHelper.delete(id);
  }
}

