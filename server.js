const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Yolksters API - Crack open clean recipes!',
    endpoints: {
      '/api/recipe': 'POST - Fetch and parse a recipe URL',
      '/api/create-checkout': 'POST - Create Stripe checkout session'
    }
  });
});

app.post('/api/recipe', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL is required',
        message: 'Please provide a recipe URL in the request body'
      });
    }

    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ 
        error: 'Invalid URL',
        message: 'Please provide a valid URL'
      });
    }

    console.log(`Fetching recipe from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to fetch recipe',
        message: `The recipe website returned status ${response.status}`
      });
    }

    const html = await response.text();
    const recipeData = extractRecipeFromHTML(html);
    
    if (!recipeData) {
      return res.status(404).json({
        error: 'Recipe not found',
        message: 'Could not find recipe data on this page. The site may not use standard recipe markup.'
      });
    }

    res.json({
      success: true,
      recipe: recipeData
    });

  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while fetching the recipe. Please try again.'
    });
  }
});

// Stripe checkout endpoint
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { priceId } = req.body;
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Yolksters Pro',
              description: 'Unlimited recipes, save favorites, shopping lists, and more!',
            },
            unit_amount: 499, // $4.99 in cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: 'https://yolksters.com?success=true',
      cancel_url: 'https://yolksters.com?canceled=true',
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
});

function extractRecipeFromHTML(html) {
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  
  for (const match of jsonLdMatches) {
    try {
      const jsonContent = match[1].trim();
      const data = JSON.parse(jsonContent);
      
      const items = Array.isArray(data) ? data : [data];
      const allItems = [];
      
      for (const item of items) {
        if (item['@graph']) {
          allItems.push(...item['@graph']);
        } else {
          allItems.push(item);
        }
      }
      
      const recipe = allItems.find(item => item['@type'] === 'Recipe');
      
      if (recipe) {
        return {
          name: recipe.name || 'Untitled Recipe',
          ingredients: extractIngredients(recipe.recipeIngredient),
          instructions: extractInstructions(recipe.recipeInstructions),
          servings: recipe.recipeYield || null,
          prepTime: recipe.prepTime || null,
          cookTime: recipe.cookTime || null,
          totalTime: recipe.totalTime || null,
          image: recipe.image?.url || recipe.image || null
        };
      }
    } catch (e) {
      continue;
    }
  }
  
  return null;
}

function extractIngredients(recipeIngredient) {
  if (!recipeIngredient) return [];
  
  if (Array.isArray(recipeIngredient)) {
    return recipeIngredient.filter(i => i && typeof i === 'string');
  }
  
  if (typeof recipeIngredient === 'string') {
    return [recipeIngredient];
  }
  
  return [];
}

function extractInstructions(recipeInstructions) {
  if (!recipeInstructions) return [];
  
  const instructions = [];
  
  if (Array.isArray(recipeInstructions)) {
    for (const instruction of recipeInstructions) {
      if (typeof instruction === 'string') {
        instructions.push(instruction);
      } else if (instruction.text) {
        instructions.push(instruction.text);
      } else if (instruction['@type'] === 'HowToStep' && instruction.text) {
        instructions.push(instruction.text);
      } else if (instruction['@type'] === 'HowToSection' && instruction.itemListElement) {
        for (const step of instruction.itemListElement) {
          if (step.text) instructions.push(step.text);
        }
      }
    }
  } else if (typeof recipeInstructions === 'string') {
    instructions.push(recipeInstructions);
  } else if (recipeInstructions.text) {
    instructions.push(recipeInstructions.text);
  }
  
  return instructions.filter(i => i);
}

app.listen(PORT, () => {
  console.log(`Yolksters API running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;