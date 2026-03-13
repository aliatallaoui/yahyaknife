/**
 * AI Landing Page Generator Service
 *
 * Uses Google Gemini 2.5 Flash (vision) to analyze product images and generate
 * complete, high-conversion landing page content and block structure.
 *
 * Uses Nano Banana 2 (Gemini 3.1 Flash Image) to generate high-quality
 * marketing images for hero banners and section backgrounds.
 *
 * Generated pages are fully compatible with the existing LandingPage
 * block schema and integrate with the platform's order system.
 */

const { GoogleGenAI } = require('@google/genai');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Product = require('../../models/Product');
const ProductVariant = require('../../models/ProductVariant');
const SalesChannel = require('../../models/SalesChannel');
const LandingPage = require('../../models/LandingPage');
const AppError = require('../../shared/errors/AppError');
const logger = require('../../shared/logger');

const PAGES_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'pages');

/**
 * Convert a local image URL (e.g. /uploads/products/abc.jpg) to a base64 data-URI.
 * If the image is already a data-URI, return as-is.
 */
function imageToBase64(imgPath) {
    if (imgPath.startsWith('data:')) return imgPath; // already base64
    const ext = path.extname(imgPath).toLowerCase();
    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
    const mime = mimeMap[ext] || 'image/jpeg';
    const uploadsBase = path.resolve(__dirname, '..', '..');
    const filePath = path.resolve(uploadsBase, imgPath);
    // Guard against path traversal — resolved path must stay inside project root
    if (!filePath.startsWith(uploadsBase + path.sep)) {
        logger.warn({ imgPath }, 'Blocked path traversal attempt in imageToBase64');
        return null;
    }
    try {
        const buf = fs.readFileSync(filePath);
        return `data:${mime};base64,${buf.toString('base64')}`;
    } catch (err) {
        logger.warn({ err, filePath }, 'Failed to read product image from disk');
        return null;
    }
}

/**
 * Save a base64 data-URI image to disk and return the public URL path.
 * @param {string} dataUri - e.g. "data:image/png;base64,iVBORw0KGgo..."
 * @param {string} prefix - filename prefix (e.g. "hero", "benefits")
 * @returns {string|null} URL path like "/uploads/pages/hero-abc123.png" or null on failure
 */
