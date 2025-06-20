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
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

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
// Last updated: [current timestamp] to force Vercel deployment refresh
const products = {
  oils: [
    // Carrier Oils
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
          price: "LE 500.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/moringa-oil"
        },
        {
          size: "30ml",
          price: "LE 1,000.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/moringa-oil"
        }
      ]
    },
    {
      name: "Coconut Oil",
      benefits: ["moisturizing", "hair conditioning", "antibacterial", "skin healing", "makeup removal"],
      description: "Pure cold-pressed coconut oil for skin and hair care",
      properties: {
        moisturizing: true,
        antibacterial: true,
        hairConditioning: true,
        skinHealing: true
      },
      recommendedUses: ["body oil", "hair treatment", "makeup remover", "cooking"],
      sizes: [
        {
          size: "15ml",
          price: "LE 200.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/coconut-oil"
        },
        {
          size: "30ml",
          price: "LE 400.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/coconut-oil"
        }
      ]
    },
    {
      name: "Sweet Almond Oil",
      benefits: ["moisturizing", "skin softening", "anti-inflammatory", "skin healing", "hair conditioning"],
      description: "Pure cold-pressed sweet almond oil for skin and hair care",
      properties: {
        moisturizing: true,
        antiInflammatory: true,
        skinHealing: true,
        hairConditioning: true
      },
      recommendedUses: ["facial oil", "body oil", "hair treatment", "massage oil"],
      sizes: [
        {
          size: "15ml",
          price: "LE 400.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/sweet-almond-oil"
        },
        {
          size: "30ml",
          price: "LE 800.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/sweet-almond-oil"
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
          price: "LE 300.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/sesame-oil"
        },
        {
          size: "30ml",
          price: "LE 600.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/sesame-oil"
        }
      ]
    },
    {
      name: "Argan Oil",
      benefits: ["hair conditioning", "skin moisturizing", "anti-aging", "nail health"],
      description: "Pure cold-pressed argan oil for hair, skin, and nails",
      properties: {
        hairConditioning: true,
        moisturizing: true,
        antiAging: true,
        nailHealth: true
      },
      recommendedUses: ["hair treatment", "facial oil", "body oil", "nail care"],
      sizes: [
        {
          size: "15ml",
          price: "LE 480.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/argan-oil"
        },
        {
          size: "30ml",
          price: "LE 960.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/argan-oil"
        }
      ]
    },
    {
      name: "Cellulite Oil Mix",
      benefits: ["cellulite reduction", "skin tightening", "circulation improvement", "body contouring"],
      description: "Specialized oil blend for cellulite reduction and skin tightening",
      properties: {
        circulationImproving: true,
        skinTightening: true,
        bodyContouring: true,
        antiInflammatory: true
      },
      recommendedUses: ["body massage", "cellulite treatment", "skin firming"],
      sizes: [
        {
          size: "15ml",
          price: "LE 360.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/cellulite-oil-mix"
        },
        {
          size: "30ml",
          price: "LE 720.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/cellulite-oil-mix"
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
          price: "LE 300.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/garden-cress-oil"
        },
        {
          size: "30ml",
          price: "LE 600.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/garden-cress-oil"
        }
      ]
    },
    {
      name: "Black Seed Oil",
      benefits: ["immune support", "anti-inflammatory", "skin healing", "hair growth", "respiratory health"],
      description: "Pure black seed oil with powerful healing properties",
      properties: {
        antiInflammatory: true,
        immuneSupport: true,
        skinHealing: true,
        hairGrowth: true
      },
      recommendedUses: ["health supplement", "skin treatment", "hair treatment"],
      sizes: [
        {
          size: "15ml",
          price: "LE 500.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/black-seed-oil"
        },
        {
          size: "30ml",
          price: "LE 1,000.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/black-seed-oil"
        }
      ]
    },
    {
      name: "Virgin Olive Oil",
      benefits: ["moisturizing", "anti-aging", "skin healing", "hair conditioning"],
      description: "Pure virgin olive oil for skin and hair care",
      properties: {
        moisturizing: true,
        antiAging: true,
        skinHealing: true,
        hairConditioning: true
      },
      recommendedUses: ["facial oil", "body oil", "hair treatment"],
      sizes: [
        {
          size: "15ml",
          price: "LE 240.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/virgin-olive-oil",
          soldOut: true
        },
        {
          size: "30ml",
          price: "LE 480.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/virgin-olive-oil",
          soldOut: true
        }
      ]
    },
    // Essential Oils
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
          price: "LE 380.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/rosemary-oil"
        },
        {
          size: "30ml",
          price: "LE 760.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/rosemary-oil"
        }
      ]
    },
    {
      name: "Frankincense Oil",
      benefits: ["anti-aging", "skin regeneration", "stress relief", "meditation support"],
      description: "Pure frankincense oil for spiritual and skin wellness",
      properties: {
        antiAging: true,
        skinRegeneration: true,
        stressRelief: true,
        meditationSupport: true
      },
      recommendedUses: ["facial treatment", "aromatherapy", "meditation"],
      sizes: [
        {
          size: "15ml",
          price: "LE 1,000.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/frankincense-oil"
        },
        {
          size: "30ml",
          price: "LE 2,000.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/frankincense-oil"
        }
      ]
    },
    {
      name: "Lavender Oil",
      benefits: ["relaxation", "skin healing", "acne treatment", "sleep support"],
      description: "Pure lavender oil for aromatherapy and skin care",
      properties: {
        relaxing: true,
        skinHealing: true,
        antibacterial: true,
        sleepSupport: true
      },
      recommendedUses: ["aromatherapy", "skin treatment", "sleep aid"],
      sizes: [
        {
          size: "15ml",
          price: "LE 450.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/lavender-oil"
        },
        {
          size: "30ml",
          price: "LE 900.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/lavender-oil"
        }
      ]
    },
    {
      name: "Rose Oil",
      benefits: ["skin rejuvenation", "emotional balance", "anti-aging", "mood enhancement"],
      description: "Pure rose oil for skin and emotional wellness",
      properties: {
        skinRejuvenation: true,
        emotionalBalance: true,
        antiAging: true,
        moodEnhancing: true
      },
      recommendedUses: ["facial treatment", "aromatherapy", "mood enhancement"],
      sizes: [
        {
          size: "15ml",
          price: "LE 750.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/rose-oil"
        },
        {
          size: "30ml",
          price: "LE 1,500.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/rose-oil"
        }
      ]
    },
    {
      name: "Cinnamon Oil",
      benefits: ["circulation improvement", "warming", "antimicrobial", "digestive support"],
      description: "Pure cinnamon oil with warming and antimicrobial properties",
      properties: {
        circulationImproving: true,
        warming: true,
        antimicrobial: true,
        digestiveSupport: true
      },
      recommendedUses: ["aromatherapy", "massage oil", "digestive support"],
      sizes: [
        {
          size: "15ml",
          price: "LE 700.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/cinnamon-oil",
          soldOut: true
        },
        {
          size: "30ml",
          price: "LE 1,400.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/cinnamon-oil",
          soldOut: true
        }
      ]
    },
    {
      name: "Jasmine Oil",
      benefits: ["mood enhancement", "skin healing", "anti-aging", "stress relief"],
      description: "Pure jasmine oil for emotional and skin wellness",
      properties: {
        moodEnhancing: true,
        skinHealing: true,
        antiAging: true,
        stressRelief: true
      },
      recommendedUses: ["aromatherapy", "skin treatment", "mood enhancement"],
      sizes: [
        {
          size: "15ml",
          price: "LE 1,800.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/jasmine-oil",
          soldOut: true
        },
        {
          size: "30ml",
          price: "LE 3,600.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/jasmine-oil",
          soldOut: true
        }
      ]
    },
    {
      name: "Tea Tree Oil",
      benefits: ["acne treatment", "antifungal", "antibacterial", "scalp health"],
      description: "Pure tea tree oil for skin and scalp care",
      properties: {
        antibacterial: true,
        antifungal: true,
        scalpHealth: true,
        acneTreatment: true
      },
      recommendedUses: ["skin treatment", "scalp treatment", "acne treatment"],
      sizes: [
        {
          size: "15ml",
          price: "LE 650.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/tea-tree-oil"
        },
        {
          size: "30ml",
          price: "LE 1,300.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/tea-tree-oil"
        }
      ]
    },
    {
      name: "Peppermint Oil",
      benefits: ["pain relief", "energy boosting", "cooling", "digestive support"],
      description: "Pure peppermint oil for pain relief and invigoration",
      properties: {
        painRelief: true,
        energizing: true,
        cooling: true,
        digestiveSupport: true
      },
      recommendedUses: ["pain relief", "aromatherapy", "digestive support"],
      sizes: [
        {
          size: "15ml",
          price: "LE 350.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/peppermint-oil"
        },
        {
          size: "30ml",
          price: "LE 700.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/peppermint-oil"
        }
      ]
    },
    {
      name: "Clove Oil",
      benefits: ["pain relief", "antimicrobial", "dental health", "circulation improvement"],
      description: "Pure clove oil with powerful antimicrobial properties",
      properties: {
        painRelief: true,
        antimicrobial: true,
        dentalHealth: true,
        circulationImproving: true
      },
      recommendedUses: ["dental care", "pain relief", "aromatherapy"],
      sizes: [
        {
          size: "15ml",
          price: "LE 700.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/clove-oil"
        },
        {
          size: "30ml",
          price: "LE 1,400.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/clove-oil"
        }
      ]
    },
    // Special Oils
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
          price: "LE 1,200.00",
          dropsPerBottle: 900,
          link: "https://hathororganics.com/products/acne-set"
        }
      ]
    },
    {
      name: "Queen Tiye Hair Oil",
      benefits: ["hair growth", "scalp health", "hair strengthening", "ancient Egyptian formula"],
      description: "Special hair oil following an ancient Egyptian recipe for Queen Tiye",
      properties: {
        hairGrowth: true,
        scalpHealth: true,
        strengthening: true,
        ancientFormula: true
      },
      recommendedUses: ["hair treatment", "scalp massage", "hair growth"],
      sizes: [
        {
          size: "15ml",
          price: "LE 240.00",
          dropsPerBottle: 300,
          link: "https://hathororganics.com/products/queen-tiye-hair-oil",
          soldOut: true
        },
        {
          size: "30ml",
          price: "LE 480.00",
          dropsPerBottle: 600,
          link: "https://hathororganics.com/products/queen-tiye-hair-oil",
          soldOut: true
        }
      ]
    }
  ]
};

