import React, { useState } from 'react';
import { db, auth } from './firebase';
import { collection, query, getDocs, doc, updateDoc, limit } from 'firebase/firestore';
import './AdminPage.css';

const searchableFields = [
  { id: 'question', name: 'Question' },
  { id: 'answer', name: 'Answer' },
  { id: 'explanation', name: 'Explanation' },
  { id: 'hint', name: 'Hint' },
  { id: 'reinforcementTask', name: 'Reinforcement Task' },
  { id: 'tags', name: 'Tags' },
  { id: 'source', name: 'Source' },
  { id: 'category', name: 'Category' }
];

const AdminPage = () => {
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFields, setSelectedFields] = useState(['question']);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [searchCount, setSearchCount] = useState(0);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [error, setError] = useState(null);
  
  // Question editing state
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    question: '',
    answer: '',
    explanation: '',
    reinforcementTask: '',
    tags: '',
    source: '',
    hint: '',
    options: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [jsonOutput, setJsonOutput] = useState('');
  const [showJson, setShowJson] = useState(false);

  // Constants
  const MAX_RESULTS = 100;
  const MAX_DOCS_TO_PROCESS = 1000;

  // Handle field selection in search
  const handleFieldToggle = (fieldId) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) 
        ? prev.filter(id => id !== fieldId) 
        : [...prev, fieldId]
    );
  };

  // Execute search
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim() || selectedFields.length === 0) {
      return;
    }

    setIsSearching(true);
    setNoResults(false);
    setSearchResults([]);
    setSearchCount(0);
    setHasMoreResults(false);
    setSaveSuccess(false);
    setSaveError(null);
    setError(null);

    try {
      const searchTermLower = searchTerm.toLowerCase();
      let allResults = [];
      let totalDocCount = 0;

      // Create a query for each selected field
      for (const field of selectedFields) {
        // Use a separate function to process each field to avoid the loop function issue
        const { results, count } = await processField(field, searchTermLower);
        allResults = [...allResults, ...results];
        totalDocCount += count;
      }

      // Remove duplicates based on question ID
      const uniqueResults = Array.from(
        new Map(allResults.map(item => [item.id, item])).values()
      );

      // Limit results
      const limitedResults = uniqueResults.slice(0, MAX_RESULTS);

      setSearchResults(limitedResults);
      setJsonOutput(JSON.stringify(limitedResults, null, 2));
      console.log(`Processed ${totalDocCount} documents, found ${limitedResults.length} matches`);
      
      setSearchCount(limitedResults.length);
      setNoResults(limitedResults.length === 0);
      setHasMoreResults(limitedResults.length > MAX_RESULTS);
    } catch (error) {
      console.error('Error searching questions:', error);
      setError('Error searching questions: ' + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  // Helper function to process each field separately to avoid loop function issues
  const processField = async (field, searchTermLower) => {
    const q = query(collection(db, 'questions'), limit(MAX_DOCS_TO_PROCESS));
    const snapshot = await getDocs(q);
    const fieldResults = [];
    let count = 0;
    
    snapshot.forEach(doc => {
      count++;
      const data = doc.data();
      
      // Handle tags array separately
      if (field === 'tags') {
        if (data.tags && Array.isArray(data.tags)) {
          const tagMatches = data.tags.some(tag => 
            tag.toLowerCase().includes(searchTermLower)
          );
          if (tagMatches) {
            fieldResults.push({ id: doc.id, ...data });
          }
        }
      } else if (data[field] && typeof data[field] === 'string') {
        // For string fields, check if the field contains the search term
        if (data[field].toLowerCase().includes(searchTermLower)) {
          fieldResults.push({ id: doc.id, ...data });
        }
      }
    });
    
    return { results: fieldResults, count };
  };

  // Handle selecting a question for editing
  const handleSelectQuestion = (question) => {
    setSelectedQuestion(question);
    setQuestionForm({
      question: question.question || '',
      answer: typeof question.answer === 'object' ? JSON.stringify(question.answer) : question.answer || '',
      explanation: question.explanation || '',
      reinforcementTask: question.reinforcementTask || '',
      tags: question.tags ? question.tags.join(', ') : '',
      source: question.source || '',
      hint: question.hint || '',
      options: question.options || ''
    });
    setSaveSuccess(false);
    setSaveError(null);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setQuestionForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save edited question with admin credential check
  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!selectedQuestion) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    setShowJson(false);

    try {
      // Check if current user is admin
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== "PRmcNpP6eVXHfsaa6PdaD4pTH3m1") {
        throw new Error("You don't have permission to edit questions. Only the admin can make changes.");
      }

      // Process form data
      const updatedQuestion = {
        ...selectedQuestion,
        question: questionForm.question,
        explanation: questionForm.explanation,
        reinforcementTask: questionForm.reinforcementTask,
        source: questionForm.source,
        hint: questionForm.hint,
        options: questionForm.options
      };

      // Handle answer which might be an object for matching questions
      if (selectedQuestion.type === 'matching') {
        try {
          updatedQuestion.answer = JSON.parse(questionForm.answer);
        } catch (e) {
          setSaveError("Invalid JSON format for matching answer");
          setIsSaving(false);
          return;
        }
      } else {
        updatedQuestion.answer = questionForm.answer;
      }

      // Process tags
      if (questionForm.tags.trim()) {
        updatedQuestion.tags = questionForm.tags
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0);
      } else {
        updatedQuestion.tags = [];
      }

      try {
        // Try to update in Firestore directly
        const questionRef = doc(db, 'questions', selectedQuestion.id.toString());
        await updateDoc(questionRef, updatedQuestion);

        // Update local state
        setSearchResults(prev => 
          prev.map(q => q.id === selectedQuestion.id ? updatedQuestion : q)
        );
        setSelectedQuestion(updatedQuestion);
        setSaveSuccess(true);
      } catch (firebaseError) {
        console.error("Error saving question:", firebaseError);
        
        // If we get a permissions error, provide the JSON for a workaround
        if (firebaseError.message.includes("Missing or insufficient permissions")) {
          const updateData = {
            question: updatedQuestion.question,
            answer: updatedQuestion.answer,
            explanation: updatedQuestion.explanation,
            reinforcementTask: updatedQuestion.reinforcementTask,
            source: updatedQuestion.source,
            hint: updatedQuestion.hint,
            options: updatedQuestion.options,
            tags: updatedQuestion.tags
          };
          
          const jsonString = JSON.stringify(updateData, null, 2);
          setJsonOutput(jsonString);
          setShowJson(true);
          
          setSaveError(
            "Failed to save question due to permissions. This is a known issue with the current setup." +
            " Please use the JSON data below with the server-side script to update this question."
          );
        } else {
          setSaveError("Failed to save question: " + firebaseError.message);
        }
      }
    } catch (error) {
      console.error("Error saving question:", error);
      setSaveError("Failed to save question: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Clear form and selection
  const handleCancelEdit = () => {
    setSelectedQuestion(null);
    setQuestionForm({
      question: '',
      answer: '',
      explanation: '',
      reinforcementTask: '',
      tags: '',
      source: '',
      hint: '',
      options: ''
    });
    setSaveSuccess(false);
    setSaveError(null);
  };

  return (
    <div className="admin-page">
      <h1>Question Admin</h1>
      
      {/* Search form */}
      <div className="search-section">
        <h2>Search Questions</h2>
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-fields">
            <label>Search in:</label>
            <div className="field-checkboxes">
              {searchableFields.map(field => (
                <label key={field.id} className="field-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field.id)}
                    onChange={() => handleFieldToggle(field.id)}
                  />
                  {field.name}
                </label>
              ))}
            </div>
          </div>
          
          <div className="search-input-group">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter search term..."
              className="search-input"
            />
            <button 
              type="submit" 
              className="search-button"
              disabled={isSearching || !searchTerm.trim() || selectedFields.length === 0}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Search results */}
      <div className="results-section">
        {isSearching ? (
          <p className="searching-message">Searching questions... This might take a moment.</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : noResults ? (
          <p className="no-results">No questions found matching your search criteria.</p>
        ) : searchResults.length > 0 ? (
          <div className="search-results">
            <h3>
              {hasMoreResults 
                ? `Found ${searchCount} questions (showing first ${searchResults.length})`
                : `Found ${searchResults.length} question(s)`}
            </h3>
            <div className="results-list">
              {searchResults.map(question => (
                <div 
                  key={question.id} 
                  className={`result-item ${selectedQuestion?.id === question.id ? 'selected' : ''}`}
                  onClick={() => handleSelectQuestion(question)}
                >
                  <div className="result-header">
                    <span className="result-id">ID: {question.id}</span>
                    <span className="result-category">{question.category}</span>
                    <span className="result-type">{question.type}</span>
                  </div>
                  <div className="result-content">
                    <p>{question.question}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      
      {/* Question editor */}
      {selectedQuestion && (
        <div className="editor-section">
          <h2>Edit Question</h2>
          <div className="question-details">
            <div className="detail-item">
              <span className="detail-label">ID:</span>
              <span className="detail-value">{selectedQuestion.id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Category:</span>
              <span className="detail-value">{selectedQuestion.category}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Type:</span>
              <span className="detail-value">{selectedQuestion.type}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Difficulty:</span>
              <span className="detail-value">{selectedQuestion.difficulty}</span>
            </div>
          </div>
          
          <form onSubmit={handleSaveQuestion} className="editor-form">
            <div className="form-group">
              <label htmlFor="question">Question:</label>
              <textarea
                id="question"
                name="question"
                value={questionForm.question}
                onChange={handleInputChange}
                rows={3}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="answer">
                Answer: {selectedQuestion.type === 'matching' && '(JSON format)'}
              </label>
              <textarea
                id="answer"
                name="answer"
                value={questionForm.answer}
                onChange={handleInputChange}
                rows={selectedQuestion.type === 'matching' ? 5 : 2}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="explanation">Explanation:</label>
              <textarea
                id="explanation"
                name="explanation"
                value={questionForm.explanation}
                onChange={handleInputChange}
                rows={3}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="hint">Hint:</label>
              <textarea
                id="hint"
                name="hint"
                value={questionForm.hint}
                onChange={handleInputChange}
                rows={2}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="options">Options: {(selectedQuestion.type === 'multiple-choice' || selectedQuestion.type === 'matching') && '(comma-separated)'}</label>
              <textarea
                id="options"
                name="options"
                value={questionForm.options}
                onChange={handleInputChange}
                rows={2}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="reinforcementTask">Reinforcement Task:</label>
              <textarea
                id="reinforcementTask"
                name="reinforcementTask"
                value={questionForm.reinforcementTask}
                onChange={handleInputChange}
                rows={3}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="tags">Tags (comma-separated):</label>
              <input
                type="text"
                id="tags"
                name="tags"
                value={questionForm.tags}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="source">Source:</label>
              <input
                type="text"
                id="source"
                name="source"
                value={questionForm.source}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="form-buttons">
              <button 
                type="button" 
                onClick={handleCancelEdit} 
                className="cancel-button"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="save-button"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
            
            {saveSuccess && (
              <div className="success-message">Question updated successfully!</div>
            )}
            
            {saveError && (
              <div className="error-message">{saveError}</div>
            )}
            
            {showJson && (
              <div className="json-output">
                <h4>JSON data for server-side update:</h4>
                <p>Run this command in the scripts directory:</p>
                <pre className="command-example">
                  node updateQuestionFull.js {selectedQuestion.id} '{jsonOutput.replace(/\n\s*/g, ' ')}'
                </pre>
                <details>
                  <summary>View full JSON</summary>
                  <pre>{jsonOutput}</pre>
                </details>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

export default AdminPage; 