function saveBase64Image(dataUri, prefix = 'img') {
    if (!dataUri || !dataUri.startsWith('data:')) return null;
    try {
        const match = dataUri.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!match) return null;
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const filename = `${prefix}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
        fs.writeFileSync(path.join(PAGES_UPLOAD_DIR, filename), buffer);
        return `/uploads/pages/${filename}`;
    } catch (err) {
        logger.warn({ err: err.message, prefix }, 'Failed to save generated image to disk');
        return null;
    }
}

/**
 * Persist all base64 images in a generated image map to disk.
 * Replaces data-URIs with file paths in-place.
 * @param {Object} imageMap - { hero: "data:...", benefits: "data:...", ... }
 * @returns {Object} Same map with data-URIs replaced by /uploads/pages/... paths
 */
function persistImageMap(imageMap) {
    const persisted = {};
    for (const [key, dataUri] of Object.entries(imageMap)) {
        const filePath = saveBase64Image(dataUri, key);
        persisted[key] = filePath || dataUri; // fallback to data-URI if save fails
    }
    return persisted;
}

// ── Shared AI Client ─────────────────────────────────────────────────────────

function getAIClient() {
    if (!process.env.GEMINI_API_KEY) {
        throw AppError.validationFailed({ apiKey: 'Gemini API key not configured. Set GEMINI_API_KEY in environment.' });
    }
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// ── Theme Templates ─────────────────────────────────────────────────────────

const THEME_TEMPLATES = {
    minimal: {
        label: 'Minimal Product Page',
        description: 'Clean, focused layout with product front and center',
        layout: 'minimal',
        blockOrder: ['hero', 'productGallery', 'variantSelector', 'codForm', 'trustBadges', 'deliveryInfo'],
        theme: { primaryColor: '#1f2937', accentColor: '#3b82f6', backgroundColor: '#ffffff', textColor: '#1f2937', buttonStyle: 'rounded', layout: 'minimal' },
        imagePrompts: { hero: 'minimalist clean white background product showcase' }
    },
    sales_funnel: {
        label: 'Sales Funnel',
        description: 'High-conversion funnel with urgency and social proof',
        layout: 'bold',
        blockOrder: ['hero', 'stockScarcity', 'productGallery', 'benefits', 'testimonials', 'variantSelector', 'countdown', 'codForm', 'guarantee', 'faq', 'cta', 'trustBadges'],
        theme: { primaryColor: '#dc2626', accentColor: '#f59e0b', backgroundColor: '#ffffff', textColor: '#1f2937', buttonStyle: 'pill', layout: 'bold' },
        imagePrompts: { hero: 'bold dramatic product hero shot with vibrant lighting', benefits: 'lifestyle action shot showing product benefits' }
    },
    storytelling: {
        label: 'Long-form Storytelling',
        description: 'Narrative-driven page that builds desire through story',
        layout: 'standard',
        blockOrder: ['hero', 'text', 'productGallery', 'benefits', 'text', 'testimonials', 'variantSelector', 'codForm', 'faq', 'guarantee', 'deliveryInfo', 'trustBadges', 'cta'],
        theme: { primaryColor: '#7c3aed', accentColor: '#f59e0b', backgroundColor: '#fafafa', textColor: '#1f2937', buttonStyle: 'rounded', layout: 'standard' },
        imagePrompts: { hero: 'cinematic storytelling mood product shot with warm tones', benefits: 'authentic lifestyle scene with product in natural setting' }
    },
    modern_ecommerce: {
        label: 'Modern Ecommerce',
        description: 'Professional product page with all key elements',
        layout: 'standard',
        blockOrder: ['hero', 'productGallery', 'benefits', 'variantSelector', 'codForm', 'testimonials', 'deliveryInfo', 'faq', 'trustBadges', 'guarantee'],
        theme: { primaryColor: '#2563eb', accentColor: '#10b981', backgroundColor: '#ffffff', textColor: '#1f2937', buttonStyle: 'rounded', layout: 'standard' },
        imagePrompts: { hero: 'professional studio product photography with gradient background', benefits: 'modern lifestyle flat lay with product' }
    },
    mobile_quick: {
        label: 'Mobile-first Quick Order',
        description: 'Optimized for mobile shoppers with fast checkout',
        layout: 'minimal',
        blockOrder: ['hero', 'productGallery', 'variantSelector', 'codForm', 'benefits', 'trustBadges'],
        theme: { primaryColor: '#059669', accentColor: '#f59e0b', backgroundColor: '#ffffff', textColor: '#1f2937', buttonStyle: 'pill', layout: 'minimal' },
        imagePrompts: { hero: 'mobile-optimized vertical product shot with clean background' }
    },
    traditional_artisan: {
        label: 'Traditional Artisan',
        description: 'Premium dark wood & gold theme — perfect for handcrafted and luxury products',
        layout: 'artisan',
        blockOrder: ['hero', 'benefits', 'productGallery', 'text', 'variantSelector', 'codForm', 'testimonials', 'guarantee', 'faq', 'deliveryInfo', 'trustBadges'],
        theme: { primaryColor: '#c9a84c', accentColor: '#d4af37', backgroundColor: '#1a1208', textColor: '#e8dcc8', buttonStyle: 'bordered', layout: 'artisan' },
        imagePrompts: { hero: 'dramatic dark background artisan product photography with golden warm lighting', benefits: 'close-up detail shot showing craftsmanship and quality materials with dark moody lighting' }
    }
};

// ── AI Analysis & Content Generation (Gemini 2.5 Flash) ─────────────────────

/**
 * Analyze product images and generate landing page content via Gemini 2.5 Flash vision.
 */
async function analyzeAndGenerate({ images, productName, productDescription, language, themeName }) {
    const ai = getAIClient();
    const template = THEME_TEMPLATES[themeName] || THEME_TEMPLATES.modern_ecommerce;

    // Build inline image parts for Gemini
    const imageParts = images.slice(0, 4).map(img => {
        let mimeType = 'image/jpeg';
        let base64Data = img;
        if (img.startsWith('data:')) {
            const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                base64Data = match[2];
            }
        }
        return { inlineData: { mimeType, data: base64Data } };
    });

    const lang = language === 'ar' ? 'Arabic' : language === 'fr' ? 'French' : 'English';
    const pageStyle = template.label;

    const prompt = `You are a world-class ecommerce copywriter, conversion rate optimizer, and brand strategist. You specialize in Cash-On-Delivery (COD) ecommerce in Algeria — you understand the Algerian consumer mindset, their objections, their desires, and the exact words that make them buy.

YOUR MISSION: Analyze the product image(s) with extreme attention to detail. Identify every visual cue — materials, textures, colors, craftsmanship, use cases. Then generate a COMPLETE, cohesive landing page that feels like it was designed by a top-tier agency specifically for this exact product.

CRITICAL RULES:
- Write ALL marketing copy in ${lang} — every single word must be in ${lang}
- This is a COD ecommerce page — customers pay cash on delivery, no credit cards
- Every piece of text must be SPECIFIC to this exact product — zero generic filler
- Use power words, emotional triggers, and urgency. Write like the best direct-response copywriters
- The headline must stop scrolling instantly. The subheadline must build desire
- Benefits must be tangible and specific (not "high quality" — instead "hand-stitched with genuine Italian leather that develops a rich patina over years of use")
- Testimonials must feel 100% real — use common Algerian names (Mohammed, Fatima, Youcef, Amina, Khaled, Nadia, etc.), mention specific details about the product they received, mention Algerian cities (Alger, Oran, Constantine, Setif, etc.)
- FAQ must address the TOP concerns of Algerian COD buyers: "Is it original?", "When will it arrive?", "Can I return it?", "Why should I trust you?", "Is it the same as the photo?"
- The guarantee text must eliminate ALL risk perception
- Urgency must feel real, not fake — reference limited artisan production, seasonal availability, or import batch limits
- Description should tell a STORY about the product — its origin, craftsmanship, what makes it special

Product info:${productName ? `\nProduct name: ${productName}` : ''}${productDescription ? `\nDescription: ${productDescription}` : ''}
Page style: ${pageStyle}
Language: ${lang}

OUTPUT FORMAT: Respond with ONLY valid JSON (no markdown, no code fences, no \`\`\`). Schema:

{
  "analysis": {
    "productType": "string (be very specific — e.g. 'handcrafted Damascus steel folding knife' not just 'knife')",
    "category": "string",
    "detectedColors": ["string (exact colors seen in the image)"],
    "materials": ["string (every material you can identify)"],
    "style": "string (describe the aesthetic/design language)",
    "useCases": ["string (specific real-world uses)"],
    "targetAudience": "string (who would buy this and why)",
    "pricePerception": "string (budget/mid-range/premium/luxury based on visual cues)"
  },
  "content": {
    "title": "string (compelling product title that includes key material/feature, max 80 chars)",
    "headline": "string (scroll-stopping hero headline — emotional hook that creates instant desire, max 100 chars)",
    "subheadline": "string (builds on headline — adds proof, specificity, or urgency, max 150 chars)",
    "ctaText": "string (action-oriented CTA — not just 'Order Now' but something specific like 'أطلب سكينك الآن', max 30 chars)",
    "description": "string (3-4 paragraph product story: origin → craftsmanship → experience → why buy now. Use line breaks. Must paint a vivid picture)",
    "benefits": [
      { "title": "string (specific, tangible benefit title)", "description": "string (2-3 sentences explaining this benefit with sensory details)", "icon": "check|truck|shield|star|zap|heart" }
    ],
    "testimonials": [
      { "name": "string (Algerian first name + city, e.g. 'محمد — الجزائر العاصمة')", "text": "string (2-3 sentences — mention specific product details they loved, how long they've had it, who they'd recommend it to)", "rating": 5 }
    ],
    "faq": [
      { "question": "string (real buyer objection phrased as a question)", "answer": "string (confident, specific answer that builds trust — mention guarantees, policies, specifics)" }
    ],
    "guaranteeTitle": "string (bold guarantee headline)",
    "guaranteeDescription": "string (detailed guarantee that eliminates all risk — mention return policy, exchange, refund)",
    "urgencyMessage": "string (believable scarcity/urgency — reference production limits, import batches, or seasonal availability)",
    "stockCount": "number (realistic stock number 5-25)",
    "deliveryTitle": "string (delivery section headline)",
    "deliveryTimeframe": "string (specific: '2-5 أيام عمل لجميع الولايات الـ 58')",
    "seo": {
      "title": "string (SEO page title with product + key benefit, max 60 chars)",
      "description": "string (meta description with emotional hook + CTA, max 155 chars)"
    }
  }
}`;

    const MAX_RETRIES = 2;
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    ...imageParts,
                    { text: prompt }
                ]
            });

            let raw = response.text;
            if (!raw) throw new AppError('AI generation failed — no response', 502, 'AI_NO_RESPONSE');

            // Strip markdown code fences if Gemini wraps the JSON
            raw = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

            try {
                return JSON.parse(raw);
            } catch (err) {
                logger.error({ raw, err }, 'Failed to parse AI response as JSON');
                throw new AppError('AI returned invalid content. Please try again.', 502, 'AI_PARSE_ERROR');
            }
        } catch (err) {
            lastError = err;
            if (err.statusCode) throw err;

            const is429 = err.message?.includes('429') || err.status === 429;
            if (is429 && attempt < MAX_RETRIES) {
                const waitSec = Math.min(30, 10 * (attempt + 1));
                logger.warn({ attempt, waitSec }, 'Gemini rate limit hit, retrying...');
                await new Promise(r => setTimeout(r, waitSec * 1000));
                continue;
            }

            if (is429) {
                throw new AppError('AI service is temporarily busy. Please wait a minute and try again.', 429, 'AI_RATE_LIMITED');
            }
            throw err;
        }
    }

    throw lastError;
}

