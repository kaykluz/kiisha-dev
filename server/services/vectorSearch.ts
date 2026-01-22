/**
 * Vector Embeddings and Semantic Search Service
 */

export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, any>;
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
  highlights?: string[];
}

export class VectorStore {
  private documents: Map<string, VectorDocument> = new Map();
  private dimensions: number;

  constructor(dimensions = 1536) {
    this.dimensions = dimensions;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/v1/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}` },
        body: JSON.stringify({ input: text, model: 'text-embedding-3-small' })
      });
      const data = await response.json();
      return data.data?.[0]?.embedding || this.fallbackEmbedding(text);
    } catch { return this.fallbackEmbedding(text); }
  }

  private fallbackEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const emb = new Array(this.dimensions).fill(0);
    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) hash = ((hash << 5) - hash) + word.charCodeAt(i);
      emb[Math.abs(hash) % this.dimensions] += 1 / words.length;
    }
    const mag = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
    return mag > 0 ? emb.map(v => v / mag) : emb;
  }

  async addDocument(doc: VectorDocument): Promise<void> {
    if (!doc.embedding) doc.embedding = await this.generateEmbedding(doc.content);
    this.documents.set(doc.id, doc);
  }

  async search(query: string, topK = 10): Promise<SearchResult[]> {
    const qEmb = await this.generateEmbedding(query);
    const results: SearchResult[] = [];
    for (const doc of Array.from(this.documents.values())) {
      if (!doc.embedding) continue;
      let dot = 0, nA = 0, nB = 0;
      for (let i = 0; i < qEmb.length; i++) { dot += qEmb[i] * doc.embedding[i]; nA += qEmb[i] ** 2; nB += doc.embedding[i] ** 2; }
      const score = dot / (Math.sqrt(nA) * Math.sqrt(nB) || 1);
      results.push({ document: doc, score });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  getDocumentCount(): number { return this.documents.size; }
}

export class SemanticSearchService {
  private stores: Map<string, VectorStore> = new Map();

  createStore(name: string): VectorStore {
    const store = new VectorStore();
    this.stores.set(name, store);
    return store;
  }

  getStore(name: string): VectorStore | undefined { return this.stores.get(name); }

  async index(storeName: string, doc: VectorDocument): Promise<void> {
    let store = this.stores.get(storeName);
    if (!store) store = this.createStore(storeName);
    await store.addDocument(doc);
  }

  async search(storeName: string, query: string, topK = 10): Promise<SearchResult[]> {
    const store = this.stores.get(storeName);
    return store ? store.search(query, topK) : [];
  }
}

export const semanticSearchService = new SemanticSearchService();
export default semanticSearchService;
