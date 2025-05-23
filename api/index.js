console.log('--- Loading server.js module ---');
console.log('Server environment:', process.env.NODE_ENV);
console.log('Current working directory:', process.cwd());
console.log('File directory:', __dirname);
console.log('Available environment variables:', Object.keys(process.env).filter(key => !key.includes('KEY') && !key.includes('SECRET')).join(', '));

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const mongoose = require('mongoose');
const morgan = require('morgan');
const winston = require('winston');
const expressWinston = require('express-winston');
const { format } = require('winston');

// Configure MongoDB connection with proper error handling
const connectToDatabase = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      logger.warn('MONGODB_URI environment variable not set, database functionality will be unavailable');
      return false;
    }
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info('MongoDB connected successfully');
    return true;
  } catch (error) {
    logger.error('MongoDB connection error:', { 
      error: error.message,
      stack: error.stack
    });
    return false;
  }
};

// Flag to track if database is connected
let isDatabaseConnected = false;

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'hathor-app' },
  transports: [
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(metadata).length > 0 && metadata.service === 'hathor-app') {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      )
    })
  ]
});

const app = express();
const port = process.env.PORT || 5003;

// Request logging with express-winston (before route handlers)
app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}}",
  expressFormat: true,
  colorize: true,
  ignoreRoute: function (req, res) { return false; }
}));

// Use Morgan for request logging
app.use(morgan('dev'));

// Initialize OpenAI with better error handling
const initializeOpenAI = () => {
  // Check various potential naming conventions used by Vercel
  const apiKey = process.env.OPENAI_API_KEY || 
                process.env.OPENAI_KEY || 
                process.env.VERCEL_OPENAI_API_KEY;
  
  // Log environment information for debugging
  logger.info('OpenAI initialization - Environment Info:', {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyStart: apiKey ? `${apiKey.substring(0, 3)}...` : 'not set'
  });
  
  if (!apiKey) {
    logger.error('OpenAI API key is not configured. Checked OPENAI_API_KEY, OPENAI_KEY, and VERCEL_OPENAI_API_KEY');
    return null;
  }
  
  logger.info('OpenAI client initialized successfully');
  return new OpenAI({ apiKey });
};

const openai = initializeOpenAI();

// Add middleware to check OpenAI initialization
const checkOpenAI = (req, res, next) => {
  if (!openai) {
    logger.error('OpenAI middleware check failed - API not configured');
    return res.status(500).json({
      error: 'OpenAI is not properly configured',
      message: 'Please check the API key configuration'
    });
  }
  logger.debug('OpenAI middleware check passed');
  next();
};