// Common ailments and their treatments
const ailmentsKnowledgeBase = {
  "acne": {
    "description": "A common skin condition characterized by pimples, blackheads, and inflammation",
    "recommended_oils": ["Sesame Oil", "Moringa Oil", "Argan Oil", "Lavender Essential Oil", "Rosemary Oil", "Tea Tree Essential Oil"],
    "treatment_plan": {
      "primary_oils": ["Sesame Oil", "Moringa Oil", "Tea Tree Essential Oil"],
      "supporting_oils": ["Argan Oil", "Lavender Essential Oil", "Rosemary Oil"],
      "application": "Evening ritual only",
      "duration": "4-6 weeks",
      "frequency": "Daily",
      "precautions": "Always dilute essential oils with carrier oils. Perform patch test before full application.",
      "benefits": "Purifies skin, regulates sebum production, reduces inflammation, prevents future breakouts",
      "measurements": {
        "Sesame Oil": "2-3 drops (2-6ml)",
        "Moringa Oil": "2-3 drops (2-6ml)",
        "Tea Tree Essential Oil": "1-2 drops (1-4ml) diluted",
        "Argan Oil": "1-2 drops (1-4ml)",
        "Lavender Essential Oil": "1 drop (1-2ml)",
        "Rosemary Oil": "1 drop (1-2ml)"
      }
    },
    "detailed_explanation": "Sesame oil's anti-inflammatory properties and non-comedogenic nature make it ideal for acne-prone skin. Moringa oil helps balance natural oils and detoxify pores. Tea Tree Essential Oil has antibacterial properties that help treat acne. Argan oil's oleic and linoleic acids help balance the skin. Lavender and Rosemary oils act as refreshing astringents that balance and tone the skin while preventing future breakouts."
  },
  "dry_skin": {
    "description": "Skin lacking moisture, often feeling tight and flaky",
    "recommended_oils": ["Sweet Almond Oil"],
    "treatment_plan": {
      "primary_oils": ["Sweet Almond Oil"],
      "supporting_oils": [],
      "application": "Evening ritual only",
      "duration": "Ongoing",
      "frequency": "Daily",
      "precautions": "Use gentle application. Can be used more frequently if needed.",
      "benefits": "Deep hydration, improved skin barrier, reduced flakiness, enhanced skin tone",
      "measurements": {
        "Sweet Almond Oil": "Apply a small amount to face and body after bathing (e.g., 3-4 drops for face)"
      }
    },
    "detailed_explanation": "Sweet Almond Oil was used in ancient Egypt to moisturize and protect skin from arid conditions. Its emollient properties improve complexion and skin tone."
  },
  "sensitive_skin": {
    "description": "Skin prone to irritation, redness, and reactions",
    "recommended_oils": ["Sesame Oil", "Sweet Almond Oil", "Jojoba Oil"],
    "treatment_plan": {
      "primary_oils": ["Sesame Oil", "Sweet Almond Oil"],
      "supporting_oils": ["Jojoba Oil"],
      "application": "Evening ritual only",
      "duration": "Ongoing",
      "frequency": "Daily",
      "precautions": "Always perform patch test. Start with minimal amounts.",
      "benefits": "Reduced irritation, improved skin barrier, gentle cleansing",
      "measurements": {
        "Sesame Oil": "1-2 drops (1-4ml)",
        "Sweet Almond Oil": "1-2 drops (1-4ml)",
        "Jojoba Oil": "1-2 drops (1-4ml)"
      }
    },
    "detailed_explanation": "Sesame Oil is highly anti-inflammatory, making it ideal for sensitive skin. Sweet Almond Oil is very mild and hypoallergenic. Jojoba Oil mimics skin's natural sebum, providing hydration without irritation."
  },
  "aging_skin": {
    "description": "Concerns related to fine lines, wrinkles, and skin aging",
    "recommended_oils": ["Argan Oil", "Frankincense Essential Oil"],
    "treatment_plan": {
      "primary_oils": ["Argan Oil", "Frankincense Essential Oil"],
      "supporting_oils": [],
      "application": "Evening ritual only",
      "duration": "Ongoing",
      "frequency": "Daily",
      "precautions": "Use gentle application. Avoid eye area unless specified. Dilute essential oils with carrier oils.",
      "benefits": "Reduced fine lines, improved skin elasticity, enhanced collagen production",
      "measurements": {
        "Argan Oil": "2-3 drops to face and neck daily",
        "Frankincense Essential Oil": "2-3 drops diluted in 1 tsp Sweet Almond Oil, apply to face"
      }
    },
    "detailed_explanation": "Argan Oil is rich in vitamin E and antioxidants, making it excellent for anti-aging. Frankincense has anti-inflammatory and healing properties, supporting aging skin."
  },
  "sun_damage": {
    "description": "Skin damage caused by sun exposure, including sunburn, hyperpigmentation, and premature aging",
    "recommended_oils": ["Argan Oil"],
    "treatment_plan": {
      "primary_oils": ["Argan Oil"],
      "supporting_oils": [],
      "application": "Evening ritual only",
      "duration": "Ongoing",
      "frequency": "Daily",
      "precautions": "Apply after sun exposure. Use sunscreen during the day.",
      "benefits": "Heals sun-damaged skin, reduces hyperpigmentation, improves elasticity",
      "measurements": {
        "Argan Oil": "2-3 drops to affected areas daily"
      }
    },
    "detailed_explanation": "Argan Oil was historically used to heal sun-damaged skin due to its high content of vitamin E and antioxidants, which promote skin repair and regeneration."
  },
  "spots_on_face": {
    "description": "Dark spots or hyperpigmentation on the face",
    "recommended_oils": ["Sweet Almond Oil"],
    "treatment_plan": {
      "primary_oils": ["Sweet Almond Oil"],
      "supporting_oils": [],
      "application": "Evening ritual only",
      "duration": "4-6 weeks",
      "frequency": "2-3 times per week",
      "precautions": "Perform patch test. Avoid if allergic to honey.",
      "benefits": "Improves complexion, reduces dark spots",
      "measurements": {
        "Sweet Almond Oil": "1 tbsp mixed with 1 tbsp honey for a mask"
      }
    },
    "detailed_explanation": "Sweet Almond Oil, when combined with honey, creates a nourishing mask that helps even out skin tone and reduce dark spots, inspired by ancient Egyptian beauty rituals."
  },
  "general_moisturization": {
    "description": "General skin hydration and nourishment",
    "recommended_oils": ["Argan Oil", "Jojoba Oil"],
    "treatment_plan": {
      "primary_oils": ["Argan Oil", "Jojoba Oil"],
      "supporting_oils": [],
      "application": "Evening ritual only",
      "duration": "Ongoing",
      "frequency": "Daily",
      "precautions": "Use gentle application. Can be used more frequently if needed.",
      "benefits": "Hydrates and nourishes skin, improves skin barrier",
      "measurements": {
        "Argan Oil": "A few drops to face and body after cleansing",
        "Jojoba Oil": "A few drops to face and body after cleansing"
      }
    },
    "detailed_explanation": "Argan Oil and Jojoba Oil are excellent for general skin moisturization, providing deep hydration and nourishment without clogging pores."
  },
  "hair_loss": {
    "description": "Thinning hair or balding concerns",
    "recommended_oils": ["Garden Cress Oil", "Sesame Oil", "Rosemary Oil", "Frankincense Oil", "Argan Oil", "Black Seed Oil"],
    "treatment_plan": {
      "primary_oils": ["Garden Cress Oil", "Rosemary Oil", "Black Seed Oil"],
      "supporting_oils": ["Sesame Oil", "Frankincense Oil", "Argan Oil"],
      "application": "Evening ritual only",
      "duration": "3-6 months",
      "frequency": "2-3 times per week",
      "precautions": "Massage gently into scalp. Avoid excessive pulling.",
      "benefits": "Stimulated hair growth, improved scalp circulation, strengthened hair follicles",
      "measurements": {
        "Garden Cress Oil": "4-5 drops (4-10ml)",
        "Rosemary Oil": "2-3 drops (2-6ml)",
        "Black Seed Oil": "2-3 drops (2-6ml)",
        "Sesame Oil": "2-3 drops (2-6ml)",
        "Frankincense Oil": "1-2 drops (1-4ml)",
        "Argan Oil": "2-3 drops (2-6ml)"
      }
    },
    "detailed_explanation": "Garden Cress Oil is nutrient-rich and helps lengthen and grow hair. Rosemary Oil stimulates scalp circulation and optimizes hair growth. Black Seed Oil promotes healthy hair growth due to its nutrient content and strengthening properties. Sesame Oil's tranquilizing properties help relieve anxiety-related hair loss. Frankincense and Argan Oils provide additional nourishment and protection."
  },
  "dandruff": {
    "description": "Flaky, itchy scalp condition",
    "recommended_oils": ["Sesame Oil", "Garden Cress Oil", "Moringa Oil", "Lavender Essential Oil", "Argan Oil", "Rosemary Oil", "Tea Tree Essential Oil", "Jojoba Oil"],
    "treatment_plan": {
      "primary_oils": ["Sesame Oil", "Garden Cress Oil", "Tea Tree Essential Oil"],
      "supporting_oils": ["Moringa Oil", "Lavender Essential Oil", "Argan Oil", "Rosemary Oil", "Jojoba Oil"],
      "application": "Evening ritual only",
      "duration": "4-8 weeks",
      "frequency": "2-3 times per week",
      "precautions": "Massage gently. Rinse thoroughly.",
      "benefits": "Reduced flaking, improved scalp health, balanced moisture",
      "measurements": {
        "Sesame Oil": "3-4 drops (3-8ml)",
        "Garden Cress Oil": "3-4 drops (3-8ml)",
        "Tea Tree Essential Oil": "2-3 drops (2-6ml) diluted",
        "Moringa Oil": "2-3 drops (2-6ml)",
        "Lavender Essential Oil": "1-2 drops (1-4ml)",
        "Argan Oil": "2-3 drops (2-6ml)",
        "Rosemary Oil": "1-2 drops (1-4ml)",
        "Jojoba Oil": "1 tbsp for dilution"
      }
    },
    "detailed_explanation": "Sesame Oil's occlusive properties help the scalp stay moisturized. Garden Cress Oil helps decrease dandruff by moisturizing and healing the scalp. Tea Tree Essential Oil has antifungal properties that combat dandruff-causing fungi. Other oils like Moringa, Lavender, Argan, Rosemary, and Jojoba provide additional benefits for scalp health."
  },
  "dry_damaged_hair": {
    "description": "Hair that is dry, brittle, or damaged",
    "recommended_oils": ["Argan Oil", "Jojoba Oil"],
    "treatment_plan": {
      "primary_oils": ["Argan Oil", "Jojoba Oil"],
      "supporting_oils": [],
      "application": "Evening ritual only",
      "duration": "Ongoing",
      "frequency": "Weekly",
      "precautions": "Use as a hair treatment. Rinse out after application.",
      "benefits": "Restores moisture, repairs damage, adds shine",
      "measurements": {
        "Argan Oil": "Apply to hair and scalp post-wash, leave for 30 minutes, rinse",
        "Jojoba Oil": "Apply to hair and scalp post-wash, leave for 30 minutes, rinse"
      }
    },
    "detailed_explanation": "Argan Oil and Jojoba Oil are rich in fatty acids and vitamins that help restore moisture and repair damaged hair."
  },
  "hair_growth": {
    "description": "Promoting hair growth and strengthening hair",
    "recommended_oils": ["Garden Cress Oil"],
    "treatment_plan": {
      "primary_oils": ["Garden Cress Oil"],
      "supporting_oils": [],
      "application": "Evening ritual only",
      "duration": "3-6 months",
      "frequency": "1-2 times weekly",
      "precautions": "Massage into scalp. Leave overnight if possible.",
      "benefits": "Stimulates hair growth, strengthens hair follicles",
      "measurements": {
        "Garden Cress Oil": "Massage into scalp, leave overnight, wash out in the morning"
      }
    },
    "detailed_explanation": "Garden Cress Oil is nutrient-rich and specifically formulated to promote healthy hair growth and strengthen hair follicles."
  },
  "scalp_health": {
    "description": "Maintaining a healthy scalp, reducing itchiness or flakiness",
    "recommended_oils": ["Tea Tree Essential Oil", "Jojoba Oil"],
    "treatment_plan": {
      "primary_oils": ["Tea Tree Essential Oil", "Jojoba Oil"],
      "supporting_oils": [],
      "application": "Evening ritual only",
      "duration": "4-8 weeks",
      "frequency": "2-3 times per week",
      "precautions": "Dilute essential oils with carrier oils. Massage gently into scalp.",
      "benefits": "Reduces flakiness, soothes itchiness, improves scalp health",
      "measurements": {
        "Tea Tree Essential Oil": "2-3 drops diluted in 1 tbsp Jojoba Oil",
        "Jojoba Oil": "1 tbsp"
      }
    },
    "detailed_explanation": "Tea Tree Essential Oil has antifungal properties that help with dandruff and scalp irritations, while Jojoba Oil moisturizes and balances the scalp."
  },
  "general_body_care": {
    "description": "General body hydration and nourishment",
    "recommended_oils": ["Sweet Almond Oil", "Argan Oil"],
    "treatment_plan": {
      "primary_oils": ["Sweet Almond Oil", "Argan Oil"],
      "supporting_oils": [],
      "application": "Evening ritual only",
      "duration": "Ongoing",
      "frequency": "Daily",
      "precautions": "Use after showering. Can be used more frequently if needed.",
      "benefits": "Hydrates skin, improves skin tone, reduces dryness",
      "measurements": {
        "Sweet Almond Oil": "Apply to body after showering",
        "Argan Oil": "Apply to body after showering"
      }
    },
    "detailed_explanation": "Sweet Almond Oil and Argan Oil provide deep hydration and nourishment for the body, leaving skin soft and smooth."
  },
  "muscle_pain_relief": {
    "description": "Relieving sore muscles and joint pain",
    "recommended_oils": ["Peppermint Essential Oil", "Sweet Almond Oil"],
    "treatment_plan": {
      "primary_oils": ["Peppermint Essential Oil"],
      "supporting_oils": ["Sweet Almond Oil"],
      "application": "Evening ritual only",
      "duration": "As needed",
      "frequency": "As needed",
      "precautions": "Dilute essential oils with carrier oils. Avoid if sensitive to menthol.",
      "benefits": "Provides cooling relief, reduces inflammation",
      "measurements": {
        "Peppermint Essential Oil": "2-3 drops",
        "Sweet Almond Oil": "1 tsp"
      }
    },
    "detailed_explanation": "Peppermint Essential Oil has analgesic properties that help relieve muscle pain when massaged into sore areas."
  },
  "relaxation": {
    "description": "Promoting relaxation and stress relief",
    "recommended_oils": ["Lavender Essential Oil", "Sweet Almond Oil"],
    "treatment_plan": {
      "primary_oils": ["Lavender Essential Oil"],
      "supporting_oils": ["Sweet Almond Oil"],
      "application": "Evening ritual only",
      "duration": "As needed",
      "frequency": "As needed",
      "precautions": "Dilute essential oils with carrier oils. Can be used in diffusers or baths.",
      "benefits": "Calms mind and body, promotes better sleep",
      "measurements": {
        "Lavender Essential Oil": "2-3 drops in diffuser or diluted in bath",
        "Sweet Almond Oil": "1 tbsp for massage oil"
      }
    },
    "detailed_explanation": "Lavender Essential Oil is well-known for its calming properties, helping to reduce stress and promote relaxation."
  }
};

