import { env } from '../config/env';

export type ProviderType = 'mock' | 'gemini';

export interface AIProviderResponse {
  message: string;
  provider: ProviderType;
  model?: string;
}

export interface AIProvider {
  generateResponse(prompt: string, context?: Record<string, any>): Promise<AIProviderResponse>;
}

export class MockAIProvider implements AIProvider {
  async generateResponse(prompt: string, context?: Record<string, any>): Promise<AIProviderResponse> {
    const lowerPrompt = prompt.toLowerCase();
    const intent = context?.intent || 'general';

    let message = '';

    if (intent === 'handover_help') {
      message =
        'To hand over e-waste on Kabadiwala Connect, follow these steps:\n' +
        '1. Add E-Waste: Log in to your collector account and record your available e-waste items with estimated weights.\n' +
        '2. Find Recycler: Browse authorized recyclers in the catalog that accept your material types.\n' +
        '3. Send Handover Request: Select your items and submit a handover request to the chosen recycler.\n' +
        '4. Recycler Accepts: The recycler reviews and accepts your request.\n' +
        '5. Schedule Handover: The recycler specifies an agreeable pickup/dropoff date and time.\n' +
        '6. In Transit: When the handover begins, the request status updates to in-transit.\n' +
        '7. Complete Handover: Both parties verify items, and the handover is marked completed.\n' +
        '8. Records & Settlement: A tamper-evident Digital Handover Record and completed Transaction record with earnings are automatically generated.';
    } else if (intent === 'material_info') {
      message =
        'Kabadiwala Connect supports verified e-waste categories including:\n' +
        '- Motherboards & PCBs\n' +
        '- CRT & LCD Monitors\n' +
        '- Lead-Acid Batteries\n' +
        '- Copper Cables & Wiring\n' +
        '- Mobile Phones & Tablets\n' +
        '- Laptops & Computers\n' +
        '- Mixed Electronic Scrap\n\n' +
        'Prices displayed on the platform are indicative platform rates per kilogram to ensure transparent and fair trade between collectors and recyclers.';
    } else if (intent === 'recycler_help') {
      message =
        'Authorized recyclers on Kabadiwala Connect are verified facilities with valid processing capabilities. ' +
        'You can browse their accepted materials, operating hours, and user ratings directly in the platform catalog. ' +
        'To initiate contact, simply select your cataloged e-waste and send a handover request through the application.';
    } else if (intent === 'transaction_help') {
      message =
        'Transactions on Kabadiwala Connect are automatically recorded upon successful completion of a handover. ' +
        'Each transaction generates a unique transaction reference (e.g. TXN-YYYY-XXXXXXXX) documenting the settled amount, ' +
        'item breakdown, and participant IDs for full accounting transparency.';
    } else if (intent === 'account_help') {
      message =
        'Kabadiwala Connect provides role-based accounts for informal waste collectors and authorized recyclers. ' +
        'Collectors can manage waste inventory and track earnings, while recyclers can manage incoming requests, ' +
        'scheduling, and digital compliance records.';
    } else if (intent === 'platform_help') {
      message =
        'Kabadiwala Connect is a digital platform designed to formalize informal e-waste collection. ' +
        'It connects grassroots collectors with authorized recyclers, guaranteeing fair pricing, safe disposal, ' +
        'and transparent digital documentation.';
    } else {
      message =
        'I am KabiAI, your assistant for Kabadiwala Connect. I can assist you with questions about e-waste materials, ' +
        'finding authorized recyclers, the digital handover process, or tracking transactions and earnings. ' +
        'How can I help you today?';
    }

    return {
      message,
      provider: 'mock',
      model: 'mock-kabi-v1',
    };
  }
}