// ── Nano Banana Image Generation (Gemini 3.1 Flash Image) ───────────────────

/**
 * Generate a single marketing image using Nano Banana 2.
 *
 * @param {Object} ai - GoogleGenAI client instance
 * @param {string} prompt - Image generation prompt
 * @param {string} [referenceImage] - Optional base64 reference product image
 * @param {string} [aspectRatio] - Aspect ratio (default: 16:9)
 * @returns {Promise<string|null>} Base64 data URL or null on failure
 */
async function generateSingleImage(ai, prompt, referenceImage, aspectRatio = '16:9') {
    try {
        const contents = [];

        // If we have a reference product image, include it for context
        if (referenceImage) {
            let mimeType = 'image/jpeg';
            let base64Data = referenceImage;
            if (referenceImage.startsWith('data:')) {
                const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/);
                if (match) {
                    mimeType = match[1];
                    base64Data = match[2];
                }
            }
            contents.push({ inlineData: { mimeType, data: base64Data } });
        }

        contents.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents,
            config: {
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: {
                    aspectRatio,
                    imageSize: '1K'
                }
            }
        });

        // Extract the generated image from response
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData?.data) {
                const mime = part.inlineData.mimeType || 'image/png';
                return `data:${mime};base64,${part.inlineData.data}`;
            }
        }

        return null;
    } catch (err) {
        logger.warn({ err: err.message, prompt: prompt.substring(0, 100) }, 'Nano Banana image generation failed — skipping');
        return null;
    }
}

