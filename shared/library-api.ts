// Read models for the gateway's JSON API. Protobuf omits empty and zero values.
export interface Author {
  id: string;
  name: string;
  birth_date?: string;
  biography?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  book_count?: number;
}

export interface Publisher {
  id: string;
  name: string;
  description?: string;
}

export interface CoverFile {
  id: string;
  url: string;
  mime_type?: string;
  size?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Book {
  id: string;
  title: string;
  isbn?: string;
  cover_image_id?: CoverFile;
  location?: string;
  is_reference_only?: boolean;
  description?: string;
  published_date?: string;
  publication_year?: number;
  category_ids?: Category[];
  author_ids?: Author[];
  publisher_id?: Publisher;
  language?: string;
  page_count?: number;
  total_copies?: number;
  available_copies?: number;
}

export interface User {
  id: string;
  full_name: string;
  group_name?: string;
  email?: string;
  phone?: string;
  role: 'student' | 'teacher';
  created_at?: string;
  updated_at?: string;
}

export interface Recommended {
  id: string;
  book_id: Book;
  created_at: string;
}

export interface BookCopy {
  id: string;
  barcode: string;
  status?: 'available' | 'borrowed' | 'lost' | 'retired';
}

export interface CopyLookup {
  book: Book;
  copy: BookCopy;
}

export interface Borrowing {
  id: string;
  book: Book;
  copy?: BookCopy;
  user: User;
  from_date: string;
  due_date: string;
  extension_date?: string;
  status: 'borrowed' | 'returned' | 'lost';
  returned_at?: string;
  notes?: string;
}