export class GeminiAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateResponse(prompt: string, context?: Record<string, any>): Promise<AIProviderResponse> {
    const systemInstruction = `You are KabiAI, the intelligent assistant for the Kabadiwala Connect platform.
Kabadiwala Connect is a digital bridge connecting informal e-waste collectors with verified, authorized recyclers in India (demonstrated for Hyderabad and surrounding areas).

Domain Knowledge:
1. Core Workflow:
   - Step 1 (Add E-Waste): Collectors log collected items with weight into their digital inventory. Server calculates indicative valuation based on market rates.
   - Step 2 (Find Recyclers): Collectors discover nearby verified recyclers using geospatial distance.
   - Step 3 (Handover Request): Collectors select inventory items and request pickup/dropoff.
   - Step 4 (Recycler Accepts/Rejects): Authorized recycler evaluates request.
   - Step 5 (Schedule Pickup): Recycler assigns an agreeable pickup date.
   - Step 6 (In-Transit): Material handover is underway.
   - Step 7 (Complete Handover): Verified by both parties upon inspection.
   - Step 8 (Records & Settlement): A unique tamper-evident Digital Handover Record (KBC-YYYY-XXXXXXXX) and Transaction (TXN-YYYY-XXXXXXXX) are generated.
2. Verified Materials:
   - Motherboards & PCBs, CRT & LCD Monitors, Lead-Acid Batteries, Copper Cables & Wiring, Mobile Phones & Tablets, Laptops & Computers, Mixed Electronic Scrap.
3. Indicative platform rates per kg ensure transparent negotiation.

Strict Guardrails:
- DO NOT invent or guarantee specific real-world legal certifications, government EPR compliance certificates, or municipal GHMC tie-ups unless confirmed.
- DO NOT fabricate fake payment confirmations or claim financial transactions occurred outside the simulated settlement.
- DO NOT claim to track users via real-time live GPS or promise real-time truck routing.
- DO NOT hallucinate private facility details or unlisted prices. If platform data is not available, explicitly inform the user to check the platform directory or contact support.
- Be concise, helpful, professional, and empathetic to grassroots informal waste collectors.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          return {
            message: 'KabiAI is currently handling a high volume of requests. Please try again in a few moments.',
            provider: 'gemini',
            model: this.model,
          };
        }
        if (status === 400 || status === 403) {
          console.error(`Gemini API authorization error (status ${status})`);
          return {
            message: 'The AI assistant service encountered an authentication issue. Please contact the administrator.',
            provider: 'gemini',
            model: this.model,
          };
        }
        console.error(`Gemini API error (status ${status})`);
        return {
          message: 'I apologize, but I am having trouble connecting to the AI service right now. Please try again shortly.',
          provider: 'gemini',
          model: this.model,
        };
      }

      const data = (await response.json()) as any;
      const candidateText =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        'I received your message, but no response text was generated. Please try rephrasing your question.';

      return {
        message: candidateText.trim(),
        provider: 'gemini',
        model: this.model,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return {
          message: 'The AI assistant request timed out. Please try asking your question again.',
          provider: 'gemini',
          model: this.model,
        };
      }
      console.error('Gemini provider error:', err.message || 'Unknown network error');
      return {
        message: 'A network error occurred while reaching KabiAI. Please check your connection and try again.',
        provider: 'gemini',
        model: this.model,
      };
    }
  }
}

/**
 * Provider factory
 * Instantiates GeminiAIProvider when configured with GEMINI_API_KEY, cleanly defaulting to MockAIProvider.
 */
let currentProvider: AIProvider | null = null;

export const getAIProvider = (): AIProvider => {
  if (currentProvider) {
    return currentProvider;
  }

  if (env.AI_PROVIDER === 'gemini') {
    if (!env.GEMINI_API_KEY) {
      console.warn('⚠️ GEMINI_API_KEY not configured. Falling back to MockAIProvider.');
      currentProvider = new MockAIProvider();
    } else {
      currentProvider = new GeminiAIProvider(env.GEMINI_API_KEY);
    }
  } else {
    currentProvider = new MockAIProvider();
  }

  return currentProvider;
};

// Helper for testing to inject or reset provider
export const setAIProvider = (provider: AIProvider | null): void => {
  currentProvider = provider;
};
