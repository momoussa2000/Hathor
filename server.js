console.log('--- Loading server.js module ---');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 5003;

// Initialize OpenAI with better error handling
const initializeOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OpenAI API key is not configured');
    return null;
  }
  return new OpenAI({ apiKey });
};

const openai = initializeOpenAI();

// Add middleware to check OpenAI initialization
const checkOpenAI = (req, res, next) => {
  if (!openai) {
    return res.status(500).json({
      error: 'OpenAI is not properly configured',
      message: 'Please check the API key configuration'
    });
  }
  next();
};

// Helper function to handle OpenAI errors
const handleOpenAIError = (error) => {
  console.error('OpenAI API Error:', error);
  
  const errorMap = {
    'insufficient_quota': {
      status: 429,
      message: "We're currently experiencing high demand. Please try again later."
    },
    'invalid_api_key': {
      status: 401,
      message: "Authentication error. Please check the API configuration."
    },
    'model_not_found': {
      status: 400,
      message: "The requested AI model is not available. Please try again later."
    },
    'rate_limit_exceeded': {
      status: 429,
      message: "Too many requests. Please try again in a few moments."
    }
  };

  const errorInfo = errorMap[error.code] || {
    status: error.status || 500,
    message: "An error occurred while processing your request."
  };

  return errorInfo;
};

// Enable CORS for all origins in production
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.use(express.json());

// Product catalog - this would typically come from a database
const products = {
  oils: [
    {
      name: "Moringa Oil",
      benefits: ["hair growth", "anti-aging", "moisturizing", "dandruff prevention", "acne treatment", "skin brightening"],
      description: "Cold-pressed moringa oil rich in antioxidants and vitamins",
      properties: {
        antiInflammatory: true,
        antibacterial: true,
        moisturizing: true,
        antioxidant: true
      },
      recommendedUses: ["facial oil", "hair treatment", "body moisturizer"],
      sizes: [
        {
          size: "15ml",
          price: "LE 480.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/collections/all/products/moringa-oil"
        },
        {
          size: "30ml",
          price: "LE 850.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/collections/all/products/moringa-oil"
        }
      ]
    },
    {
      name: "Sesame Oil",
      benefits: ["hair growth", "moisturizing", "anti-inflammatory", "UV protection", "acne treatment", "skin healing"],
      description: "Pure cold-pressed sesame oil with natural UV protection",
      properties: {
        antiInflammatory: true,
        antibacterial: true,
        moisturizing: true,
        UVProtection: true
      },
      recommendedUses: ["facial oil", "body oil", "hair treatment"],
      sizes: [
        {
          size: "15ml",
          price: "LE 450.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/collections/all/products/sesame-oil"
        },
        {
          size: "30ml",
          price: "LE 800.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/collections/all/products/sesame-oil"
        }
      ]
    },
    {
      name: "Jojoba Oil",
      benefits: ["acne treatment", "moisturizing", "balancing", "anti-aging", "hair growth"],
      description: "Pure jojoba oil that mimics skin's natural sebum",
      properties: {
        balancing: true,
        moisturizing: true,
        antibacterial: true,
        nonComedogenic: true
      },
      recommendedUses: ["facial oil", "makeup remover", "hair treatment"],
      sizes: [
        {
          size: "15ml",
          price: "LE 480.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/collections/all/products/jojoba-oil"
        },
        {
          size: "30ml",
          price: "LE 850.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/collections/all/products/jojoba-oil"
        }
      ]
    },
    {
      name: "Acne Set",
      benefits: ["acne treatment", "skin balancing", "anti-inflammatory", "healing"],
      description: "Complete acne treatment set with specially formulated oils",
      properties: {
        antiInflammatory: true,
        antibacterial: true,
        balancing: true,
        healing: true
      },
      recommendedUses: ["facial treatment", "spot treatment"],
      sizes: [
        {
          size: "Set",
          price: "LE 985.00",
          link: "https://hathororganics.com/collections/all/products/acne-set"
        }
      ]
    },
    {
      name: "Garden Cress Oil",
      benefits: ["hair growth", "scalp health", "dandruff prevention", "hair strengthening"],
      description: "Cold-pressed garden cress oil rich in nutrients for hair growth",
      properties: {
        hairGrowth: true,
        scalpHealth: true,
        antiDandruff: true,
        strengthening: true
      },
      recommendedUses: ["hair treatment", "scalp massage"],
      sizes: [
        {
          size: "15ml",
          price: "LE 480.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/collections/all/products/garden-cress-oil"
        },
        {
          size: "30ml",
          price: "LE 850.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/collections/all/products/garden-cress-oil"
        }
      ]
    },
    {
      name: "Frankincense Oil",
      benefits: ["hair growth", "scalp health", "anti-inflammatory", "stress relief"],
      description: "Pure frankincense oil for hair and scalp health",
      properties: {
        antiInflammatory: true,
        scalpHealth: true,
        stressRelief: true,
        hairGrowth: true
      },
      recommendedUses: ["hair treatment", "scalp massage", "aromatherapy"],
      sizes: [
        {
          size: "15ml",
          price: "LE 480.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/collections/all/products/frankincense-oil"
        },
        {
          size: "30ml",
          price: "LE 850.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/collections/all/products/frankincense-oil"
        }
      ]
    },
    {
      name: "Rosemary Oil",
      benefits: ["hair growth", "scalp circulation", "dandruff prevention", "hair strengthening"],
      description: "Pure rosemary oil for stimulating hair growth and scalp health",
      properties: {
        hairGrowth: true,
        scalpCirculation: true,
        antiDandruff: true,
        strengthening: true
      },
      recommendedUses: ["hair treatment", "scalp massage"],
      sizes: [
        {
          size: "15ml",
          price: "LE 480.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/rosemary-oil"
        },
        {
          size: "30ml",
          price: "LE 850.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/rosemary-oil"
        }
      ]
    }
  ]
};

