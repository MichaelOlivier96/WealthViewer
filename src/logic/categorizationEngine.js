import { sqliteClient } from '../db/sqliteClient.js';

export const categorizationEngine = {
  rules: [],

  loadRules: async () => {
    try {
      const rows = await sqliteClient.query(`
        SELECT r.keyword, c.name as categoryName 
        FROM category_rules r 
        JOIN categories c ON r.category_id = c.id
      `);
      categorizationEngine.rules = rows;
    } catch (err) {
      console.error('Failed to load categorization rules:', err);
    }
  },

  categorize: (description) => {
    if (!description) return 'Uncategorized';
    
    const upperDesc = description.toUpperCase();
    const match = categorizationEngine.rules.find(rule => 
      upperDesc.includes(rule.keyword.toUpperCase())
    );
    
    return match ? match.categoryName : 'Uncategorized';
  }
};
