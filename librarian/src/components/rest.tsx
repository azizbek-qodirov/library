// import React, { useState, useEffect } from 'react';

// // Types
// interface Author {
//   id: string;
//   name: string;
//   birth_date?: string;
//   biography: string;
// }

// interface Publisher {
//   id: string;
//   name: string;
//   description: string;
// }

// interface Category {
//   id: string;
//   name: string;
//   description: string;
// }

// interface FileData {
//   id: string;
//   url: string;
//   mime_type: string;
//   size: number;
// }

// interface Book {
//   id: string;
//   title: string;
//   cover_image_id?: FileData;
//   location: string;
//   is_reference_only: boolean;
//   description: string;
//   isbn: string;
//   published_date: string;
//   category_ids: Category[];
//   author_ids: Author[];
//   publisher_id: Publisher;
//   language: string;
//   page_count: number;
//   total_copies: number;
//   available_copies: number;
// }



// const API_BASE_URL = 'http://localhost:8080';




// export { PublishersSection, BooksSection, BorrowingsSection, RecommendedSection };">
//           <input
//             type="text"
//             className="form-control"
//             placeholder="Search publishers..."
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//           />
//         </div>
//       </div>

//       <div className="card shadow-sm">
//         <div className="card-header bg-white">
//           <span className="small text-muted">Total: <strong>{totalPublishers}</strong></span>
//         </div>
//         <div className="card-body p-0">
//           {loading ? (
//             <div className="text-center p-5">
//               <div className="spinner-border text-primary"></div>
//             </div>
//           ) : publishers.length === 0 ? (
//             <div className="text-center p-5">
//               <p className="mb-0">No publishers found</p>
//             </div>
//           ) : (
//             <div className="table-responsive">
//               <table className="table table-hover mb-0">
//                 <thead className="table-light">
//                   <tr>
//                     <th>Name</th>
//                     <th>Description</th>
//                     <th className="text-end">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {publishers.map((pub) => (
//                     <tr key={pub.id}>
//                       <td className="fw-medium">{pub.name}</td>
//                       <td className="text-muted">{pub.description || '-'}</td>
//                       <td className="text-end">
//                         <div className="btn-group btn-group-sm">
//                           <button
//                             className="btn btn-outline-primary"
//                             onClick={() => {
//                               setEditingPublisher(pub);
//                               setFormData({ name: pub.name, description: pub.description });
//                               setShowForm(true);
//                             }}
//                           >
//                             Edit
//                           </button>
//                           <button
//                             className="btn btn-outline-danger"
//                             onClick={() => setDeleteModal({ isOpen: true, publisher: pub })}
//                           >
//                             Delete
//                           </button>
//                         </div>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
//       </div>

//       {deleteModal.isOpen && (
//         <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
//           <div className="modal-dialog modal-dialog-centered">
//             <div className="modal-content">
//               <div className="modal-header">
//                 <h5 className="modal-title">Confirm Delete</h5>
//               </div>
//               <div className="modal-body">
//                 <p>Are you sure you want to delete <strong>{deleteModal.publisher?.name}</strong>?</p>
//               </div>
//               <div className="modal-footer">
//                 <button className="btn btn-secondary" onClick={() => setDeleteModal({ isOpen: false, publisher: null })}>
//                   Cancel
//                 </button>
//                 <button className="btn btn-danger" onClick={handleDelete} disabled={actionLoading}>
//                   {actionLoading ? 'Deleting...' : 'Delete'}
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// // Books Section with File Upload
// const BooksSection = ({ savedData, onDataChange }: any) => {
//   const [books, setBooks] = useState<Book[]>([]);
//   const [authors, setAuthors] = useState<Author[]>([]);
//   const [publishers, setPublishers] = useState<Publisher[]>([]);
//   const [categories, setCategories] = useState<Category[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [currentPage, setCurrentPage] = useState(1);
//   const [totalBooks, setTotalBooks] = useState(0);
//   const [searchQuery, setSearchQuery] = useState('');
//   const [showForm, setShowForm] = useState(false);
//   const [formData, setFormData] = useState({
//     title: '',
//     isbn: '',
//     location: '',
//     is_reference_only: false,
//     description: '',
//     published_date: '',
//     publisher_id: '',
//     language: '',
//     page_count: 0,
//     total_copies: 0,
//     available_copies: 0,
//     category_ids: [] as string[],
//     author_ids: [] as string[],
//     cover_image_file: null as File | null,
//     cover_image_id: ''
//   });
//   const [editingBook, setEditingBook] = useState<Book | null>(null);
//   const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; book: Book | null }>({ isOpen: false, book: null });
//   const [actionLoading, setActionLoading] = useState(false);
//   const [imagePreview, setImagePreview] = useState<string | null>(null);

//   const itemsPerPage = 20;