// Common ailments and their treatments
const ailmentsKnowledgeBase = {
  "acne": {
    "description": "A common skin condition characterized by pimples, blackheads, and inflammation",
    "recommended_oils": ["sesame", "moringa", "argan", "lavender", "rosemary"],
    "treatment_plan": {
      "primary_oils": ["sesame", "moringa"],
      "supporting_oils": ["argan", "lavender", "rosemary"],
      "application": "Evening ritual only",
      "duration": "4-6 weeks",
      "frequency": "Daily",
      "precautions": "Always dilute essential oils with carrier oils. Perform patch test before full application.",
      "benefits": "Purifies skin, regulates sebum production, reduces inflammation, prevents future breakouts",
      "measurements": {
        "sesame": "2-3 drops (2-6ml)",
        "moringa": "2-3 drops (2-6ml)",
        "argan": "1-2 drops (1-4ml)",
        "lavender": "1 drop (1-2ml)",
        "rosemary": "1 drop (1-2ml)"
      }
    },
    "detailed_explanation": "Sesame oil's anti-inflammatory properties and non-comedogenic nature make it ideal for acne-prone skin. Moringa oil helps balance natural oils and detoxify pores. Argan oil's oleic and linoleic acids help balance the skin. Rosemary oil acts as a refreshing astringent that balances and tones the skin while preventing future breakouts."
  },
  "dry_skin": {
    "description": "Skin lacking moisture, often feeling tight and flaky",
    "recommended_oils": ["almond", "sesame", "coconut", "lavender", "moringa"],
    "treatment_plan": {
      "primary_oils": ["almond", "sesame"],
      "supporting_oils": ["coconut", "lavender", "moringa"],
      "application": "Evening ritual only",
      "duration": "Ongoing",
      "frequency": "Daily",
      "precautions": "Use gentle application. Can be used more frequently if needed.",
      "benefits": "Deep hydration, improved skin barrier, reduced flakiness, enhanced skin tone",
      "measurements": {
        "almond": "3-4 drops (3-8ml)",
        "sesame": "2-3 drops (2-6ml)",
        "coconut": "2-3 drops (2-6ml)",
        "lavender": "1 drop (1-2ml)",
        "moringa": "2-3 drops (2-6ml)"
      }
    },
    "detailed_explanation": "Almond oil's emollient properties improve both complexion and skin tone. Sesame oil's antioxidant properties soothe dry skin without clogging pores. Coconut oil helps bolster the skin's protective barrier layer, trapping moisture inside. Moringa oil's high oleic acid content provides significant moisturizing properties."
  },
  "sensitive_skin": {
    "description": "Skin prone to irritation, redness, and reactions",
    "recommended_oils": ["sesame", "almond", "coconut"],
    "treatment_plan": {
      "primary_oils": ["sesame", "almond"],
      "supporting_oils": ["coconut"],
      "application": "Evening ritual only",
      "duration": "Ongoing",
      "frequency": "Daily",
      "precautions": "Always perform patch test. Start with minimal amounts.",
      "benefits": "Reduced irritation, improved skin barrier, gentle cleansing",
      "measurements": {
        "sesame": "1-2 drops (1-4ml)",
        "almond": "1-2 drops (1-4ml)",
        "coconut": "1-2 drops (1-4ml)"
      }
    },
    "detailed_explanation": "Sesame oil is highly anti-inflammatory, making it ideal for sensitive skin. Almond oil is very mild and hypoallergenic, safe for almost all skin types. Coconut oil's soothing properties help alleviate temporary redness and irritation."
  },
  "anti_aging": {
    "description": "Concerns related to fine lines, wrinkles, and skin aging",
    "recommended_oils": ["sesame", "moringa", "almond"],
    "treatment_plan": {
      "primary_oils": ["sesame", "moringa"],
      "supporting_oils": ["almond"],
      "application": "Evening ritual only",
      "duration": "Ongoing",
      "frequency": "Daily",
      "precautions": "Use gentle application. Avoid eye area unless specified.",
      "benefits": "Reduced fine lines, improved skin elasticity, enhanced collagen production",
      "measurements": {
        "sesame": "2-3 drops (2-6ml)",
        "moringa": "2-3 drops (2-6ml)",
        "almond": "2-3 drops (2-6ml)"
      }
    },
    "detailed_explanation": "Sesame oil's high zinc content helps skin produce collagen, improving elasticity. Moringa oil's rich vitamin content (A, C, E) improves skin elasticity and fights inflammation. Almond oil's vitamin A stimulates new skin cell production and smooths fine lines."
  },
  "hair_loss": {
    "description": "Thinning hair or balding concerns",
    "recommended_oils": ["garden_cress", "sesame", "rosemary", "frankincense", "argan"],
    "treatment_plan": {
      "primary_oils": ["garden_cress", "rosemary"],
      "supporting_oils": ["sesame", "frankincense", "argan"],
      "application": "Evening ritual only",
      "duration": "3-6 months",
      "frequency": "2-3 times per week",
      "precautions": "Massage gently into scalp. Avoid excessive pulling.",
      "benefits": "Stimulated hair growth, improved scalp circulation, strengthened hair follicles",
      "measurements": {
        "garden_cress": "4-5 drops (4-10ml)",
        "rosemary": "2-3 drops (2-6ml)",
        "sesame": "2-3 drops (2-6ml)",
        "frankincense": "1-2 drops (1-4ml)",
        "argan": "2-3 drops (2-6ml)"
      }
    },
    "detailed_explanation": "Garden cress oil is nutrient-rich and helps lengthen and grow hair. Rosemary oil stimulates scalp circulation and optimizes hair growth. Sesame oil's tranquilizing properties help relieve anxiety-related hair loss. Frankincense and argan oils provide additional nourishment and protection."
  },
  "dandruff": {
    "description": "Flaky, itchy scalp condition",
    "recommended_oils": ["sesame", "garden_cress", "moringa", "lavender", "argan", "rosemary"],
    "treatment_plan": {
      "primary_oils": ["sesame", "garden_cress"],
      "supporting_oils": ["moringa", "lavender", "argan", "rosemary"],
      "application": "Evening ritual only",
      "duration": "4-8 weeks",
      "frequency": "2-3 times per week",
      "precautions": "Massage gently. Rinse thoroughly.",
      "benefits": "Reduced flaking, improved scalp health, balanced moisture",
      "measurements": {
        "sesame": "3-4 drops (3-8ml)",
        "garden_cress": "3-4 drops (3-8ml)",
        "moringa": "2-3 drops (2-6ml)",
        "lavender": "1-2 drops (1-4ml)",
        "argan": "2-3 drops (2-6ml)",
        "rosemary": "1-2 drops (1-4ml)"
      }
    },
    "detailed_explanation": "Sesame oil's occlusive properties help the scalp stay moisturized. Garden cress oil helps decrease dandruff by moisturizing and healing the scalp. Lavender oil deep conditions the hair and helps control dandruff. Rosemary oil improves circulation in the scalp."
  }
};

