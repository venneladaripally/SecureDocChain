import { useState } from 'react';
import { uploadDocument } from '../api/documentApi';

function UploadForm({ onUploadSuccess }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please select a file');
      return;
    }

    setIsSubmitting(true);

    try {
      await uploadDocument(title, description, category, file);
      setTitle('');
      setDescription('');
      setCategory('');
      setFile(null);
      e.target.reset();
      onUploadSuccess();
    } catch (err) {
      const message = err.response?.data?.message || 'Upload failed. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <h3>Upload a document</h3>

      <div className="form-group">
        <label htmlFor="title">Document title</label>
        <input className="form-input" id="title" type="text" placeholder="e.g. Engineering Specification v1"
          value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <input className="form-input" id="description" type="text" placeholder="Optional document description"
          value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="form-group">
        <label htmlFor="category">Category</label>
        <input className="form-input" id="category" type="text" placeholder="e.g. Contracts, Reports"
          value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>

      <div className="form-group full-width">
        <label htmlFor="file">Document file</label>
        <input className="file-input" id="file" type="file"
          onChange={(e) => setFile(e.target.files[0])} required />
      </div>

      {error && <div className="error-message">{error}</div>}

      <button className="upload-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Uploading...' : 'Upload document'}
      </button>
    </form>
  );
}

export default UploadForm;