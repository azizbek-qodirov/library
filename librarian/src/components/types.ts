export type { Author, Book, Borrowing, Category, CoverFile as FileData, Publisher, Recommended, User } from '../../../shared/library-api';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8088').replace(/\/+$/, '');

export interface UserFormData {
  full_name: string;
  group_name: string;
  email: string;
  phone: string;
  role: 'student' | 'teacher';
}

export interface PublisherFormData {
  name: string;
  description: string;
}

export interface BookFormData {
  title: string;
  isbn: string;
  location: string;
  is_reference_only: boolean;
  description: string;
  published_date: string;
  publication_year: string;
  publisher_id: string;
  language: string;
  page_count: number;
  total_copies: number;
  category_ids: string[];
  author_ids: string[];
  cover_image_file: File | null;
  cover_image_id: string;
}
