import { httpDocumentRepository } from './repositories/httpDocumentRepository';

export const dataMode = 'api' as const;
export const documentRepository = httpDocumentRepository;
