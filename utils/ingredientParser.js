// Ingredient Parser - Extracts quantity, unit, name, and category

// Unit mappings and variations
const UNITS = {
  // Volume
  'cup': ['cup', 'cups', 'c'],
  'tablespoon': ['tablespoon', 'tablespoons', 'tbsp', 'tbs', 'tb'],
  'teaspoon': ['teaspoon', 'teaspoons', 'tsp', 'ts'],
  'fluid ounce': ['fluid ounce', 'fluid ounces', 'fl oz', 'fl. oz.'],
  'pint': ['pint', 'pints', 'pt'],
  'quart': ['quart', 'quarts', 'qt'],
  'gallon': ['gallon', 'gallons', 'gal'],
  'milliliter': ['milliliter', 'milliliters', 'ml'],
  'liter': ['liter', 'liters', 'l'],
  
  // Weight
  'pound': ['pound', 'pounds', 'lb', 'lbs'],
  'ounce': ['ounce', 'ounces', 'oz'],
  'gram': ['gram', 'grams', 'g'],
  'kilogram': ['kilogram', 'kilograms', 'kg'],
  
  // Count
  'piece': ['piece', 'pieces', 'pc'],
  'slice': ['slice', 'slices'],
  'clove': ['clove', 'cloves'],
  'stalk': ['stalk', 'stalks'],
  'can': ['can', 'cans'],
  'jar': ['jar', 'jars'],
  'package': ['package', 'packages', 'pkg'],
  'bunch': ['bunch', 'bunches'],
  'head': ['head', 'heads']
};

// Category mappings
const CATEGORIES = {
  'Produce': [
    'lettuce', 'spinach', 'kale', 'arugula', 'cabbage', 'chard',
    'tomato', 'cucumber', 'pepper', 'bell pepper', 'jalapeño', 'chili',
    'onion', 'garlic', 'shallot', 'leek', 'scallion', 'green onion',
    'carrot', 'celery', 'broccoli', 'cauliflower', 'zucchini', 'squash',
    'potato', 'sweet potato', 'yam',
    'apple', 'banana', 'orange', 'lemon', 'lime', 'berry', 'strawberry',
    'blueberry', 'raspberry', 'grape', 'melon', 'watermelon',
    'avocado', 'mushroom', 'corn', 'peas', 'green beans', 'asparagus',
    'eggplant', 'radish', 'beet', 'turnip', 'parsnip',
    'cilantro', 'parsley', 'basil', 'mint', 'thyme', 'rosemary', 'oregano',
    'dill', 'sage', 'tarragon', 'chives', 'ginger', 'herbs'
  ],
  
  'Meat & Seafood': [
    'chicken', 'beef', 'pork', 'turkey', 'lamb', 'duck', 'bacon',
    'sausage', 'ham', 'ground beef', 'ground turkey', 'ground pork',
    'steak', 'roast', 'chop', 'breast', 'thigh', 'wing',
    'salmon', 'tuna', 'cod', 'tilapia', 'shrimp', 'crab', 'lobster',
    'clam', 'mussel', 'oyster', 'scallop', 'fish', 'seafood'
  ],
  
  'Dairy': [
    'milk', 'cream', 'half and half', 'buttermilk', 'sour cream',
    'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'goat cheese',
    'cream cheese', 'ricotta', 'cottage cheese',
    'butter', 'yogurt', 'greek yogurt', 'eggs', 'egg'
  ],
  
  'Bakery': [
    'bread', 'baguette', 'roll', 'bun', 'bagel', 'english muffin',
    'tortilla', 'pita', 'naan', 'croissant', 'biscuit',
    'cake', 'pie', 'pastry', 'muffin', 'donut'
  ],
  
  'Pantry': [
    'flour', 'sugar', 'brown sugar', 'powdered sugar', 'salt', 'pepper',
    'oil', 'olive oil', 'vegetable oil', 'coconut oil', 'sesame oil',
    'vinegar', 'balsamic vinegar', 'rice vinegar', 'apple cider vinegar',
    'soy sauce', 'worcestershire', 'hot sauce', 'ketchup', 'mustard',
    'mayonnaise', 'honey', 'maple syrup', 'molasses',
    'rice', 'pasta', 'noodle', 'quinoa', 'couscous', 'barley',
    'beans', 'lentils', 'chickpeas', 'black beans', 'kidney beans',
    'tomato sauce', 'tomato paste', 'diced tomatoes', 'crushed tomatoes',
    'broth', 'stock', 'bouillon',
    'baking powder', 'baking soda', 'yeast', 'cornstarch', 'vanilla',
    'cinnamon', 'cumin', 'paprika', 'chili powder', 'garlic powder',
    'onion powder', 'cayenne', 'turmeric', 'curry', 'spice', 'spices',
    'nuts', 'almonds', 'walnuts', 'pecans', 'peanuts', 'cashews',
    'chocolate', 'cocoa', 'chips', 'raisins', 'dried fruit'
  ],
  
  'Frozen': [
    'frozen', 'ice cream', 'frozen vegetables', 'frozen fruit',
    'frozen pizza', 'frozen dinner', 'popsicle'
  ],
  
  'Beverages': [
    'water', 'juice', 'soda', 'coffee', 'tea', 'wine', 'beer',
    'liquor', 'vodka', 'rum', 'whiskey', 'tequila'
  ]
};

