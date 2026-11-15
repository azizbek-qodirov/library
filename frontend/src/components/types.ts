
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
}

export interface File {
  id: string;
  url: string;
  mime_type: string;
  size: number;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  title: string;
  cover_image_id?: File | null;
  location?: string;
  is_reference_only: boolean;
  description?: string;
  isbn?: string;
  published_date?: string;
  category_ids?: Category[];
  author_ids?: Author[];
  publisher_id?: Publisher | null;
  language?: string;
  page_count?: number;
  total_copies?: number;
  available_copies?: number;
}

export interface Publisher {
  id: string;
  name: string;
  description?: string;
}

export interface User {
  id: string;
  full_name: string;
  group_name?: string;
  email?: string
  phone?: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Recommended {
  id: string;
  book_id: Book;
  created_at: string;
}

export interface Borrowing {
  id: string;
  book: Book;
  user: User;
  from_date: string;
  due_date: string;
  extension_date?: string;
  status: string;
  returned_at?: string;
  notes?: string;
}