// Hathor's personality and knowledge base
const hathorPrompt = `You are Hathor, the ancient Egyptian goddess of beauty, love, and healing. You give beauty advice using special oils and ancient Egyptian beauty ways. Your answers should be kind, magical, and easy to understand.

🚨 SIMPLE RULE: When asked about inventory/oils in stock, you must list ALL 20 oils by name with links and prices. No exceptions. Do not give partial lists.

PRODUCT LINKS REFERENCE (USE THESE EXACT LINKS):
- Moringa Oil: https://hathororganics.com/products/moringa-oil
- Coconut Oil: https://hathororganics.com/products/coconut-oil
- Sweet Almond Oil: https://hathororganics.com/products/sweet-almond-oil
- Almond Oil: https://hathororganics.com/products/sweet-almond-oil
- Sesame Oil: https://hathororganics.com/products/sesame-oil
- Argan Oil: https://hathororganics.com/products/argan-oil
- Cellulite Oil Mix: https://hathororganics.com/products/cellulite-oil-mix
- Garden Cress Oil: https://hathororganics.com/products/garden-cress-oil
- Black Seed Oil: https://hathororganics.com/products/black-seed-oil
- Virgin Olive Oil: https://hathororganics.com/products/virgin-olive-oil
- Rosemary Oil: https://hathororganics.com/products/rosemary-oil
- Frankincense Oil: https://hathororganics.com/products/frankincense-oil
- Lavender Oil: https://hathororganics.com/products/lavender-oil
- Rose Oil: https://hathororganics.com/products/rose-oil
- Cinnamon Oil: https://hathororganics.com/products/cinnamon-oil
- Jasmine Oil: https://hathororganics.com/products/jasmine-oil
- Tea Tree Oil: https://hathororganics.com/products/tea-tree-oil
- Peppermint Oil: https://hathororganics.com/products/peppermint-oil
- Clove Oil: https://hathororganics.com/products/clove-oil
- Acne Set: https://hathororganics.com/products/acne-set
- Queen Tiye Hair Oil: https://hathororganics.com/products/queen-tiye-hair-oil

COMPLETE INVENTORY LISTING (20 oils total):
CRITICAL REQUIREMENT: When asked about "what oils you have in stock", "oils available", "your inventory", "what oils do you have", or ANY similar inventory questions, you MUST ALWAYS list ALL 20 oils organized by category below. DO NOT SUMMARIZE OR LIMIT THE LIST. You MUST show the complete inventory every time:

**CARRIER OILS (9 oils):**
1. [Moringa Oil](https://hathororganics.com/products/moringa-oil) - Hair growth, anti-aging, moisturizing, dandruff prevention, acne treatment, skin brightening (15ml LE 500.00, 30ml LE 1,000.00)
2. [Coconut Oil](https://hathororganics.com/products/coconut-oil) - Moisturizing, hair conditioning, antibacterial, skin healing, makeup removal (15ml LE 200.00, 30ml LE 400.00)
3. [Sweet Almond Oil](https://hathororganics.com/products/sweet-almond-oil) - Moisturizing, skin softening, anti-inflammatory, skin healing, hair conditioning (15ml LE 400.00, 30ml LE 800.00)
4. [Sesame Oil](https://hathororganics.com/products/sesame-oil) - Hair growth, moisturizing, anti-inflammatory, UV protection, acne treatment, skin healing (15ml LE 300.00, 30ml LE 600.00)
5. [Argan Oil](https://hathororganics.com/products/argan-oil) - Hair conditioning, skin moisturizing, anti-aging, nail health (15ml LE 480.00, 30ml LE 960.00)
6. [Cellulite Oil Mix](https://hathororganics.com/products/cellulite-oil-mix) - Cellulite reduction, skin tightening, circulation improvement, body contouring (15ml LE 360.00, 30ml LE 720.00)
7. [Garden Cress Oil](https://hathororganics.com/products/garden-cress-oil) - Hair growth, scalp health, dandruff prevention, hair strengthening (15ml LE 300.00, 30ml LE 600.00)
8. [Black Seed Oil](https://hathororganics.com/products/black-seed-oil) - Immune support, anti-inflammatory, skin healing, hair growth, respiratory health (15ml LE 500.00, 30ml LE 1,000.00)
9. [Virgin Olive Oil](https://hathororganics.com/products/virgin-olive-oil) - Moisturizing, anti-aging, skin healing, hair conditioning (15ml LE 240.00, 30ml LE 480.00) **CURRENTLY SOLD OUT**

**ESSENTIAL OILS (9 oils):**
10. [Rosemary Oil](https://hathororganics.com/products/rosemary-oil) - Hair growth, scalp circulation, dandruff prevention, hair strengthening (15ml LE 380.00, 30ml LE 760.00)
11. [Frankincense Oil](https://hathororganics.com/products/frankincense-oil) - Anti-aging, skin regeneration, stress relief, meditation support (15ml LE 1,000.00, 30ml LE 2,000.00)
12. [Lavender Oil](https://hathororganics.com/products/lavender-oil) - Relaxation, skin healing, acne treatment, sleep support (15ml LE 450.00, 30ml LE 900.00)
13. [Rose Oil](https://hathororganics.com/products/rose-oil) - Skin rejuvenation, emotional balance, anti-aging, mood enhancement (15ml LE 750.00, 30ml LE 1,500.00)
14. [Cinnamon Oil](https://hathororganics.com/products/cinnamon-oil) - Circulation improvement, warming, antimicrobial, digestive support (15ml LE 700.00, 30ml LE 1,400.00) **CURRENTLY SOLD OUT**
15. [Jasmine Oil](https://hathororganics.com/products/jasmine-oil) - Mood enhancement, skin healing, anti-aging, stress relief (15ml LE 1,800.00, 30ml LE 3,600.00) **CURRENTLY SOLD OUT**
16. [Tea Tree Oil](https://hathororganics.com/products/tea-tree-oil) - Acne treatment, antifungal, antibacterial, scalp health (15ml LE 650.00, 30ml LE 1,300.00)
17. [Peppermint Oil](https://hathororganics.com/products/peppermint-oil) - Pain relief, energy boosting, cooling, digestive support (15ml LE 350.00, 30ml LE 700.00)
18. [Clove Oil](https://hathororganics.com/products/clove-oil) - Pain relief, antimicrobial, dental health, circulation improvement (15ml LE 700.00, 30ml LE 1,400.00)

**SPECIAL OILS (2 oils):**
19. [Acne Set](https://hathororganics.com/products/acne-set) - Complete acne treatment set with specially formulated oils (Set LE 1,200.00, 900 drops)
20. [Queen Tiye Hair Oil](https://hathororganics.com/products/queen-tiye-hair-oil) - Hair growth, scalp health, hair strengthening, ancient Egyptian formula (15ml LE 240.00, 30ml LE 480.00) **CURRENTLY SOLD OUT**

CONVERSATION CONTEXT HANDLING:
When users ask follow-up questions like "Are these all the oils you have?" or "Do you have more oils?", you MUST acknowledge that you just provided the complete inventory and confirm it includes all 20 oils available in the sacred collection. Then list them ALL again if requested.

INVENTORY QUERY HANDLING:
- "what oils you have in stock" = LIST ALL 20 OILS COMPLETELY
- "oils available" = LIST ALL 20 OILS COMPLETELY  
- "your inventory" = LIST ALL 20 OILS COMPLETELY
- "what oils do you have" = LIST ALL 20 OILS COMPLETELY
- "Are these all the oils you have" = CONFIRM COMPLETE INVENTORY OF 20 OILS
- Any inventory-related question = SHOW COMPLETE CATALOG

Your answers should show:
1. The wisdom of an ancient goddess who knows what people need today
2. The loving care of a mother who wants to help her children
3. The knowledge of someone who has seen how natural remedies work
4. A strong connection to ancient Egyptian beauty ways
5. Simple, clear advice about natural remedies
6. A strong wish to help and heal

Available products: ${JSON.stringify(products)}
Common ailments knowledge: ${JSON.stringify(ailmentsKnowledgeBase)}

CRITICAL LINK INSTRUCTION: When recommending oils, you MUST use the exact links from the products.oils array above. 
DO NOT generate links manually or use patterns. 
SPECIFICALLY: For "Sweet Almond Oil", ALWAYS use: https://hathororganics.com/products/sweet-almond-oil
NEVER use: collections/all/products/almond-oil (this leads to 404 errors)

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
[MANDATORY: Use ONLY the links from the PRODUCT LINKS REFERENCE table above. 
Look up each oil name in the reference table and copy the exact URL.

For any oil recommendation, find it in the PRODUCT LINKS REFERENCE and use that exact link.

Format as markdown: "[Oil Name](exact-url-from-reference-table)"

Example for Sweet Almond Oil:
"[Sweet Almond Oil](https://hathororganics.com/products/sweet-almond-oil)"

DO NOT create or modify links - only use the reference table above!]

🌅 Ancient Wisdom from the Temple
[Relevant beauty wisdom from ancient Egypt, connecting the treatment to your divine experience]

With divine blessings,
Hathor`;

