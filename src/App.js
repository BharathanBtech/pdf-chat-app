import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';

function App() {
  const [pdfFiles, setPdfFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  const API_ENDPOINT = 'https://pds-workflow.tekclansolutions.com/api/v1/webhooks/HF7SiXi5FLcoSDI4uzTrQ/sync';

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Upload single PDF to Activepieces API
  const uploadPDFToAPI = async (file) => {
    try {
      const base64Data = await fileToBase64(file);
      
      const payload = {
        inputfile: base64Data,
        file_name: file.name,
        document_title: file.name.replace('.pdf', '') // Use filename as document title
      };

      const response = await axios.post(API_ENDPOINT, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 120000 // 2 minute timeout
      });

      if (response.status === 200) {
        return { success: true, message: `File "${file.name}" uploaded to vector database successfully!` };
      } else {
        return { success: false, message: `Failed to upload "${file.name}". Status: ${response.status}` };
      }
    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error);
      return { 
        success: false, 
        message: `Error uploading "${file.name}": ${error.response?.data?.message || error.message}` 
      };
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    const pdfFiles = acceptedFiles.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        content: 'No PDF files found. Please select PDF files only.',
        timestamp: new Date().toLocaleTimeString()
      }]);
      return;
    }

    setPdfFiles(prev => [...prev, ...pdfFiles]);
    setIsUploading(true);
    setUploadProgress({});

    // Add system message for upload start
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'system',
      content: `Starting upload of ${pdfFiles.length} PDF file(s)...`,
      timestamp: new Date().toLocaleTimeString()
    }]);

    let successCount = 0;

    // Upload each PDF file
    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      
      // Update progress
      setUploadProgress(prev => ({
        ...prev,
        [file.name]: { status: 'uploading', progress: 0 }
      }));

      try {
        const result = await uploadPDFToAPI(file);
        
        // Update progress
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { 
            status: result.success ? 'success' : 'error', 
            progress: 100 
          }
        }));

        if (result.success) {
          successCount++;
        }

        // Add result message
        setMessages(prev => [...prev, {
          id: Date.now() + i,
          type: result.success ? 'system' : 'error',
          content: result.message,
          timestamp: new Date().toLocaleTimeString()
        }]);

        // Add small delay between uploads to avoid overwhelming the API
        if (i < pdfFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'error', progress: 100 }
        }));

        setMessages(prev => [...prev, {
          id: Date.now() + i,
          type: 'error',
          content: `Failed to process "${file.name}": ${error.message}`,
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
    }

    setIsUploading(false);

    // Add completion message
    setMessages(prev => [...prev, {
      id: Date.now() + pdfFiles.length,
      type: 'system',
      content: `Upload complete! ${successCount} out of ${pdfFiles.length} files uploaded successfully. You can now ask questions about the uploaded documents.`,
      timestamp: new Date().toLocaleTimeString()
    }]);
  }, [uploadPDFToAPI]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || pdfFiles.length === 0) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Simulate AI response based on uploaded PDFs
      const response = await simulateAIResponse(inputMessage, pdfFiles);
      
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: response,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'error',
        content: 'Error getting response. Please try again.',
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const simulateAIResponse = async (question, uploadedFiles) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const lowerQuestion = question.toLowerCase();
    const fileNames = uploadedFiles.map(f => f.name).join(', ');
    
    if (lowerQuestion.includes('what') && lowerQuestion.includes('document')) {
      return `I can see you've uploaded ${uploadedFiles.length} document(s): ${fileNames}. These documents have been processed and are now available for analysis.`;
    } else if (lowerQuestion.includes('upload') || lowerQuestion.includes('file')) {
      return `You have successfully uploaded ${uploadedFiles.length} PDF file(s) to the vector database. The files are now indexed and ready for querying.`;
    } else if (lowerQuestion.includes('summary') || lowerQuestion.includes('overview')) {
      return `Based on the uploaded documents (${fileNames}), I can provide insights and answer questions about their content. What specific information would you like to know?`;
    } else {
      return `I can help you analyze the content of your uploaded documents: ${fileNames}. Please ask specific questions about the document content, and I'll provide detailed answers based on the vector database.`;
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setPdfFiles([]);
    setUploadProgress({});
  };

  const removeFile = (fileName) => {
    setPdfFiles(prev => prev.filter(file => file.name !== fileName));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileName];
      return newProgress;
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>📄 PDF Chat Assistant</h1>
        <p>Upload PDFs and ask questions about their content</p>
      </header>

      <main className="App-main">
        {pdfFiles.length === 0 ? (
          <div className="upload-section">
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              {isDragActive ? (
                <p>Drop the PDF files here...</p>
              ) : (
                <div>
                  <p>📁 Drag & drop PDF files here, or click to select</p>
                  <p className="upload-hint">Supports multiple .pdf files</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="chat-container">
            <div className="chat-header">
              <div className="file-info">
                <span className="file-name">
                  📄 {pdfFiles.length} file(s) uploaded
                </span>
                <button onClick={clearChat} className="clear-btn">Clear All</button>
              </div>
            </div>

            {/* File list */}
            <div className="files-list">
              {pdfFiles.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-name-text">{file.name}</span>
                  <div className="file-actions">
                    {uploadProgress[file.name] && (
                      <span className={`status ${uploadProgress[file.name].status}`}>
                        {uploadProgress[file.name].status === 'uploading' && '⏳ Uploading...'}
                        {uploadProgress[file.name].status === 'success' && '✅ Success'}
                        {uploadProgress[file.name].status === 'error' && '❌ Error'}
                      </span>
                    )}
                    <button 
                      onClick={() => removeFile(file.name)} 
                      className="remove-btn"
                      title="Remove file"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="messages-container">
              {messages.map((message) => (
                <div key={message.id} className={`message ${message.type}`}>
                  <div className="message-content">
                    {message.content}
                  </div>
                  <div className="message-timestamp">
                    {message.timestamp}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message ai">
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="input-container">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask questions about your uploaded documents..."
                disabled={isLoading}
                rows="2"
              />
              <button 
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="send-btn"
              >
                {isLoading ? '⏳' : '📤'}
              </button>
            </div>
          </div>
        )}

        {isUploading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Uploading PDFs to vector database...</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