/**
 * Generate all marketing images for the landing page using Nano Banana 2.
 *
 * Generates images in parallel for speed. Each image uses the product reference
 * for visual consistency. Returns a map of section -> base64 data URL.
 *
 * @param {Object} params
 * @param {Object} params.ai - GoogleGenAI client
 * @param {string} params.productName - Product name
 * @param {Object} params.aiAnalysis - AI analysis result (productType, category, etc.)
 * @param {Object} params.template - Theme template
 * @param {string} [params.referenceImage] - Base64 reference product image
 * @param {string} [params.language] - Content language
 * @returns {Promise<Object>} Map of { hero, benefits, guarantee, cta } -> base64 data URL
 */
async function generateMarketingImages({ ai, productName, aiAnalysis, template, referenceImage, language }) {
    const lang = language === 'ar' ? 'Arabic' : language === 'fr' ? 'French' : 'English';
    const productType = aiAnalysis?.productType || productName || 'product';
    const category = aiAnalysis?.category || '';
    const colors = (aiAnalysis?.detectedColors || []).join(', ');
    const themeImagePrompts = template.imagePrompts || {};

    const styleContext = `Product: ${productType}${category ? ` (${category})` : ''}${colors ? `. Product colors: ${colors}` : ''}. Content language: ${lang}.`;

    // Ultra-quality image prompts for EVERY section type
    const imageSpecs = {
        hero: {
            prompt: `Create a breathtaking, ultra-high-quality hero banner for a premium ecommerce landing page. ${styleContext} Visual direction: ${themeImagePrompts.hero || 'cinematic product photography with dramatic studio lighting, rich depth of field, and luxurious gradient backdrop'}. The product should be the absolute centerpiece — shot at a slight angle for dimensionality. Use professional studio lighting with key light from above-right, soft fill from the left, and a subtle rim light to separate from the background. Add a sophisticated gradient or textured background that complements the product colors. The overall mood should scream premium quality, trust, and desire. Ultra-sharp focus on the product, creamy bokeh in background. 8K quality render. ABSOLUTELY NO text, watermarks, logos, or overlays.`,
            aspectRatio: '16:9'
        },
        benefits: {
            prompt: `Create a stunning lifestyle marketing photograph showcasing ${productType} in an aspirational real-world setting. ${styleContext} Visual direction: ${themeImagePrompts.benefits || 'warm, inviting lifestyle scene with natural golden-hour lighting'}. Show the product being used naturally by a person or placed in an elegant lifestyle context that demonstrates its value. The scene should feel authentic yet premium — think high-end magazine editorial photography. Warm color grading, shallow depth of field on the background. Include environmental details that reinforce quality (polished surfaces, natural materials, soft fabrics). The image should instantly communicate "this product will improve your life". Professional color grading with lifted shadows. ABSOLUTELY NO text, watermarks, or overlays.`,
            aspectRatio: '16:9'
        },
        guarantee: {
            prompt: `Design an ultra-premium trust and satisfaction guarantee emblem for a luxury ecommerce brand. Create a photorealistic 3D golden shield or seal with intricate metallic detailing — think brushed gold with subtle engravings. Include a bold checkmark or star at the center. Add a subtle radial glow and soft shadow to give depth. The emblem should convey absolute trust, premium quality, and buyer confidence. Background should be clean (dark or white depending on theme). Photorealistic metallic rendering with reflections and micro-details. ABSOLUTELY NO text or letters.`,
            aspectRatio: '1:1'
        },
        testimonials: {
            prompt: `Create a warm, trustworthy background image for a customer testimonials section of a premium ecommerce page selling ${productType}. ${styleContext} Show a subtle, out-of-focus lifestyle scene — warm tones, soft bokeh lights, or an elegant abstract texture. The image should feel welcoming and authentic, evoking community and satisfaction. Use warm golden/amber tones with soft vignetting. The image must work as a subtle background behind text overlays — keep it slightly desaturated and not too busy. ABSOLUTELY NO text, faces, watermarks, or overlays.`,
            aspectRatio: '16:9'
        },
        faq: {
            prompt: `Create a clean, professional background image for a FAQ/knowledge section of a premium ecommerce page. ${styleContext} Design an elegant abstract pattern or subtle geometric design with soft gradients that suggest knowledge and clarity. Use muted versions of the product's color palette. Think: subtle paper texture, soft light rays, or minimal geometric shapes. The image must be calm and unobtrusive — it will sit behind text content. ABSOLUTELY NO text, icons, watermarks, or overlays.`,
            aspectRatio: '16:9'
        },
        deliveryInfo: {
            prompt: `Create a professional, trust-building image for a delivery information section of an Algerian ecommerce page selling ${productType}. Show a beautifully composed scene suggesting fast, reliable delivery — perhaps an elegant package or shipping box with premium wrapping, placed on a clean surface with soft natural lighting. The mood should convey speed, reliability, and care. Use warm, trustworthy color tones. Professional product photography style with shallow depth of field. ABSOLUTELY NO text, maps, logos, watermarks, or overlays.`,
            aspectRatio: '16:9'
        },
        cta: {
            prompt: `Create a striking, attention-grabbing background image for a call-to-action section of a premium ecommerce landing page selling ${productType}. ${styleContext} Design a bold, dramatic visual — think dynamic lighting, vibrant color accent, or a powerful abstract composition that creates urgency and excitement. The image should make the viewer want to take action immediately. Use high contrast, rich saturation, and dramatic light effects. Should work as a background behind a large CTA button. ABSOLUTELY NO text, watermarks, or overlays.`,
            aspectRatio: '16:9'
        },
        productGallery: {
            prompt: `Create a luxurious, premium product showcase environment image for ${productType}. ${styleContext} Design an elegant display surface or backdrop — polished marble, dark wood, brushed metal, or velvet fabric — with dramatic studio lighting that would make any product look expensive. Include subtle props that complement the product category (e.g., leather elements for accessories, natural wood for artisan goods). Moody, premium lighting with strong key light and soft shadows. This is a product stage/pedestal scene. ABSOLUTELY NO text, products, watermarks, or overlays — just the beautiful empty display environment.`,
            aspectRatio: '16:9'
        },
        stockScarcity: {
            prompt: `Create an urgent, dynamic background image for a scarcity/limited-stock section of a premium ecommerce page selling ${productType}. Design a dramatic visual that conveys exclusivity and urgency — think: spotlight on the last items, dramatic shadows, warm amber/red accent lighting. The mood should be "act now or miss out". Rich, moody atmosphere with high contrast. ABSOLUTELY NO text, numbers, watermarks, or overlays.`,
            aspectRatio: '16:9'
        },
        countdown: {
            prompt: `Create a dramatic, time-sensitive background image for a countdown/offer timer section. ${styleContext} Design a bold visual with dynamic elements suggesting the passage of time or urgency — dramatic radial lighting, bokeh particles, or abstract speed lines. Use warm urgent tones (amber, gold, deep red accents). The image should create psychological urgency. Premium quality, cinematic feel. ABSOLUTELY NO text, numbers, clocks, watermarks, or overlays.`,
            aspectRatio: '16:9'
        }
    };

    // Only generate images for sections that exist in the template's enabled blocks
    const blockSet = new Set(template.blockOrder);
    const tasks = {};

    for (const [key, spec] of Object.entries(imageSpecs)) {
        if (key === 'hero' || blockSet.has(key)) {
            tasks[key] = spec;
        }
    }

    // Generate all images in parallel
    logger.info({ imageCount: Object.keys(tasks).length }, 'Starting Nano Banana image generation');

    const entries = Object.entries(tasks);
    const results = await Promise.all(
        entries.map(([key, spec]) =>
            generateSingleImage(ai, spec.prompt, referenceImage, spec.aspectRatio)
                .then(dataUrl => [key, dataUrl])
        )
    );

    const imageMap = {};
    for (const [key, dataUrl] of results) {
        if (dataUrl) {
            imageMap[key] = dataUrl;
            logger.info({ section: key }, 'Nano Banana image generated');
        }
    }

    logger.info({ generated: Object.keys(imageMap).length, requested: entries.length }, 'Nano Banana image generation complete');
    return imageMap;
}