// Normalize unit to standard form
function normalizeUnit(unitStr) {
  if (!unitStr) return null;
  
  const normalized = unitStr.toLowerCase().trim();
  
  for (const [standard, variations] of Object.entries(UNITS)) {
    if (variations.includes(normalized)) {
      return standard;
    }
  }
  
  return normalized; // Return as-is if not found
}

// Determine category based on ingredient name
function categorizeIngredient(name) {
  const normalized = name.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'Other';
}

// Parse fraction strings to decimals
function parseFraction(str) {
  if (str.includes('/')) {
    const [num, denom] = str.split('/').map(s => parseFloat(s.trim()));
    return num / denom;
  }
  return parseFloat(str);
}

// Parse quantity (handles fractions, ranges, etc.)
function parseQuantity(str) {
  if (!str) return null;
  
  str = str.trim();
  
  // Handle ranges (e.g., "1-2" or "1 to 2")
  if (str.includes('-') || str.includes('to')) {
    const parts = str.split(/[-to]+/).map(s => s.trim());
    const nums = parts.map(parseFraction);
    return nums[0]; // Use first number in range
  }
  
  // Handle mixed numbers (e.g., "1 1/2")
  const mixedMatch = str.match(/(\d+)\s+(\d+\/\d+)/);
  if (mixedMatch) {
    return parseFloat(mixedMatch[1]) + parseFraction(mixedMatch[2]);
  }
  
  // Handle simple fractions or decimals
  return parseFraction(str);
}

// Main parsing function
function parseIngredient(ingredientText) {
  if (!ingredientText || typeof ingredientText !== 'string') {
    return {
      original: ingredientText,
      quantity: null,
      unit: null,
      name: ingredientText || '',
      category: 'Other'
    };
  }
  
  let text = ingredientText.trim();
  
  // Regex to match quantity + unit pattern
  // Matches: "2 cups", "1/2 cup", "1 1/2 tablespoons", "2-3 lbs", etc.
  const quantityUnitRegex = /^([\d\s\/\-to]+)\s*([a-zA-Z\.]+)?/i;
  const match = text.match(quantityUnitRegex);
  
  let quantity = null;
  let unit = null;
  let name = text;
  
  if (match) {
    const quantityStr = match[1].trim();
    const unitStr = match[2];
    
    // Only parse if it looks like a real quantity (not just any number)
    if (quantityStr && /[\d\/]/.test(quantityStr)) {
      quantity = parseQuantity(quantityStr);
      
      if (unitStr) {
        unit = normalizeUnit(unitStr);
        // Remove quantity and unit from the name
        name = text.substring(match[0].length).trim();
      } else {
        // Just quantity, no unit - remove only quantity
        name = text.substring(match[1].length).trim();
      }
    }
  }
  
  // Clean up the name
  name = name
    .replace(/^(of|,|-)\s*/i, '') // Remove leading "of", commas, dashes
    .replace(/\(.*?\)/g, '') // Remove parentheses
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Determine category
  const category = categorizeIngredient(name);
  
  return {
    original: ingredientText,
    quantity,
    unit,
    name,
    category
  };
}

module.exports = { parseIngredient, categorizeIngredient, normalizeUnit };