
import { GoogleGenAI, Modality } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async getLocationInsights(lat: number, lng: number): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I am currently at latitude ${lat}, longitude ${lng}. 
                   Briefly describe this general area in Bengali. 
                   Focus on potential landmarks or interesting geographical features if known.
                   Limit to 2-3 sentences.`,
        config: {
          systemInstruction: "You are a helpful travel assistant. Always reply in Bengali.",
        }
      });
      return response.text || "দুঃখিত, কোনো তথ্য পাওয়া যায়নি।";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "AI তথ্য লোড করতে ব্যর্থ হয়েছে।";
    }
  }

  async chatAboutLocation(lat: number, lng: number, message: string): Promise<string> {
    try {
      const chat = this.ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: `You are Locus Assistant. The user is at coordinates ${lat}, ${lng}. 
                              Help them find nearby places or explain coordinates. 
                              Respond in Bengali only.`,
        }
      });
      const result = await chat.sendMessage({ message });
      return result.text || "আমি বুঝতে পারছি না।";
    } catch (error) {
      return "চ্যাট সার্ভিস বর্তমানে বন্ধ আছে।";
    }
  }

  async generateVoiceGuidance(userLat: number, userLng: number, friendLat: number, friendLng: number, distance: number): Promise<string | undefined> {
    try {
      const distStr = distance < 1 ? `${(distance * 1000).toFixed(0)} meters` : `${distance.toFixed(2)} kilometers`;
      const prompt = `Act as a tracking assistant. The user's friend is ${distStr} away.
                      Generate a short voice guidance in BOTH English and Bengali.
                      Example: "Target found. Your friend is ${distStr} away. Open navigation to reach them quickly. টার্গেট পাওয়া গেছে। আপনার বন্ধু ${distStr} দূরে আছেন। দ্রুত পৌঁছাতে নেভিগেশন ব্যবহার করুন।"
                      Keep it helpful and energetic.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error) {
      console.error("TTS Error:", error);
      return undefined;
    }
  }
}

export const geminiService = new GeminiService();