// ── Block Builder ───────────────────────────────────────────────────────────

/**
 * Convert AI-generated content + theme template into LandingPage blocks array.
 * When generatedImages are provided, they are injected into relevant blocks.
 */
function buildBlocks(aiResult, template, productImages, generatedImages = {}) {
    const { content } = aiResult;
    const blockOrder = template.blockOrder;

    const blockBuilders = {
        hero: () => ({
            id: uuidv4(), type: 'hero', isVisible: true,
            settings: {
                headline: content.headline || content.title || '',
                subheadline: content.subheadline || '',
                ctaText: content.ctaText || 'Order Now',
                backgroundImage: generatedImages.hero || productImages?.[0] || ''
            }
        }),
        productGallery: () => ({
            id: uuidv4(), type: 'productGallery', isVisible: true,
            settings: { layout: 'slider', showThumbnails: true, backgroundImage: generatedImages.productGallery || '' }
        }),
        benefits: () => ({
            id: uuidv4(), type: 'benefits', isVisible: true,
            settings: {
                backgroundImage: generatedImages.benefits || '',
                items: (content.benefits || []).map(b => ({
                    title: b.title,
                    description: b.description,
                    icon: b.icon || 'check'
                }))
            }
        }),
        variantSelector: () => ({
            id: uuidv4(), type: 'variantSelector', isVisible: true,
            settings: {}
        }),
        codForm: () => ({
            id: uuidv4(), type: 'codForm', isVisible: true,
            settings: {}
        }),
        testimonials: () => ({
            id: uuidv4(), type: 'testimonials', isVisible: true,
            settings: {
                backgroundImage: generatedImages.testimonials || '',
                items: (content.testimonials || []).map(t => ({
                    name: t.name,
                    text: t.text,
                    rating: t.rating || 5,
                    avatar: ''
                }))
            }
        }),
        faq: () => ({
            id: uuidv4(), type: 'faq', isVisible: true,
            settings: {
                backgroundImage: generatedImages.faq || '',
                items: (content.faq || []).map(f => ({
                    question: f.question,
                    answer: f.answer
                }))
            }
        }),
        guarantee: () => ({
            id: uuidv4(), type: 'guarantee', isVisible: true,
            settings: {
                title: content.guaranteeTitle || 'Satisfaction Guaranteed',
                description: content.guaranteeDescription || '',
                badgeImage: generatedImages.guarantee || ''
            }
        }),
        trustBadges: () => ({
            id: uuidv4(), type: 'trustBadges', isVisible: true,
            settings: { badges: ['secure', 'cod', 'fast-delivery', 'guarantee', 'original'] }
        }),
        deliveryInfo: () => ({
            id: uuidv4(), type: 'deliveryInfo', isVisible: true,
            settings: {
                backgroundImage: generatedImages.deliveryInfo || '',
                title: content.deliveryTitle || 'Delivery Information',
                wilayas: 'All 58 wilayas',
                timeframe: content.deliveryTimeframe || '2-5 business days'
            }
        }),
        countdown: () => ({
            id: uuidv4(), type: 'countdown', isVisible: true,
            settings: {
                backgroundImage: generatedImages.countdown || '',
                label: content.urgencyMessage || 'Offer ends soon!',
                endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
            }
        }),
        stockScarcity: () => ({
            id: uuidv4(), type: 'stockScarcity', isVisible: true,
            settings: {
                backgroundImage: generatedImages.stockScarcity || '',
                message: 'Only {count} left in stock!',
                count: content.stockCount || 15,
                showBar: true
            }
        }),
        cta: () => ({
            id: uuidv4(), type: 'cta', isVisible: true,
            settings: {
                backgroundImage: generatedImages.cta || '',
                text: content.ctaText || 'Order Now',
                style: 'primary',
                scrollTo: 'codForm'
            }
        }),
        text: () => ({
            id: uuidv4(), type: 'text', isVisible: true,
            settings: {
                content: content.description || '',
                alignment: 'left'
            }
        }),
        spacer: () => ({
            id: uuidv4(), type: 'spacer', isVisible: true,
            settings: { height: 40 }
        })
    };

    // Build blocks in template order — skip text duplicates
    let textUsed = false;
    const blocks = [];
    for (const blockType of blockOrder) {
        if (blockType === 'text' && textUsed) {
            blocks.push({
                id: uuidv4(), type: 'text', isVisible: true,
                settings: { content: '', alignment: 'center' }
            });
        } else {
            const builder = blockBuilders[blockType];
            if (builder) blocks.push(builder());
            if (blockType === 'text') textUsed = true;
        }
    }

    return blocks;
}