//   useEffect(() => {
//     if (savedData) {
//       if (savedData.showForm) setShowForm(true);
//       if (savedData.formData) setFormData(savedData.formData);
//       if (savedData.editingBook) setEditingBook(savedData.editingBook);
//       if (savedData.searchQuery) setSearchQuery(savedData.searchQuery);
//       if (savedData.imagePreview) setImagePreview(savedData.imagePreview);
//     }
//   }, [savedData]);

//   useEffect(() => {
//     fetchAuthors();
//     fetchPublishers();
//     fetchCategories();
//   }, []);

//   useEffect(() => {
//     const timer = setTimeout(() => {
//       setCurrentPage(1);
//       fetchBooks();
//     }, 1000);
//     return () => clearTimeout(timer);
//   }, [searchQuery]);

//   useEffect(() => {
//     fetchBooks();
//   }, [currentPage]);

//   const fetchAuthors = async () => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/authors?limit=1000&offset=0`);
//       const data = await response.json();
//       setAuthors(data.authors || []);
//     } catch (error) {
//       console.error('Error fetching authors:', error);
//     }
//   };

//   const fetchPublishers = async () => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/publishers?limit=1000&offset=0`);
//       const data = await response.json();
//       setPublishers(data.publishers || []);
//     } catch (error) {
//       console.error('Error fetching publishers:', error);
//     }
//   };

//   const fetchCategories = async () => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/categories?limit=1000&offset=0`);
//       const data = await response.json();
//       setCategories(data.categories || []);
//     } catch (error) {
//       console.error('Error fetching categories:', error);
//     }
//   };

//   const fetchBooks = async () => {
//     setLoading(true);
//     try {
//       const params = new URLSearchParams();
//       params.append('limit', itemsPerPage.toString());
//       params.append('offset', ((currentPage - 1) * itemsPerPage).toString());
//       if (searchQuery.trim()) params.append('search', searchQuery.trim());

//       const response = await fetch(`${API_BASE_URL}/books?${params.toString()}`);
//       const data = await response.json();
//       setBooks(data.books || []);
//       setTotalBooks(data.total_count || 0);
//     } catch (error) {
//       console.error('Error fetching books:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (file) {
//       setFormData(prev => ({ ...prev, cover_image_file: file }));
      
//       const reader = new FileReader();
//       reader.onloadend = () => {
//         setImagePreview(reader.result as string);
//       };
//       reader.readAsDataURL(file);
//     }
//   };

//   const uploadFile = async (file: File): Promise<string> => {
//     const formDataFile = new FormData();
//     formDataFile.append('file', file);

//     const response = await fetch(`${API_BASE_URL}/file`, {
//       method: 'POST',
//       body: formDataFile
//     });

//     if (!response.ok) throw new Error('Failed to upload file');

//     const data = await response.json();
//     return data.id;
//   };

//   const handleSave = async () => {
//     if (!formData.title.trim() || !formData.isbn.trim()) {
//       alert('Title and ISBN are required');
//       return;
//     }

//     setActionLoading(true);
//     try {
//       let coverImageId = formData.cover_image_id;

//       // Upload file first if new file is selected
//       if (formData.cover_image_file) {
//         coverImageId = await uploadFile(formData.cover_image_file);
//       }

//       const bookData = {
//         title: formData.title,
//         isbn: formData.isbn,
//         location: formData.location,
//         is_reference_only: formData.is_reference_only,
//         description: formData.description,
//         published_date: formData.published_date || undefined,
//         publisher_id: formData.publisher_id,
//         language: formData.language,
//         page_count: parseInt(formData.page_count.toString()) || 0,
//         total_copies: parseInt(formData.total_copies.toString()) || 0,
//         available_copies: parseInt(formData.available_copies.toString()) || 0,
//         category_ids: formData.category_ids,
//         author_ids: formData.author_ids,
//         cover_image_id: coverImageId
//       };

//       const url = editingBook 
//         ? `${API_BASE_URL}/book/${editingBook.id}`
//         : `${API_BASE_URL}/book`;
      
//       const method = editingBook ? 'PUT' : 'POST';
//       const body = editingBook ? { body: bookData } : bookData;
      
//       const response = await fetch(url, {
//         method,
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(body)
//       });

//       if (!response.ok) throw new Error('Failed to save book');

//       handleCancelForm();
//       fetchBooks();
//       alert(`Book ${editingBook ? 'updated' : 'created'} successfully!`);
//     } catch (error) {
//       alert(`Failed to save book. ${error instanceof Error ? error.message : 'Please try again.'}`);
//     } finally {
//       setActionLoading(false);
//     }
//   };

//   const handleDelete = async () => {
//     if (!deleteModal.book) return;
    
