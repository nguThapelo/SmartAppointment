import React, { useState } from 'react'

const Converter = () => {

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please select a valid .docx file');
      setFile(null);
    }
  };

  const handleConvert = async () => {
    if (!file) {
      setError('Please upload a file first');
      return;
    }
  
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
  
    try {
      const response = await fetch('/api/external/PDFConverter/', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Conversion failed');
      }
  
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.replace('.docx', '')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Error converting file: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Converter</h1>
          <p className="text-sm text-slate-600">Convert DOCX documents to PDF and download instantly.</p>
        </div>
      </header>

      <div className="app-card space-y-4">
        <div>
          <label className="app-label">Upload DOCX file</label>
          <input
            type="file"
            accept=".docx"
            onChange={handleFileChange}
            disabled={loading}
            className="app-input"
          />
        </div>

        <button
          type="button"
          onClick={handleConvert}
          disabled={!file || loading}
          className="app-btn-primary w-full"
        >
          {loading ? 'Converting...' : 'Convert & Download'}
        </button>

        {error && <p className="text-sm text-rose-700">{error}</p>}
      </div>
    </section>
    )
}

export default Converter