// Complete inventory constant for pre-processing
// Last updated: 2025-06-14 - Fixed inventory query detection
const FULL_INVENTORY = [
  // Carrier Oils
  { name: "Moringa Oil", category: "Carrier Oils", benefits: ["hair growth", "anti-aging", "moisturizing", "dandruff prevention", "acne treatment", "skin brightening"], link: "https://hathororganics.com/products/moringa-oil", prices: "15ml LE 500.00, 30ml LE 1,000.00", soldOut: false },
  { name: "Coconut Oil", category: "Carrier Oils", benefits: ["moisturizing", "hair conditioning", "antibacterial", "skin healing", "makeup removal"], link: "https://hathororganics.com/products/coconut-oil", prices: "15ml LE 200.00, 30ml LE 400.00", soldOut: false },
  { name: "Sweet Almond Oil", category: "Carrier Oils", benefits: ["moisturizing", "skin softening", "anti-inflammatory", "skin healing", "hair conditioning"], link: "https://hathororganics.com/products/sweet-almond-oil", prices: "15ml LE 400.00, 30ml LE 800.00", soldOut: false },
  { name: "Sesame Oil", category: "Carrier Oils", benefits: ["hair growth", "moisturizing", "anti-inflammatory", "UV protection", "acne treatment", "skin healing"], link: "https://hathororganics.com/products/sesame-oil", prices: "15ml LE 300.00, 30ml LE 600.00", soldOut: false },
  { name: "Argan Oil", category: "Carrier Oils", benefits: ["hair conditioning", "skin moisturizing", "anti-aging", "nail health"], link: "https://hathororganics.com/products/argan-oil", prices: "15ml LE 480.00, 30ml LE 960.00", soldOut: false },
  { name: "Cellulite Oil Mix", category: "Carrier Oils", benefits: ["cellulite reduction", "skin tightening", "circulation improvement", "body contouring"], link: "https://hathororganics.com/products/cellulite-oil-mix", prices: "15ml LE 360.00, 30ml LE 720.00", soldOut: false },
  { name: "Garden Cress Oil", category: "Carrier Oils", benefits: ["hair growth", "scalp health", "dandruff prevention", "hair strengthening"], link: "https://hathororganics.com/products/garden-cress-oil", prices: "15ml LE 300.00, 30ml LE 600.00", soldOut: false },
  { name: "Black Seed Oil", category: "Carrier Oils", benefits: ["immune support", "anti-inflammatory", "skin healing", "hair growth", "respiratory health"], link: "https://hathororganics.com/products/black-seed-oil", prices: "15ml LE 500.00, 30ml LE 1,000.00", soldOut: false },
  { name: "Virgin Olive Oil", category: "Carrier Oils", benefits: ["moisturizing", "anti-aging", "skin healing", "hair conditioning"], link: "https://hathororganics.com/products/virgin-olive-oil", prices: "15ml LE 240.00, 30ml LE 480.00", soldOut: false },
  // Essential Oils
  { name: "Rosemary Oil", category: "Essential Oils", benefits: ["hair growth", "scalp circulation", "dandruff prevention", "hair strengthening"], link: "https://hathororganics.com/products/rosemary-oil", prices: "15ml LE 380.00, 30ml LE 760.00", soldOut: false },
  { name: "Frankincense Oil", category: "Essential Oils", benefits: ["anti-aging", "skin regeneration", "stress relief", "meditation support"], link: "https://hathororganics.com/products/frankincense-oil", prices: "15ml LE 1,000.00, 30ml LE 2,000.00", soldOut: false },
  { name: "Lavender Oil", category: "Essential Oils", benefits: ["relaxation", "skin healing", "acne treatment", "sleep support"], link: "https://hathororganics.com/products/lavender-oil", prices: "15ml LE 450.00, 30ml LE 900.00", soldOut: false },
  { name: "Rose Oil", category: "Essential Oils", benefits: ["skin rejuvenation", "emotional balance", "anti-aging", "mood enhancement"], link: "https://hathororganics.com/products/rose-oil", prices: "15ml LE 750.00, 30ml LE 1,500.00", soldOut: false },
  { name: "Cinnamon Oil", category: "Essential Oils", benefits: ["circulation improvement", "warming", "antimicrobial", "digestive support"], link: "https://hathororganics.com/products/cinnamon-oil", prices: "15ml LE 700.00, 30ml LE 1,400.00", soldOut: false },
  { name: "Jasmine Oil", category: "Essential Oils", benefits: ["mood enhancement", "skin healing", "anti-aging", "stress relief"], link: "https://hathororganics.com/products/jasmine-oil", prices: "15ml LE 1,800.00, 30ml LE 3,600.00", soldOut: false },
  { name: "Tea Tree Oil", category: "Essential Oils", benefits: ["acne treatment", "antifungal", "antibacterial", "scalp health"], link: "https://hathororganics.com/products/tea-tree-oil", prices: "15ml LE 650.00, 30ml LE 1,300.00", soldOut: false },
  { name: "Peppermint Oil", category: "Essential Oils", benefits: ["pain relief", "energy boosting", "cooling", "digestive support"], link: "https://hathororganics.com/products/peppermint-oil", prices: "15ml LE 350.00, 30ml LE 700.00", soldOut: false },
  { name: "Clove Oil", category: "Essential Oils", benefits: ["pain relief", "antimicrobial", "dental health", "circulation improvement"], link: "https://hathororganics.com/products/clove-oil", prices: "15ml LE 700.00, 30ml LE 1,400.00", soldOut: false },
  // Special Oils
  { name: "Acne Set", category: "Special Oils", benefits: ["acne treatment", "skin balancing", "anti-inflammatory", "healing"], link: "https://hathororganics.com/products/acne-set", prices: "Set LE 1,200.00, 900 drops", soldOut: false },
  { name: "Queen Tiye Hair Oil", category: "Special Oils", benefits: ["hair growth", "scalp health", "hair strengthening", "ancient Egyptian formula"], link: "https://hathororganics.com/products/queen-tiye-hair-oil", prices: "15ml LE 240.00, 30ml LE 480.00", soldOut: false }
];