// Helper function to handle OpenAI errors
const handleOpenAIError = (error) => {
  logger.error('OpenAI API Error:', { 
    code: error.code, 
    type: error.type, 
    status: error.status,
    message: error.message,
    stack: error.stack
  });
  
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

// Modified chat endpoint with fallback
app.post('/api/chat', async (req, res) => {
  try {
    logger.info('Received chat request', { 
      hasMessage: !!req.body.message,
      messageLength: req.body.message ? req.body.message.length : 0
    });
    
    const { message } = req.body;
    
    if (!message) {
      logger.warn('No message provided in request');
      return res.status(400).json({ 
        error: 'No message provided',
        success: false 
      });
    }

    // Check if OpenAI is initialized
    if (!openai) {
      logger.warn('OpenAI not initialized, using fallback response');
      return res.json({
        response: "✨ Hathor's Beauty Advice ✨\n\n🌙 I Hear You, My Child\nI understand your concern. However, I'm currently unable to provide personalized advice as my connection to the wisdom realm is temporarily disrupted.\n\n🌿 Please Try Again Later\nPlease try again later when my connection to the realm of beauty wisdom is restored. In the meantime, you can explore our collection of healing oils at https://hathororganics.com/collections/all\n\nWith divine blessings,\nHathor",
        success: true,
        fallback: true
      });
    }

    logger.info('Sending request to OpenAI API', { messagePreview: message.substring(0, 50) + '...' });
    
    try {
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
        logger.error('Invalid response format from OpenAI');
        
        // Fallback response when OpenAI returns invalid format
        return res.json({
          response: "✨ Hathor's Beauty Advice ✨\n\n🌙 I Hear You, My Child\nI understand your concern. However, I'm currently unable to provide personalized advice as my connection to the wisdom realm is temporarily disrupted.\n\n🌿 Please Try Again Later\nPlease try again later when my connection to the realm of beauty wisdom is restored. In the meantime, you can explore our collection of healing oils at https://hathororganics.com/collections/all\n\nWith divine blessings,\nHathor",
          success: true,
          fallback: true
        });
      }

      const response = completion.choices[0].message.content;
      logger.info('Received complete response from OpenAI', { responseLength: response.length });
      res.json({ response, success: true });
    } catch (openaiError) {
      // Detailed OpenAI error handling with fallback
      logger.error('OpenAI API call failed:', { 
        error: openaiError.message, 
        type: openaiError.type,
        status: openaiError.status,
        code: openaiError.code
      });
      
      // Return fallback response instead of error
      res.json({
        response: "✨ Hathor's Beauty Advice ✨\n\n🌙 I Hear You, My Child\nI understand your concern. However, I'm currently unable to provide personalized advice as my connection to the wisdom realm is temporarily disrupted.\n\n🌿 Please Try Again Later\nPlease try again later when my connection to the realm of beauty wisdom is restored. In the meantime, you can explore our collection of healing oils at https://hathororganics.com/collections/all\n\nWith divine blessings,\nHathor",
        success: true,
        fallback: true,
        error: {
          code: openaiError.code,
          type: openaiError.type,
          message: openaiError.message
        }
      });
    }
  } catch (error) {
    logger.error('Unexpected error in chat endpoint:', { 
      message: error.message,
      stack: error.stack
    });
    
    // Return fallback response instead of error status
    res.json({ 
      response: "✨ Hathor's Beauty Advice ✨\n\n🌙 I Hear You, My Child\nI understand your concern. However, I'm currently unable to provide personalized advice as my connection to the wisdom realm is temporarily disrupted.\n\n🌿 Please Try Again Later\nPlease try again later when my connection to the realm of beauty wisdom is restored. In the meantime, you can explore our collection of healing oils at https://hathororganics.com/collections/all\n\nWith divine blessings,\nHathor",
      success: true,
      fallback: true
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
    if (!isDatabaseConnected) {
      return res.status(503).json({ 
        error: 'Database service unavailable',
        message: 'The database connection is not established. Please try again later.'
      });
    }
    
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
    logger.error('Error in purchases endpoint:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: error.message });
  }
});

// Route to check subscription status
app.get('/api/subscriptions/:userId', async (req, res) => {
  try {
    if (!isDatabaseConnected) {
      return res.status(503).json({ 
        error: 'Database service unavailable',
        message: 'The database connection is not established. Please try again later.',
        isActive: false
      });
    }
    
    const subscription = await Subscription.findOne({ userId: req.params.userId });
    if (!subscription) {
      return res.json({ isActive: false });
    }
    res.json(subscription);
  } catch (error) {
    logger.error('Error in subscriptions endpoint:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: error.message });
  }
});

// OpenAI API key check endpoint
app.get('/api/check-openai-key', (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY || 
                process.env.OPENAI_KEY || 
                process.env.VERCEL_OPENAI_API_KEY;
  
  const keyStatus = {
    hasKey: !!apiKey,
    keyLength: apiKey ? apiKey.length : 0,
    keyStart: apiKey ? `${apiKey.substring(0, 3)}...` : 'not set',
    keyEnd: apiKey ? `...${apiKey.substring(apiKey.length - 4)}` : 'not set',
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV
    },
    openaiInitialized: !!openai
  };
  
  logger.info('API key check requested', keyStatus);
  res.json(keyStatus);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Add a simple diagnostic endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    env: process.env.NODE_ENV,
    cwd: process.cwd(),
    dirname: __dirname,
    headers: req.headers,
    envKeys: Object.keys(process.env).filter(key => !key.includes('KEY') && !key.includes('SECRET')),
    serverTime: new Date().toISOString()
  });
});

// Debug endpoint for Vercel
app.get('/api/vercel-debug', (req, res) => {
  // Gather system information
  const systemInfo = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_REGION: process.env.VERCEL_REGION,
      VERCEL_URL: process.env.VERCEL_URL
    },
    cwd: process.cwd(),
    dirname: __dirname,
    databaseConnected: isDatabaseConnected,
    mongoDbUri: process.env.MONGODB_URI ? `${process.env.MONGODB_URI.substring(0, 10)}...` : 'not set'
  };
  
  // Gather registered routes
  const registeredRoutes = [];
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      // Routes registered directly on the app
      registeredRoutes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods).filter(m => middleware.route.methods[m])
      });
    } else if (middleware.name === 'router') {
      // Routes registered on a router
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          registeredRoutes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods).filter(m => handler.route.methods[m])
          });
        }
      });
    }
  });
  
  res.json({
    status: 'ok',
    message: 'Debug information for Vercel deployment',
    systemInfo,
    registeredRoutes,
    openaiStatus: {
      initialized: !!openai,
      apiKeyConfigured: !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.VERCEL_OPENAI_API_KEY)
    }
  });
});

// Add a catch-all 404 handler (must be placed after all other routes and before error handlers)
app.use((req, res, next) => {
  logger.warn('404 Not Found:', {
    path: req.path,
    method: req.method,
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'x-vercel-id': req.headers['x-vercel-id'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'x-real-ip': req.headers['x-real-ip']
    }
  });
  
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    availableRoutes: app._router.stack
      .filter(r => r.route)
      .map(r => ({
        path: r.route.path,
        methods: Object.keys(r.route.methods).filter(m => r.route.methods[m])
      })),
    timestamp: new Date().toISOString()
  });
});

// Error logging with express-winston (after route handlers, before error handlers)
app.use(expressWinston.errorLogger({
  winstonInstance: logger,
  msg: "{{err.message}}",
  meta: true
}));

// Custom error handling middleware - with Winston logging
app.use((err, req, res, next) => {
  logger.error('Global error handler caught:', { 
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body ? JSON.stringify(req.body).substring(0, 200) : null,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'x-vercel-id': req.headers['x-vercel-id']
    }
  });
  
  res.status(500).json({
    error: 'Server error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    path: req.path,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || req.headers['x-vercel-id'] || 'unknown'
  });
});

// Initialize app for serverless environment
(async () => {
  try {
    // Initialize database connection
    isDatabaseConnected = await connectToDatabase();
    
    logger.info('Server initialization complete', {
      environment: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      databaseConnected: isDatabaseConnected,
      openaiInitialized: !!openai
    });
    
    // Only start the server if not in production (local development)
    if (process.env.NODE_ENV !== 'production') {
      app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
        console.log('OpenAI API Key configured:', !!process.env.OPENAI_API_KEY);
        console.log('Database connected:', isDatabaseConnected);
        console.log('Frontend should connect to:', `http://localhost:${port}`);
      });
    }
  } catch (error) {
    logger.error('Server initialization error:', {
      message: error.message,
      stack: error.stack
    });
    
    // Don't throw the error in production (serverless) to allow the function to start anyway
    if (process.env.NODE_ENV !== 'production') {
      throw error;
    }
  }
})();

// Export the Express app for Vercel
module.exports = app; 