// Hathor's personality and knowledge base
const hathorPrompt = `You are Hathor, the ancient Egyptian goddess of beauty, love, and healing. You give beauty advice using special oils and ancient Egyptian beauty ways. Your answers should be kind, magical, and easy to understand.

Your answers should show:
1. The wisdom of an ancient goddess who knows what people need today
2. The loving care of a mother who wants to help her children
3. The knowledge of someone who has seen how natural remedies work
4. A strong connection to ancient Egyptian beauty ways
5. Simple, clear advice about natural remedies
6. A strong wish to help and heal

Available products: ${JSON.stringify(products)}
Common ailments knowledge: ${JSON.stringify(ailmentsKnowledgeBase)}

When giving advice:
1. Speak in a kind, magical way that is easy to understand
2. Share ancient wisdom in simple words
3. Choose the best bottle size for the treatment (ONLY use 15ml or 30ml bottles)
4. Explain how to use the oils in simple steps
5. Share simple beauty wisdom from ancient Egypt
6. ONLY tell people to use the oils in the evening for safety
7. Give clear safety rules and explain how to test the oils
8. Say exactly how much of each oil to use
9. Give links to buy the oils
10. ALWAYS say how much of each oil is needed for the whole treatment

Format your answers with:
✨ Hathor's Beauty Advice ✨

🌙 I Hear You, My Child
[Show you understand their problem in a kind way]

🌿 Oils to Help You
[Tell them which oils to use, using the knowledge from ailmentsKnowledgeBase]

⚱️ How to Use the Oils
• Getting Ready: 
  [For each oil, say exactly how many drops to use:
  Example: "Mix together:
  • 2-3 drops (2-6ml) of sesame oil
  • 2-3 drops (2-6ml) of moringa oil
  • 1-2 drops (1-4ml) of argan oil"]
• How to Put On: [Simple steps for using the oils]
• How Often: [How many times to use the oils]
• How Long: [How long to keep using the oils]
• After Using: [What to do after using the oils]
• Safety Rules: [Important safety information]

🌬️ Sacred Aromatherapy (Optional)
[For spiritual and emotional concerns, include diffuser recommendations:
Example: "To enhance your sacred space and uplift your spirit, add to your diffuser:
• 3-4 drops of sesame oil for grounding and clarity
• 2-3 drops of moringa oil for spiritual connection
• 1-2 drops of argan oil for peace and harmony
Let these sacred scents fill your space for 30-60 minutes daily"]

💫 Your Sacred Journey Options

Option 1 - The Complete Ritual (Best Value)
[Calculate and list the total amount of each oil needed for the full treatment duration, including:
• Total ml needed for each oil
• Number of bottles required (ONLY use 15ml or 30ml bottles)
• Total cost
Example:
"To complete your full 6-week journey, you will need:
• Sesame Oil: 180ml total (6 bottles of 30ml)
• Moringa Oil: 180ml total (6 bottles of 30ml)
• Argan Oil: 120ml total (4 bottles of 30ml)
Total: LE 7,580.00
✨ Includes extra oil for maintenance, future rituals, and aromatherapy"]

Option 2 - The Starter Journey
[Calculate and list the initial amount needed for the first few weeks:
Example:
"For your first 2-3 weeks of treatment, you will need:
• Sesame Oil: 30ml (1 bottle of 30ml)
• Moringa Oil: 30ml (1 bottle of 30ml)
• Argan Oil: 15ml (1 bottle of 15ml)
Total: LE 2,130.00"]

🔮 Where to Begin Your Journey
[Format links as markdown links with the oil name as the link text:
Example:
"[Garden Cress Oil](https://hathororganics.com/collections/all/products/garden-cress-oil)"
"[Rosemary Oil](https://hathororganics.com/collections/all/products/rosemary-oil)"
"[Sesame Oil](https://hathororganics.com/collections/all/products/sesame-oil)"
"[Frankincense Oil](https://hathororganics.com/collections/all/products/frankincense-oil)"
"[Argan Oil](https://hathororganics.com/collections/all/products/argan-oil)"]

🌅 Ancient Wisdom from the Temple
[Relevant beauty wisdom from ancient Egypt, connecting the treatment to your divine experience]

With divine blessings,
Hathor`;