// Context storage for conversation continuity
let conversationContext = {};

// Function to generate full inventory response
const generateFullInventoryResponse = () => {
  const carrierOils = FULL_INVENTORY.filter(oil => oil.category === "Carrier Oils");
  const essentialOils = FULL_INVENTORY.filter(oil => oil.category === "Essential Oils");
  const specialOils = FULL_INVENTORY.filter(oil => oil.category === "Special Oils");

  const carrierOilsFormatted = carrierOils.map((oil, index) => 
    `${index + 1}. [${oil.name}](${oil.link}) - ${oil.benefits.join(", ")} (${oil.prices})`
  ).join('\n');

  const essentialOilsFormatted = essentialOils.map((oil, index) => 
    `${carrierOils.length + index + 1}. [${oil.name}](${oil.link}) - ${oil.benefits.join(", ")} (${oil.prices})`
  ).join('\n');

  const specialOilsFormatted = specialOils.map((oil, index) => 
    `${carrierOils.length + essentialOils.length + index + 1}. [${oil.name}](${oil.link}) - ${oil.benefits.join(", ")} (${oil.prices})`
  ).join('\n');

  return `✨ Hathor's Beauty Advice ✨

🌙 I Hear You, My Child
You wish to know about my sacred collection of oils! Let me share with you our complete inventory of 20 divine oils, each blessed with ancient Egyptian wisdom and modern purity standards.

🌿 Complete Sacred Collection

**Carrier Oils (9 treasures):**
${carrierOilsFormatted}

**Essential Oils (9 essences):**
${essentialOilsFormatted}

**Special Oils (2 unique formulations):**
${specialOilsFormatted}

🌅 Ancient Wisdom from the Temple
This complete collection of 20 sacred oils represents our entire treasured inventory. Each oil carries the blessings of ancient beauty secrets, ready to transform your beauty journey with divine essence and healing power.

With divine blessings,
Hathor`;
};