//     setActionLoading(true);
//     try {
//       const response = await fetch(`${API_BASE_URL}/book/${deleteModal.book.id}`, {
//         method: 'DELETE'
//       });

//       if (!response.ok) throw new Error('Failed to delete book');

//       setDeleteModal({ isOpen: false, book: null });
//       fetchBooks();
//       alert('Book deleted successfully!');
//     } catch (error) {
//       alert('Failed to delete book. Please try again.');
//     } finally {
//       setActionLoading(false);
//     }
//   };

//   const handleCancelForm = () => {
//     setShowForm(false);
//     setEditingBook(null);
//     setFormData({
//       title: '',
//       isbn: '',
//       location: '',
//       is_reference_only: false,
//       description: '',
//       published_date: '',
//       publisher_id: '',
//       language: '',
//       page_count: 0,
//       total_copies: 0,
//       available_copies: 0,
//       category_ids: [],
//       author_ids: [],
//       cover_image_file: null,
//       cover_image_id: ''
//     });
//     setImagePreview(null);
//     onDataChange(null);
//   };

//   const saveCurrentState = () => {
//     if (showForm || searchQuery) {
//       onDataChange({
//         showForm,
//         formData,
//         editingBook,
//         searchQuery,
//         imagePreview
//       });
//     }
//   };

//   const toggleCategory = (catId: string) => {
//     setFormData(prev => ({
//       ...prev,
//       category_ids: prev.category_ids.includes(catId)
//         ? prev.category_ids.filter(id => id !== catId)
//         : [...prev.category_ids, catId]
//     }));
//   };

//   const toggleAuthor = (authorId: string) => {
//     setFormData(prev => ({
//       ...prev,
//       author_ids: prev.author_ids.includes(authorId)
//         ? prev.author_ids.filter(id => id !== authorId)
//         : [...prev.author_ids, authorId]
//     }));
//   };

//   if (showForm) {
//     return (
//       <div onClick={saveCurrentState}>
//         <div className="card shadow-sm">
//           <div className="card-header bg-primary text-white">
//             <h5 className="mb-0">{editingBook ? 'Edit Book' : 'Add New Book'}</h5>
//           </div>
//           <div className="card-body">
//             {/* Cover Image Upload */}
//             <div className="mb-4">
//               <label className="form-label fw-semibold">Cover Image</label>
//               <div className="row">
//                 <div className="col-md-8">
//                   <input
//                     type="file"
//                     className="form-control"
//                     accept="image/*"
//                     onChange={handleFileChange}
//                   />
//                   <small className="text-muted">Upload a book cover image (JPG, PNG)</small>
//                 </div>
//                 <div className="col-md-4">
//                   {(imagePreview || editingBook?.cover_image_id?.url) && (
//                     <img
//                       src={imagePreview || editingBook?.cover_image_id?.url}
//                       alt="Cover preview"
//                       className="img-thumbnail"
//                       style={{ maxHeight: '150px', width: '100%', objectFit: 'cover' }}
//                     />
//                   )}
//                 </div>
//               </div>
//             </div>

//             {/* Basic Info */}
//             <div className="row">
//               <div className="col-md-6 mb-3">
//                 <label className="form-label fw-semibold">Title *</label>
//                 <input
//                   type="text"
//                   className="form-control"
//                   value={formData.title}
//                   onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
//                 />
//               </div>
//               <div className="col-md-6 mb-3">
//                 <label className="form-label fw-semibold">ISBN *</label>
//                 <input
//                   type="text"
//                   className="form-control"
//                   value={formData.isbn}
//                   onChange={(e) => setFormData(prev => ({ ...prev, isbn: e.target.value }))}
//                 />
//               </div>
//             </div>

//             <div className="row">
//               <div className="col-md-6 mb-3">
//                 <label className="form-label fw-semibold">Location</label>
//                 <input
//                   type="text"
//                   className="form-control"
//                   placeholder="e.g., Shelf A-12"
//                   value={formData.location}
//                   onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
//                 />
//               </div>
//               <div className="col-md-6 mb-3">
//                 <label className="form-label fw-semibold">Language</label>
//                 <input
//                   type="text"
//                   className="form-control"
//                   placeholder="e.g., eng, uzb"
//                   value={formData.language}
//                   onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
//                 />
//               </div>
//             </div>

