// API Base URL - Use environment variable or fallback to localhost
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';


// Types
interface User {
  id: string;
  full_name: string;
  group_name?: string;
  email?: string;
  phone?: string;
  role: 'student' | 'teacher';
  created_at: string;
  updated_at: string;
}

interface UserFormData {
  full_name: string;
  group_name: string;
  email: string;
  phone: string;
  role: 'student' | 'teacher';
}


// Types
interface Author {
  id: string;
  name: string;
  birth_date?: string;
  biography: string;
}

interface Publisher {
  id: string;
  name: string;
  description: string;
}

interface PublisherFormData {
  name: string;
  description: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
}

interface FileData {
  id: string;
  url: string;
  mime_type: string;
  size: number;
}

interface Book {
  id: string;
  title: string;
  cover_image_id?: FileData;
  location: string;
  is_reference_only: boolean;
  description: string;
  isbn: string;
  published_date: string;
  category_ids: Category[];
  author_ids: Author[];
  publisher_id: Publisher;
  language: string;
  page_count: number;
  total_copies: number;
  available_copies: number;
}

interface BookFormData {
  title: string;
  isbn: string;
  location: string;
  is_reference_only: boolean;
  description: string;
  published_date: string;
  publisher_id: string;
  language: string;
  page_count: number;
  total_copies: number;
  available_copies: number;
  category_ids: string[];
  author_ids: string[];
  cover_image_file: File | null;
  cover_image_id: string;
}

interface Borrowing {
  id: string;
  book: Book;
  user: User;
  from_date: string;
  due_date: string;
  extension_date?: string;
  status: 'borrowed' | 'returned' | 'lost';
  returned_at?: string;
  notes: string;
}

interface Recommended {
  id: string;
  book_id: Book;
  created_at: string;
}



export type {
  Author,
  Book,
  BookFormData, Borrowing,
  Category, FileData, Publisher,
  PublisherFormData,
  Recommended, User,
  UserFormData
};


