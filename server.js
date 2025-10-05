const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.use(cors());

// WEBHOOK MUST COME BEFORE express.json()
app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.supabase_user_id;
    const subscriptionId = session.subscription;

    await supabase
      .from('users')
      .update({ 
        subscription_status: 'pro',
        subscription_id: subscriptionId,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    console.log(`User ${userId} upgraded to Pro`);
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId = subscription.customer;

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (user) {
      await supabase
        .from('users')
        .update({ 
          subscription_status: 'free',
          subscription_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      console.log(`User ${user.id} downgraded to Free`);
    }
  }

  res.json({received: true});
});

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Yolksters API',
    endpoints: {
      '/api/recipe': 'POST',
      '/api/create-checkout': 'POST',
      '/api/webhook': 'POST',
      '/api/user-status': 'GET'
    }
  });
});

app.post('/api/recipe', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL required' });
    }

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch' });
    }

    const html = await response.text();
    const recipeData = extractRecipeFromHTML(html);
    
    if (!recipeData) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    res.json({ success: true, recipe: recipeData });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/create-checkout', async (req, res) => {
  try {
    const { userId, email } = req.body;
    
    if (!userId || !email) {
      return res.status(400).json({ error: 'User ID and email required' });
    }

    let customer;
    const { data: existingUser } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (existingUser?.stripe_customer_id) {
      customer = await stripe.customers.retrieve(existingUser.stripe_customer_id);
    } else {
      customer = await stripe.customers.create({
        email: email,
        metadata: { supabase_user_id: userId }
      });
      
      await supabase
        .from('users')
        .upsert({ 
          id: userId,
          email: email,
          stripe_customer_id: customer.id 
        });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Yolksters Pro',
            description: 'Unlimited recipes!',
          },
          unit_amount: 499,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: 'https://yolksters.com?success=true',
      cancel_url: 'https://yolksters.com?canceled=true',
      metadata: { supabase_user_id: userId }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

app.get('/api/user-status', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.json({ status: 'free' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('subscription_status')
      .eq('id', userId)
      .single();

    res.json({ status: user?.subscription_status || 'free' });
  } catch (error) {
    res.json({ status: 'free' });
  }
});

function extractRecipeFromHTML(html) {
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1].trim());
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
          instructions: extractInstructions(recipe.recipeInstructions)
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
  console.log(`API running on port ${PORT}`);
});

module.exports = app;