//             <div className="row">
//               <div className="col-md-4 mb-3">
//                 <label className="form-label fw-semibold">Published Date</label>
//                 <input
//                   type="date"
//                   className="form-control"
//                   value={formData.published_date}
//                   onChange={(e) => setFormData(prev => ({ ...prev, published_date: e.target.value }))}
//                 />
//               </div>
//               <div className="col-md-4 mb-3">
//                 <label className="form-label fw-semibold">Page Count</label>
//                 <input
//                   type="number"
//                   className="form-control"
//                   value={formData.page_count}
//                   onChange={(e) => setFormData(prev => ({ ...prev, page_count: parseInt(e.target.value) || 0 }))}
//                 />
//               </div>
//               <div className="col-md-4 mb-3">
//                 <label className="form-label fw-semibold">Publisher</label>
//                 <select
//                   className="form-select"
//                   value={formData.publisher_id}
//                   onChange={(e) => setFormData(prev => ({ ...prev, publisher_id: e.target.value }))}
//                 >
//                   <option value="">Select Publisher</option>
//                   {publishers.map(pub => (
//                     <option key={pub.id} value={pub.id}>{pub.name}</option>
//                   ))}
//                 </select>
//               </div>
//             </div>

//             <div className="row">
//               <div className="col-md-4 mb-3">
//                 <label className="form-label fw-semibold">Total Copies</label>
//                 <input
//                   type="number"
//                   className="form-control"
//                   value={formData.total_copies}
//                   onChange={(e) => setFormData(prev => ({ ...prev, total_copies: parseInt(e.target.value) || 0 }))}
//                 />
//               </div>
//               <div className="col-md-4 mb-3">
//                 <label className="form-label fw-semibold">Available Copies</label>
//                 <input
//                   type="number"
//                   className="form-control"
//                   value={formData.available_copies}
//                   onChange={(e) => setFormData(prev => ({ ...prev, available_copies: parseInt(e.target.value) || 0 }))}
//                 />
//               </div>
//               <div className="col-md-4 mb-3">
//                 <label className="form-label fw-semibold">Reference Only</label>
//                 <div className="form-check mt-2">
//                   <input
//                     type="checkbox"
//                     className="form-check-input"
//                     checked={formData.is_reference_only}
//                     onChange={(e) => setFormData(prev => ({ ...prev, is_reference_only: e.target.checked }))}
//                   />
//                   <label className="form-check-label">Cannot be borrowed</label>
//                 </div>
//               </div>
//             </div>

//             <div className="mb-3">
//               <label className="form-label fw-semibold">Description</label>
//               <textarea
//                 className="form-control"
//                 rows={3}
//                 value={formData.description}
//                 onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
//               />
//             </div>

//             {/* Authors Selection */}
//             <div className="mb-3">
//               <label className="form-label fw-semibold">Authors</label>
//               <div className="border rounded p-3" style={{ maxHeight: '150px', overflowY: 'auto' }}>
//                 {authors.length === 0 ? (
//                   <p className="text-muted mb-0">No authors available. Please add authors first.</p>
//                 ) : (
//                   authors.map(author => (
//                     <div key={author.id} className="form-check">
//                       <input
//                         type="checkbox"
//                         className="form-check-input"
//                         checked={formData.author_ids.includes(author.id)}
//                         onChange={() => toggleAuthor(author.id)}
//                       />
//                       <label className="form-check-label">{author.name}</label>
//                     </div>
//                   ))
//                 )}
//               </div>
//             </div>

//             {/* Categories Selection */}
//             <div className="mb-4">
//               <label className="form-label fw-semibold">Categories</label>
//               <div className="border rounded p-3" style={{ maxHeight: '150px', overflowY: 'auto' }}>
//                 {categories.length === 0 ? (
//                   <p className="text-muted mb-0">No categories available. Please add categories first.</p>
//                 ) : (
//                   categories.map(cat => (
//                     <div key={cat.id} className="form-check">
//                       <input
//                         type="checkbox"
//                         className="form-check-input"
//                         checked={formData.category_ids.includes(cat.id)}
//                         onChange={() => toggleCategory(cat.id)}
//                       />
//                       <label className="form-check-label">{cat.name}</label>
//                     </div>
//                   ))
//                 )}
//               </div>
//             </div>

//             <div className="d-flex gap-2">
//               <button 
//                 className="btn btn-primary px-4" 
//                 onClick={handleSave}
//                 disabled={actionLoading}
//               >
//                 {actionLoading ? (
//                   <>
//                     <span className="spinner-border spinner-border-sm me-2"></span>
//                     Saving...
//                   </>
//                 ) : (
//                   editingBook ? 'Update Book' : 'Create Book'
//                 )}
//               </button>
//               <button 
//                 className="btn btn-outline-secondary px-4" 
//                 onClick={handleCancelForm}
//                 disabled={actionLoading}
//               >
//                 Cancel
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div onClick={saveCurrentState}>
//       <div className="d-flex justify-content-between align-items-center mb-4">
//         <div>
//           <h3 className="mb-1">Books Management</h3>
//           <p className="text-muted mb-0">Manage library book inventory</p>
//         </div>
//         <button className="btn btn-primary" onClick={() => setShowForm(true)}>
//           + Add New Book
//         </button>
//       </div>

//       <div className="card mb-4 shadow-sm">
//         <div className="card-body