/**
 * Attempt to match product images to variant colors.
 * Returns a map: { variantId: imageUrl }
 */
function matchVariantImages(variants, aiAnalysis, productImages) {
    if (!variants?.length || !productImages?.length || !aiAnalysis?.detectedColors?.length) return {};

    const colorMap = {};
    const colors = aiAnalysis.detectedColors.map(c => c.toLowerCase());

    for (const variant of variants) {
        const attrs = variant.attributes || {};
        const colorAttr = attrs.Color || attrs.color || attrs.Colour || attrs.colour || '';
        if (!colorAttr) continue;

        const variantColor = colorAttr.toLowerCase();
        const matchIdx = colors.findIndex(c =>
            c.includes(variantColor) || variantColor.includes(c)
        );

        if (matchIdx >= 0 && productImages[matchIdx]) {
            colorMap[variant._id.toString()] = productImages[matchIdx];
        }
    }

    return colorMap;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a complete landing page using AI.
 *
 * @param {Object} params
 * @param {string} params.tenantId - Tenant ObjectId
 * @param {string} params.channelId - SalesChannel ObjectId
 * @param {string} [params.productId] - Existing product to use
 * @param {string[]} [params.images] - Base64 product images (max 4)
 * @param {string} [params.productName] - Product name hint
 * @param {string} [params.productDescription] - Short description hint
 * @param {string} [params.themeName] - Theme template key
 * @param {string} [params.language] - Content language (en/ar/fr)
 * @param {boolean} [params.generateImages] - Whether to generate images with Nano Banana (default: true)
 * @param {string[]} [params.enabledBlocks] - Which blocks to include (defaults to all in theme)
 * @returns {Promise<Object>} Created LandingPage document
 */
exports.generateLandingPage = async ({
    tenantId, channelId, productId, images, productName,
    productDescription, themeName, language, generateImages = true, enabledBlocks
}) => {
    // ── Validate channel ────────────────────────────────────────────────────
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null });
    if (!channel) throw AppError.notFound('Sales Channel');

    // ── Resolve product ─────────────────────────────────────────────────────
    let product, variants, productImages;

    if (productId) {
        product = await Product.findById(productId).lean();
        if (!product) throw AppError.notFound('Product');

        variants = await ProductVariant.find({ tenant: tenantId, productId: product._id, status: 'Active' })
            .select('sku attributes price images totalStock reservedStock')
            .lean();

        productImages = product.images || [];
        if (!productName) productName = product.name;
        if (!productDescription) productDescription = product.description;
    }

    // ── Determine images for AI analysis ────────────────────────────────────
    const rawImages = images?.length ? images : productImages || [];
    if (!rawImages.length) {
        throw AppError.validationFailed({ images: 'At least one product image is required. Upload images in the product settings or in the AI wizard.' });
    }
    // Convert local file URLs to base64 data-URIs for Gemini vision
    const analysisImages = rawImages.map(img => imageToBase64(img)).filter(Boolean);
    if (!analysisImages.length) {
        throw AppError.validationFailed({ images: 'Could not read any product images. Please re-upload them.' });
    }

    // ── AI Analysis & Content Generation ────────────────────────────────────
    let template = THEME_TEMPLATES[themeName] || THEME_TEMPLATES.modern_ecommerce;

    // ── Filter blocks based on user selection ─────────────────────────────
    if (enabledBlocks?.length) {
        // Always keep codForm and variantSelector — they're required for ordering
        const required = new Set(['codForm', 'variantSelector']);
        const enabled = new Set([...enabledBlocks, ...required]);
        template = { ...template, blockOrder: template.blockOrder.filter(b => enabled.has(b)) };
    }

    logger.info({ tenantId, channelId, productId, themeName, imageCount: analysisImages.length, generateImages, blockCount: template.blockOrder.length }, 'Starting AI page generation');

    const aiResult = await analyzeAndGenerate({
        images: analysisImages,
        productName,
        productDescription,
        language: language || 'en',
        themeName: themeName || 'modern_ecommerce'
    });

    logger.info({ tenantId, productType: aiResult.analysis?.productType }, 'AI analysis complete');

    // ── Nano Banana Image Generation ─────────────────────────────────────────
    let generatedImages = {};
    if (generateImages) {
        try {
            const ai = getAIClient();
            const rawImages = await generateMarketingImages({
                ai,
                productName: productName || aiResult.analysis?.productType || 'product',
                aiAnalysis: aiResult.analysis,
                template,
                referenceImage: analysisImages[0],
                language: language || 'en'
            });
            // Persist base64 images to disk — replace data-URIs with file paths
            generatedImages = persistImageMap(rawImages);
            logger.info({ persisted: Object.keys(generatedImages).length }, 'AI images saved to disk');
        } catch (err) {
            // Image generation is non-critical — log and continue without images
            logger.warn({ err: err.message }, 'Nano Banana image generation failed — continuing without AI images');
        }
    }

    // ── Build page blocks ───────────────────────────────────────────────────
    const blocks = buildBlocks(aiResult, template, productImages || images, generatedImages);

    // ── Variant image matching ──────────────────────────────────────────────
    const variantImageMap = matchVariantImages(variants, aiResult.analysis, productImages);

    // ── Determine title and slug ────────────────────────────────────────────
    const pageTitle = aiResult.content?.title || productName || 'AI Generated Page';
    const slug = pageTitle
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 80)
        + '-' + Date.now().toString(36);

    // ── Create the page ─────────────────────────────────────────────────────
    if (!productId) {
        throw AppError.validationFailed({
            productId: 'A product must be selected from the catalog. Image-only generation without a catalog product is planned for a future release.'
        });
    }

    const page = await LandingPage.create({
        tenant: tenantId,
        salesChannel: channelId,
        product: productId,
        title: pageTitle,
        slug,
        seo: aiResult.content?.seo || {},
        blocks,
        productOverrides: {
            displayName: aiResult.content?.title || undefined,
            description: aiResult.content?.description || undefined,
            showOriginalPrice: true,
            showStockLevel: template.blockOrder.includes('stockScarcity')
        },
        variantDisplay: {
            style: 'buttons',
            showPrice: true,
            showStock: false,
            showImages: true
        },
        formConfig: {
            submitButtonText: aiResult.content?.ctaText || 'Order Now',
            successMessage: language === 'ar'
                ? 'تم تسجيل طلبك بنجاح! سنتصل بك قريبا.'
                : language === 'fr'
                    ? 'Commande enregistrée avec succès ! Nous vous contacterons bientôt.'
                    : 'Order placed successfully! We will contact you shortly.',
            enableDuplicateDetection: true,
            enableFraudCheck: true,
            maxQuantity: 10
        },
        theme: template.theme,
        status: 'draft'
    });

    // Increment channel stats
    await SalesChannel.updateOne({ _id: channelId }, { $inc: { 'stats.totalPages': 1 } });

    logger.info({
        tenantId,
        pageId: page._id,
        title: pageTitle,
        aiImagesGenerated: Object.keys(generatedImages).length
    }, 'AI landing page created');

    return {
        page,
        aiAnalysis: aiResult.analysis,
        variantImageMap,
        generatedImageCount: Object.keys(generatedImages).length
    };
};

/**
 * Return available theme templates for the frontend selector.
 */
exports.getThemeTemplates = () => {
    return Object.entries(THEME_TEMPLATES).map(([key, val]) => ({
        key,
        label: val.label,
        description: val.description,
        layout: val.layout,
        blockOrder: val.blockOrder,
        blockCount: val.blockOrder.length,
        theme: val.theme
    }));
};
