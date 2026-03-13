/**
 * MessageService — handles customer notifications (SMS / WhatsApp).
 *
 * Currently supports:
 *   - Console logging (development fallback)
 *   - Generic HTTP-based SMS gateway (configurable via env)
 *
 * Template-based: each message type has a pre-built template with
 * variable interpolation for order/customer/tracking data.
 *
 * Usage:
 *   const { sendMessage } = require('./messageService');
 *   await sendMessage('order_confirmed', { phone, customerName, orderId, ... });
 */

const logger = require('../shared/logger');

// ─── Templates ───────────────────────────────────────────────────────────────

const TEMPLATES = {
    order_confirmed: {
        ar: ({ customerName, orderId }) =>
            `مرحباً ${customerName}، تم تأكيد طلبك رقم ${orderId} بنجاح. سيتم شحنه قريباً. شكراً لثقتك!`,
        fr: ({ customerName, orderId }) =>
            `Bonjour ${customerName}, votre commande ${orderId} est confirmée. Elle sera expédiée bientôt. Merci!`,
    },

    order_dispatched: {
        ar: ({ customerName, orderId, courierName }) =>
            `${customerName}، تم شحن طلبك رقم ${orderId} عبر ${courierName || 'شركة التوصيل'}. سيصلك قريباً!`,
        fr: ({ customerName, orderId, courierName }) =>
            `${customerName}, votre commande ${orderId} a été expédiée via ${courierName || 'le transporteur'}. Elle arrivera bientôt!`,
    },

    order_in_city: {
        ar: ({ customerName, orderId, wilaya }) =>
            `${customerName}، طلبك رقم ${orderId} وصل إلى ${wilaya}. يرجى التحضر لاستلامه. شكراً!`,
        fr: ({ customerName, orderId, wilaya }) =>
            `${customerName}, votre commande ${orderId} est arrivée à ${wilaya}. Préparez-vous pour la recevoir. Merci!`,
    },

    out_for_delivery: {
        ar: ({ customerName, orderId }) =>
            `${customerName}، طلبك رقم ${orderId} في الطريق إليك الآن! يرجى التواجد لاستلامه.`,
        fr: ({ customerName, orderId }) =>
            `${customerName}, votre commande ${orderId} est en cours de livraison! Veuillez être disponible.`,
    },

    answer_delivery_call: {
        ar: ({ customerName, orderId }) =>
            `${customerName}، مندوب التوصيل يحاول الوصول إليك لتسليم طلبك رقم ${orderId}. يرجى الرد على المكالمة!`,
        fr: ({ customerName, orderId }) =>
            `${customerName}, le livreur essaie de vous joindre pour la commande ${orderId}. Merci de répondre à l'appel!`,
    },

    failed_delivery_attempt: {
        ar: ({ customerName, orderId }) =>
            `${customerName}، لم نتمكن من تسليم طلبك رقم ${orderId}. سنحاول مرة أخرى. يرجى التأكد من تواجدك والرد على مكالمة المندوب.`,
        fr: ({ customerName, orderId }) =>
            `${customerName}, nous n'avons pas pu livrer votre commande ${orderId}. Nous réessayerons. Merci de rester disponible.`,
    },

    pickup_reminder: {
        ar: ({ customerName, orderId, address }) =>
            `${customerName}، طلبك رقم ${orderId} جاهز للاستلام من ${address || 'نقطة الاستلام'}. يرجى استلامه في أقرب وقت.`,
        fr: ({ customerName, orderId, address }) =>
            `${customerName}, votre commande ${orderId} est prête au retrait à ${address || 'point de retrait'}. Récupérez-la dès que possible.`,
    },

    custom: {
        ar: ({ message }) => message,
        fr: ({ message }) => message,
    },
};

// ─── Send Logic ──────────────────────────────────────────────────────────────

/**
 * Build the message text from a template.
 * @param {string} templateKey — one of TEMPLATES keys
 * @param {object} vars — interpolation variables
 * @param {string} [lang='ar'] — 'ar' or 'fr'
 * @returns {string} rendered message
 */
function renderTemplate(templateKey, vars, lang = 'ar') {
    const tpl = TEMPLATES[templateKey];
    if (!tpl) throw new Error(`Unknown message template: ${templateKey}`);
    const renderer = tpl[lang] || tpl.ar;
    return renderer(vars);
}

/**
 * Send a message to a customer.
 *
 * In production, this integrates with an SMS gateway (env: SMS_GATEWAY_URL,
 * SMS_API_KEY). In dev, it logs to console.
 *
 * @param {object} opts
 * @param {string} opts.phone — recipient phone number
 * @param {string} opts.templateKey — template name
 * @param {object} opts.vars — template variables
 * @param {string} [opts.lang='ar'] — language
 * @param {string} [opts.channel='sms'] — 'sms' or 'whatsapp'
 * @returns {{ success: boolean, messageText: string, channel: string, provider?: string }}
 */
async function sendMessage({ phone, templateKey, vars, lang = 'ar', channel = 'sms' }) {
    const messageText = renderTemplate(templateKey, vars, lang);

    const gatewayUrl = process.env.SMS_GATEWAY_URL;
    const apiKey = process.env.SMS_API_KEY;
    const senderName = process.env.SMS_SENDER_NAME || 'CODFlow';

    if (gatewayUrl && apiKey) {
        try {
            const response = await fetch(gatewayUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    to: phone,
                    message: messageText,
                    sender: senderName,
                    channel,
                }),
                signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                logger.warn({ status: response.status, body }, 'SMS gateway returned non-OK');
                return { success: false, messageText, channel, error: `Gateway error: ${response.status}` };
            }

            logger.info({ phone: phone.slice(-4), template: templateKey }, 'SMS sent successfully');
            return { success: true, messageText, channel, provider: 'gateway' };
        } catch (err) {
            logger.error({ err, template: templateKey }, 'SMS gateway request failed');
            return { success: false, messageText, channel, error: err.message };
        }
    }

    // Development fallback — log to console
    logger.info({ phone: phone.slice(-4), template: templateKey, messageText }, 'SMS (dev mode — no gateway configured)');
    return { success: true, messageText, channel, provider: 'dev-log' };
}

/**
 * List available template keys with descriptions.
 */
function getTemplates() {
    return Object.keys(TEMPLATES).map(key => ({
        key,
        hasAr: !!TEMPLATES[key].ar,
        hasFr: !!TEMPLATES[key].fr,
    }));
}

module.exports = { sendMessage, renderTemplate, getTemplates, TEMPLATES };