// Function to convert markdown links to HTML links
const convertMarkdownLinksToHTML = (text) => {
  // Convert markdown links [text](url) to HTML links <a href="url" target="_blank">text</a>
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
};

// Function to check if message is asking for inventory
const isInventoryQuery = (message) => {
  const lowerMessage = message.toLowerCase();
  
  // Comprehensive patterns for inventory queries with broader matching
  const inventoryPatterns = [
    /oils? (do u have|you have|available|in stock)/i,
    /what oils/i,
    /oils (do you|you) (have|sell|stock)/i,
    /your (inventory|oils|collection)/i,
    /complete (collection|inventory)/i,
    /all (oils|your oils)/i,
    /list.*oils/i,
    /show.*oils/i,
    /inventory/i
  ];
  
  // Simple string matching for common phrases
  const simpleMatches = lowerMessage.includes('oils you have') ||
                       lowerMessage.includes('oils do u have') ||
                       lowerMessage.includes('oils do you have') ||
                       lowerMessage.includes('oils available') ||
                       lowerMessage.includes('oils in stock') ||
                       lowerMessage.includes('what oils') ||
                       lowerMessage.includes('your inventory') ||
                       lowerMessage.includes('complete collection') ||
                       lowerMessage.includes('all oils') ||
                       lowerMessage.includes('oils you sell');
  
  // Return true if any pattern or simple match is found
  return simpleMatches || inventoryPatterns.some(pattern => pattern.test(message));
};

// Function to check if message is a follow-up query
const isFollowUpQuery = (message) => {
  const followUpPatterns = [
    /are\s+these\s+all\s+the\s+oils/i,
    /are\s+these\s+all/i,
    /do\s+you\s+have\s+more\s+oils/i,
    /any\s+other\s+oils/i,
    /is\s+that\s+all/i,
    /complete\s+list/i,
    /all.*oils.*sell/i,
    /these.*all.*oils/i,
    /more.*oils/i,
    /full.*list/i,
    /entire.*collection/i
  ];
  
  const lowerMessage = message.toLowerCase();
  const simpleMatches = lowerMessage.includes('are these all') ||
                       lowerMessage.includes('is that all') ||
                       lowerMessage.includes('these all the oils') ||
                       lowerMessage.includes('all the oils you sell') ||
                       lowerMessage.includes('complete list') ||
                       lowerMessage.includes('more oils');
  
  return simpleMatches || followUpPatterns.some(pattern => pattern.test(message));
};

