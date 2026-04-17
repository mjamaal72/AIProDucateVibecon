// Shared evaluation selection store using localStorage
// This allows evaluation selection to persist across different modules

const STORAGE_KEY = 'aiproducate_selected_evaluation';

export const evaluationStore = {
  // Get currently selected evaluation ID
  getSelectedEvaluation: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? parseInt(stored, 10) : null;
    } catch (error) {
      console.error('Error reading evaluation selection:', error);
      return null;
    }
  },

  // Set selected evaluation ID
  setSelectedEvaluation: (evalId) => {
    try {
      if (evalId) {
        localStorage.setItem(STORAGE_KEY, evalId.toString());
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error saving evaluation selection:', error);
    }
  },

  // Clear selection
  clearSelection: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing evaluation selection:', error);
    }
  }
};