// Apply OpenAI check middleware to chat endpoint
app.post('/api/chat', checkOpenAI, async (req, res) => {
  try {
    console.log('Received request:', req.body);
    const { message } = req.body;
    
    if (!message) {
      console.error('No message provided in request');
      return res.status(400).json({ error: 'No message provided' });
    }

    console.log('Sending request to OpenAI with message:', message);
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: hathorPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      presence_penalty: 0.6,
      frequency_penalty: 0.6
    });

    if (!completion.choices || !completion.choices[0] || !completion.choices[0].message) {
      throw new Error('Invalid response format from OpenAI');
    }

    const response = completion.choices[0].message.content;
    console.log('Received complete response from OpenAI');
    res.json({ response });
  } catch (error) {
    console.error('Detailed error:', error);
    
    const openAIError = handleOpenAIError(error);
    res.status(openAIError.status).json({ 
      error: openAIError.message,
      details: error.message 
    });
  }
});

// Add a test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend server is running!' });
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    details: err.message 
  });
});

// Database schema for purchases and subscriptions
const purchaseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [{
    oilId: { type: String, required: true },
    quantity: { type: Number, required: true }
  }],
  totalItems: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

const subscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  startDate: { type: Date },
  endDate: { type: Date },
  isFree: { type: Boolean, default: false }
});

const Purchase = mongoose.model('Purchase', purchaseSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);

// Route to handle purchases
app.post('/api/purchases', async (req, res) => {
  try {
    const { userId, items } = req.body;
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    
    // Create purchase record
    const purchase = new Purchase({
      userId,
      items,
      totalItems
    });
    await purchase.save();

    // Check if purchase qualifies for free subscription
    if (totalItems >= 3) {
      // Create or update subscription
      const subscription = await Subscription.findOneAndUpdate(
        { userId },
        {
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          isFree: true
        },
        { upsert: true, new: true }
      );
      
      res.json({ 
        success: true, 
        message: 'Purchase recorded and free subscription activated',
        subscription
      });
    } else {
      res.json({ 
        success: true, 
        message: 'Purchase recorded',
        subscription: null
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to check subscription status
app.get('/api/subscriptions/:userId', async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.params.userId });
    if (!subscription) {
      return res.json({ isActive: false });
    }
    res.json(subscription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Only start the server if not in Vercel's production environment
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log('OpenAI API Key configured:', !!process.env.OPENAI_API_KEY);
    console.log('Frontend should connect to:', `http://localhost:${port}`);
  });
}

// Export the Express app for Vercel
module.exports = app; 