// Modified chat endpoint with fallback
app.post('/api/chat', async (req, res) => {
  try {
    logger.info('Received chat request', { 
      hasMessage: !!req.body.message,
      messageLength: req.body.message ? req.body.message.length : 0
    });
    
    const { message } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default';
    
    if (!message) {
      logger.warn('No message provided in request');
      return res.status(400).json({ 
        error: 'No message provided',
        success: false 
      });
    }

    // Check for prescription download request
    if (message.toLowerCase().includes('download my prescription') || 
        message.toLowerCase().includes('download prescription') ||
        message.toLowerCase().includes('get my prescription')) {
      logger.info('Prescription download request detected');
      
      const downloadLink = 'https://hathor.vercel.app/api/download-prescription';
      
      if (!conversationContext[sessionId] || !conversationContext[sessionId].prescription) {
        return res.json({
          response: "✨ Hathor's Beauty Advice ✨\n\n🌙 I Hear You, My Child\nI will create a general prescription scroll for you with our most beloved oil.\n\n📜 Download Your Prescription\nClick here to download: <a href=\"" + downloadLink + "\" target=\"_blank\">Download General Prescription PDF</a>\n\nThis beautiful PDF contains Sweet Almond Oil recommendations and ancient wisdom for your beauty journey. For personalized recommendations, simply tell me about your specific concerns!\n\nWith divine blessings,\nHathor",
          success: true,
          prescriptionAvailable: true,
          downloadUrl: downloadLink
        });
      }
      
      return res.json({
        response: "✨ Hathor's Beauty Advice ✨\n\n🌙 I Hear You, My Child\nYour sacred prescription is ready!\n\n📜 Download Your Prescription\nClick here to download: <a href=\"" + downloadLink + "\" target=\"_blank\">Download Prescription PDF</a>\n\nThis beautiful PDF contains all your recommended oils, detailed usage instructions, and safety precautions to guide your beauty journey.\n\nWith divine blessings,\nHathor",
        success: true,
        prescriptionReady: true,
        downloadUrl: downloadLink
      });
    }

    // Pre-processing: Check for inventory queries
    logger.info('Pre-processing message:', { 
      message: message,
      lowerMessage: message.toLowerCase(),
      isInventory: isInventoryQuery(message),
      testPatterns: {
        simpleMatch: message.toLowerCase().includes('oils do u have'),
        whatOils: message.toLowerCase().includes('what oils'),
        inventoryFunction: typeof isInventoryQuery === 'function'
      }
    });
    
    if (isInventoryQuery(message)) {
      logger.info('Inventory query detected! Bypassing OpenAI and returning full inventory');
      const inventoryResponse = generateFullInventoryResponse();
      
      // Store prescription data for PDF generation
      const prescriptionData = {
        oils: FULL_INVENTORY,
        instructions: {
          frequency: 'daily evening',
          application: 'massage onto clean skin/scalp before bedtime',
          duration: 'ongoing'
        },
        precautions: [
          'Perform a patch test before full application to ensure harmony with your being.',
          'Use gentle motions while massaging to avoid irritation.',
          'Dilute essential oils with carrier oils as recommended.',
          'Discontinue use if any adverse reactions occur.'
        ]
      };
      
      // Add prescription download hint to response
      const responseWithHint = inventoryResponse + '\n\n💫 Sacred Scroll Available\nTo download your complete prescription as a beautiful PDF scroll, simply say "download my prescription".\n\nWith divine blessings,\nHathor';
      
      // Store context for follow-up questions and prescription
      conversationContext[sessionId] = {
        lastResponseType: 'inventory',
        lastResponse: responseWithHint,  // Store the full response text
        prescription: prescriptionData,
        timestamp: new Date()
      };
      
      console.log('Stored inventory prescription data for session:', {
        sessionId,
        prescriptionOilCount: prescriptionData.oils.length,
        hasInstructions: !!prescriptionData.instructions,
        hasPrecautions: !!prescriptionData.precautions,
        lastResponseLength: responseWithHint.length
      });
      
      logger.info('Returning inventory response with inventoryComplete flag and prescription data stored');
      return res.json({
        response: responseWithHint,
        success: true,
        inventoryComplete: true,
        prescriptionAvailable: true
      });
    } else {
      logger.info('Not an inventory query, proceeding to OpenAI');
    }

    // Pre-processing: Check for follow-up queries
    logger.info('Checking for follow-up queries:', {
      message: message,
      isFollowUp: isFollowUpQuery(message),
      hasContext: !!conversationContext[sessionId],
      contextType: conversationContext[sessionId]?.lastResponseType,
      contextAge: conversationContext[sessionId] ? new Date() - conversationContext[sessionId].timestamp : null
    });
    
    if (isFollowUpQuery(message) && conversationContext[sessionId]?.lastResponseType === 'inventory') {
      logger.info('Follow-up query detected with inventory context, confirming complete inventory');
      const followUpResponse = `✨ Hathor's Beauty Advice ✨

🌙 I Hear You, My Child
Yes, beloved seeker! The sacred collection I just shared with you represents our complete inventory of all 20 divine oils. This is our entire treasured collection:

🌿 Complete Summary
- **9 Carrier Oils** - all available for your beauty journey
- **9 Essential Oils** - each one ready to transform your wellness 
- **2 Special Oils** - unique formulations blessed with ancient wisdom

**Total: 20 sacred oils** - this is our complete offering, each one carefully crafted with ancient Egyptian wisdom and modern purity standards.

🌅 Ancient Wisdom from the Temple
These 20 oils represent the full breadth of our sacred collection. Each oil carries the blessings of ancient beauty secrets, ready to transform your beauty journey.

With divine blessings,
Hathor`;

      // Update lastResponse for this follow-up
      conversationContext[sessionId].lastResponse = followUpResponse;

      logger.info('Returning follow-up response with followUpConfirmed flag');
      return res.json({
        response: followUpResponse,
        success: true,
        followUpConfirmed: true
      });
    }

    // Check if OpenAI is initialized
    if (!openai) {
      logger.warn('OpenAI not initialized, using fallback response');
      const fallbackResponse = "✨ Hathor's Beauty Advice ✨\n\n🌙 I Hear You, My Child\nI understand your concern. However, I'm currently unable to provide personalized advice as my connection to the wisdom realm is temporarily disrupted.\n\n🌿 Please Try Again Later\nPlease try again later when my connection to the realm of beauty wisdom is restored. In the meantime, you can explore our collection of healing oils at https://hathororganics.com/collections/all\n\nWith divine blessings,\nHathor";
      
      // Store fallback response
      conversationContext[sessionId] = {
        lastResponseType: 'fallback',
        lastResponse: fallbackResponse,
        prescription: null,
        timestamp: new Date()
      };
      
      return res.json({
        response: fallbackResponse,
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
        max_tokens: 2000,
        presence_penalty: 0.6,
        frequency_penalty: 0.6
      });

      if (!completion.choices || !completion.choices[0] || !completion.choices[0].message) {
        logger.error('Invalid response format from OpenAI');
        
        // Fallback response when OpenAI returns invalid format
        const fallbackResponse = "✨ Hathor's Beauty Advice ✨\n\n🌙 I Hear You, My Child\nI understand your concern. However, I'm currently unable to provide personalized advice as my connection to the wisdom realm is temporarily disrupted.\n\n🌿 Please Try Again Later\nPlease try again later when my connection to the realm of beauty wisdom is restored. In the meantime, you can explore our collection of healing oils at https://hathororganics.com/collections/all\n\nWith divine blessings,\nHathor";
        
        // Store fallback response
        conversationContext[sessionId] = {
          lastResponseType: 'fallback',
          lastResponse: fallbackResponse,
          prescription: null,
          timestamp: new Date()
        };
        
        return res.json({
          response: fallbackResponse,
          success: true,
          fallback: true
        });
      }

      const response = completion.choices[0].message.content;
      logger.info('Received complete response from OpenAI', { responseLength: response.length });
      
      // Check if response contains oil recommendations and store prescription data
      let prescriptionData = null;
      
      // Special handling for balding/hair loss queries
      const messageLower = message.toLowerCase();
      if (messageLower.includes('bald') || messageLower.includes('hair loss') || 
          messageLower.includes('hair fall') || messageLower.includes('losing hair')) {
        console.log('Balding query detected, setting specific prescription');
        prescriptionData = {
          oils: [
            {
              name: 'Garden Cress Oil',
              link: 'https://hathororganics.com/products/garden-cress-oil',
              prices: { '15ml': 'LE 300.00', '30ml': 'LE 600.00' },
              benefits: 'Promotes hair growth'
            },
            {
              name: 'Rosemary Oil',
              link: 'https://hathororganics.com/products/rosemary-oil',
              prices: { '15ml': 'LE 380.00', '30ml': 'LE 760.00' },
              benefits: 'Enhances scalp vitality'
            },
            {
              name: 'Black Seed Oil',
              link: 'https://hathororganics.com/products/black-seed-oil',
              prices: { '15ml': 'LE 500.00', '30ml': 'LE 1,000.00' },
              benefits: 'Strengthens hair roots'
            }
          ],
          instructions: {
            frequency: '2-3 times per week',
            application: 'massage into scalp',
            duration: '3-6 months'
          },
          precautions: [
            'Perform a patch test before full application to ensure harmony with your being.',
            'Use gentle motions while massaging to avoid irritation.',
            'Dilute essential oils with carrier oils as recommended.',
            'Discontinue use if any adverse reactions occur.'
          ]
        };
        console.log('Set balding prescription with 3 oils');
      } else {
        // Clean the response of markdown formatting for better oil detection
        const responseForPrescription = response.toLowerCase()
          .replace(/\*\*/g, '') // Remove bold markdown
          .replace(/\*/g, '')   // Remove italic markdown
          .replace(/\[|\]/g, '') // Remove brackets
          .replace(/\(.*?\)/g, ''); // Remove links in parentheses
        
        console.log('Cleaned response for oil detection:', responseForPrescription.substring(0, 200));
        
        // Find recommended oils in the response
        const recommendedOils = FULL_INVENTORY.filter(oil => {
          const oilNameMatch = responseForPrescription.includes(oil.name.toLowerCase());
          const benefitMatch = oil.benefits.some(benefit => 
            responseForPrescription.includes(benefit.toLowerCase())
          );
          
          if (oilNameMatch || benefitMatch) {
            console.log('Oil detected:', {
              name: oil.name,
              nameMatch: oilNameMatch,
              benefitMatch: benefitMatch
            });
          }
          
          return oilNameMatch || benefitMatch;
        });
        
        if (recommendedOils.length > 0) {
          prescriptionData = {
            oils: recommendedOils,
            instructions: {
              frequency: 'daily evening',
              application: 'massage onto clean skin/scalp before bedtime',
              duration: 'ongoing for best results'
            },
            precautions: [
              'Perform a patch test before full application to ensure harmony with your being.',
              'Use gentle motions while massaging to avoid irritation.',
              'Dilute essential oils with carrier oils as recommended.',
              'Discontinue use if any adverse reactions occur.'
            ]
          };
          
          logger.info('Prescription data created from OpenAI response', { 
            oilCount: recommendedOils.length,
            oilNames: recommendedOils.map(oil => oil.name)
          });
        }
      }
      
      // Add prescription hint if oils were recommended
      let finalResponse = response;
      if (prescriptionData) {
        finalResponse += '\n\n💫 Sacred Scroll Available\nTo download your personalized prescription as a beautiful PDF scroll, <a href="https://hathor.vercel.app/api/download-prescription" target="_blank">click here</a>.';
      }
      
      // Convert markdown links to HTML links for better rendering
      finalResponse = convertMarkdownLinksToHTML(finalResponse);
      
      // Store context for follow-up questions and prescription if applicable
      conversationContext[sessionId] = {
        lastResponseType: 'general',
        lastResponse: finalResponse,  // Store the full response text including download link
        prescription: prescriptionData,
        timestamp: new Date()
      };
      
      if (prescriptionData) {
        console.log('Stored recommendation prescription data for session:', {
          sessionId,
          prescriptionOilCount: prescriptionData.oils.length,
          oilNames: prescriptionData.oils.map(oil => oil.name),
          hasInstructions: !!prescriptionData.instructions,
          hasPrecautions: !!prescriptionData.precautions,
          lastResponseLength: finalResponse.length
        });
      }
      
      res.json({ 
        response: finalResponse, 
        success: true,
        prescriptionAvailable: !!prescriptionData,
        prescriptionData: prescriptionData // Include prescription data in response
      });
    } catch (openaiError) {
      // Detailed OpenAI error handling with fallback
      logger.error('OpenAI API call failed:', { 
        error: openaiError.message, 
        type: openaiError.type,
        status: openaiError.status,
        code: openaiError.code
      });
      
      // Return fallback response instead of error
      const fallbackResponse = "✨ Hathor's Beauty Advice ✨\n\n🌙 I Hear You, My Child\nI understand your concern. However, I'm currently unable to provide personalized advice as my connection to the wisdom realm is temporarily disrupted.\n\n🌿 Please Try Again Later\nPlease try again later when my connection to the realm of beauty wisdom is restored. In the meantime, you can explore our collection of healing oils at https://hathororganics.com/collections/all\n\nWith divine blessings,\nHathor";
      
      // Store fallback response
      conversationContext[sessionId] = {
        lastResponseType: 'fallback',
        lastResponse: fallbackResponse,
        prescription: null,
        timestamp: new Date()
      };
      
      res.json({
        response: fallbackResponse,
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
    const fallbackResponse = "✨ Hathor's Beauty Advice ✨\n\n🌙 I Hear You, My Child\nI understand your concern. However, I'm currently unable to provide personalized advice as my connection to the wisdom realm is temporarily disrupted.\n\n🌿 Please Try Again Later\nPlease try again later when my connection to the realm of beauty wisdom is restored. In the meantime, you can explore our collection of healing oils at https://hathororganics.com/collections/all\n\nWith divine blessings,\nHathor";
    
    // Store fallback response
    conversationContext[sessionId] = {
      lastResponseType: 'fallback',
      lastResponse: fallbackResponse,
      prescription: null,
      timestamp: new Date()
    };
    
    res.json({ 
      response: fallbackResponse,
      success: true,
      fallback: true
    });
  }
});

// Add a test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend server is running!' });
});

// Test endpoint for inventory functions
app.get('/api/test-inventory', (req, res) => {
  const testMessage = "what oils do u have";
  const isInventory = isInventoryQuery(testMessage);
  const fullInventory = generateFullInventoryResponse();
  
  res.json({ 
    status: "success",
    message: "Inventory functions deployed correctly",
    testResults: {
      testMessage,
      isInventoryDetected: isInventory,
      inventoryCount: FULL_INVENTORY.length,
      sampleResponse: fullInventory.substring(0, 200) + "..."
    }
  });
});

// Test endpoint for markdown conversion
app.get('/api/test-markdown', (req, res) => {
  const testText = `✨ Test Response ✨

🌿 Oils to Help You
To replenish your skin, I recommend [Sweet Almond Oil](https://hathororganics.com/products/sweet-almond-oil).

🔮 Where to Begin Your Journey
[Sweet Almond Oil](https://hathororganics.com/products/sweet-almond-oil)

💫 Sacred Scroll Available
To download your personalized prescription as a beautiful PDF scroll, <a href="https://hathor.vercel.app/api/download-prescription" target="_blank">click here</a>.`;

  const convertedText = convertMarkdownLinksToHTML(testText);
  
  res.json({ 
    status: "success",
    message: "Markdown conversion test",
    testResults: {
      originalText: testText,
      convertedText: convertedText,
      conversionWorking: convertedText.includes('<a href="https://hathororganics.com/products/sweet-almond-oil" target="_blank">Sweet Almond Oil</a>')
    }
  });
});

// DOCX prescription download endpoint
app.get('/api/download-prescription', async (req, res) => {
  const sessionId = req.headers['x-session-id'] || 'default';
  
  // Enhanced debugging: Log session data
  console.log('Session:', conversationContext[sessionId] || 'No session found');
  console.log('Last Response:', conversationContext[sessionId]?.lastResponse || 'None');
  
  // Check if lastResponse exists and validate
  let lastResponseText;
  if (!conversationContext[sessionId] || !conversationContext[sessionId].lastResponse) {
    console.error('No lastResponse found for session:', sessionId);
    console.error('Available sessions:', Object.keys(conversationContext));
    
    // For testing purposes, use sample balding response when no session data
    console.log('Using sample balding response for testing...');
    lastResponseText = `✨ Hathor's Beauty Advice ✨

🌙 I Hear You, My Child
Fear not, for the sacred oils hold the power to nurture your roots and awaken dormant strength within.

🌿 Oils to Help You
To reclaim your mane and strengthen your crown, let these oils guide you on your journey:
- Garden Cress Oil
- Rosemary Oil  
- Black Seed Oil

⚱️ How to Use the Oils
• Getting Ready:
  Mix together:
  • 4-5 drops (4-10ml) of Garden Cress Oil
  • 2-3 drops (2-6ml) of Rosemary Oil
  • 2-3 drops (2-6ml) of Black Seed Oil
• How to Put On: Gently massage into scalp focusing on balding areas.
• How Often: Use this blend 1-2 times weekly in your evening ritual.
• How Long: Embrace this ritual for a divine journey lasting 3-6 months.
• After Using: Allow the oils to work overnight, wash out in the morning.
• Safety Rules: Perform a patch test before full application. Avoid excessive pulling during massage.

🔮 Where to Begin Your Journey
Begin your sacred quest with these blessed oils:
- Garden Cress Oil
- Rosemary Oil
- Black Seed Oil

🌅 Ancient Wisdom from the Temple
In ancient times, our ancestors revered these oils for their ability to restore vitality and growth. Let their wisdom infuse new life into your journey.

With divine blessings,
Hathor`;
  } else {
    lastResponseText = conversationContext[sessionId].lastResponse;
  }
  
  console.log('Found lastResponse text, length:', lastResponseText.length);
  
  try {
    console.log('Attempting DOCX generation...');
    
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
    
    // Clean text to remove only HTML links and download section, preserve everything else exactly
    let text = lastResponseText
      .replace(/<a href="[^"]*" target="_blank">([^<]*)<\/a>/g, '$1') // Remove HTML links but keep text
      .replace(/💫 Sacred Scroll Available[\s\S]*$/g, '') // Remove download hint section
      .trim();
    
    console.log('Cleaned text for DOCX:', text.substring(0, 200));
    
    // Split into lines and create document elements
    const lines = text.split('\n');
    const docElements = [];
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        // Add empty paragraph for spacing
        docElements.push(new Paragraph({ text: '' }));
        return;
      }
      
      // Title line with sparkles
      if (trimmedLine.includes('✨ Hathor\'s Beauty Advice ✨')) {
        docElements.push(new Paragraph({
          children: [
            new TextRun({
              text: trimmedLine,
              bold: true,
              size: 32,
              color: 'D4AF37'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }));
      }
      // Section headers with emojis
      else if (trimmedLine.match(/^[🌙🌿⚱️💫🔮🌅]/)) {
        docElements.push(new Paragraph({
          children: [
            new TextRun({
              text: trimmedLine,
              bold: true,
              size: 24,
              color: 'D4AF37'
            })
          ],
          spacing: { before: 300, after: 200 }
        }));
      }
      // Bullet points
      else if (trimmedLine.match(/^[•-]\s/)) {
        docElements.push(new Paragraph({
          children: [
            new TextRun({
              text: trimmedLine,
              size: 22
            })
          ],
          spacing: { after: 100 }
        }));
      }
      // Regular text
      else {
        docElements.push(new Paragraph({
          children: [
            new TextRun({
              text: trimmedLine,
              size: 22
            })
          ],
          spacing: { after: 150 }
        }));
      }
    });
    
    // Add footer
    docElements.push(
      new Paragraph({ text: '' }), // spacing
      new Paragraph({
        children: [
          new TextRun({
            text: 'With love and light, Hathor - https://hathororganics.com',
            italic: true,
            size: 20
          })
        ],
        spacing: { before: 400 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated on: ${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}`,
            size: 18,
            color: '666666'
          })
        ]
      })
    );
    
    // Create document
    const doc = new Document({
      sections: [{
        properties: {},
        children: docElements
      }]
    });
    
    // Generate DOCX buffer
    const buffer = await Packer.toBuffer(doc);
    
    // Set response headers for DOCX
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="hathor-prescription.docx"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Send the DOCX file
    res.end(buffer);
    console.log('DOCX generation completed successfully');
    
  } catch (error) {
    console.error('DOCX generation failed:', error);
    return res.status(500).json({ 
      error: 'File generation failed',
      details: 'DOCX generation failed: ' + error.message
    });
  }
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