import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function listModels() {
  // Access the model manager (this is hypothetical as the SDK wrapper might differ slightly)
  // Actually the SDK documentation says we can use makeRequest or similar, 
  // but looking at recent SDK versions we might just try 'gemini-pro' as a fallback.
  // BUT the error suggested `Call ListModels`. 
  // The Node SDK usually exposes it via `getGenerativeModel` but doesn't output list directly.
  // Wait, I can try to make a raw request or try a known older model 'gemini-pro'.
  
  // Let's try 'gemini-pro' in this script as a quick check, and also try to use the raw API.
  
  try {
      // Actually standard way in newer SDK:
      // There isn't a direct listModels on the high level client in some versions.
      // I'll try 'gemini-pro' first.
      console.log("Testing 'gemini-pro'...");
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent("Hello");
      console.log("Success with gemini-pro:", result.response.text());
  } catch (e: any) {
      console.log("Failed with gemini-pro:", e.message);
  }

  try {
      console.log("Testing 'gemini-1.5-pro-latest'...");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
      const result = await model.generateContent("Hello");
      console.log("Success with gemini-1.5-pro-latest:", result.response.text());
  } catch (e: any) {
      console.log("Failed with gemini-1.5-pro-latest:", e.message);
  }
}

listModels();
