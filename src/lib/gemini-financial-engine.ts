import { GoogleGenAI, Type } from "@google/genai";

export interface ParsedTransaction {
  type: "expense" | "income";
  amount: number;
  categoryName: string;
  note: string;
  dateStr: string; // YYYY-MM-DD
  isEssential: boolean;
  paymentType: string;
}

// Fallback regex parser for instant offline / client-side parsing
export function parseNaturalLanguageOffline(text: string, existingCategories: string[]): ParsedTransaction {
  const clean = text.toLowerCase().trim();

  // Detect Income vs Expense
  const isIncome = /\b(salary|received|earned|income|freelance|bonus|cashback|refund|credited|got)\b/.test(clean);

  // Extract amount ($45, 450, 45.50, INR 500, Rs 500)
  const amountMatch = clean.match(/(?:[₹$€£]|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  // Extract Date
  let dateObj = new Date();
  if (clean.includes("yesterday")) {
    dateObj.setDate(dateObj.getDate() - 1);
  } else if (clean.includes("last friday")) {
    const day = dateObj.getDay();
    const diff = (day + 2) % 7 || 7;
    dateObj.setDate(dateObj.getDate() - diff);
  }
  const dateStr = dateObj.toISOString().slice(0, 10);

  // Match Category
  let categoryName = isIncome ? "Income" : "Groceries & Food";
  for (const cat of existingCategories) {
    const catLower = cat.toLowerCase();
    if (clean.includes(catLower)) {
      categoryName = cat;
      break;
    }
  }

  if (categoryName === "Groceries & Food") {
    if (/\b(rent|electricity|water|wifi|bill|utility)\b/.test(clean)) categoryName = "Rent & Utilities";
    else if (/\b(fuel|petrol|cab|uber|transport|bus|flight)\b/.test(clean)) categoryName = "Transport & Fuel";
    else if (/\b(doctor|pharmacy|medicine|hospital|health)\b/.test(clean)) categoryName = "Healthcare & Meds";
    else if (/\b(restaurant|coffee|cafe|swiggy|zomato|dining|pizza|dinner)\b/.test(clean)) categoryName = "Dining & Outing";
    else if (/\b(movie|game|netflix|spotify|fun|entertainment)\b/.test(clean)) categoryName = "Entertainment & Fun";
    else if (/\b(clothes|amazon|shopping|shirt|shoes)\b/.test(clean)) categoryName = "Shopping & Clothes";
  }

  // Non-essential if dining, entertainment, shopping
  const isEssential = !["Dining & Outing", "Entertainment & Fun", "Shopping & Clothes"].includes(categoryName);

  // Payment method
  let paymentType = "card";
  if (/\b(cash)\b/.test(clean)) paymentType = "cash";
  if (/\b(upi|gpay|paytm|phonepe)\b/.test(clean)) paymentType = "online";
  if (/\b(bank|transfer)\b/.test(clean)) paymentType = "bank_transfer";

  // Clean note
  const note = text.length > 50 ? text.slice(0, 50) : text;

  return {
    type: isIncome ? "income" : "expense",
    amount,
    categoryName,
    note,
    dateStr,
    isEssential,
    paymentType,
  };
}

export async function parseWithGeminiAI(
  inputText: string,
  categories: string[],
): Promise<ParsedTransaction> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return parseNaturalLanguageOffline(inputText, categories);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" },
      },
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Parse this transaction log entry: "${inputText}". 
Available categories: ${categories.join(", ")}.
Return structured JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: "'expense' or 'income'" },
            amount: { type: Type.NUMBER, description: "Numerical value" },
            categoryName: { type: Type.STRING, description: "Best matching category" },
            note: { type: Type.STRING, description: "Short description or merchant name" },
            dateStr: { type: Type.STRING, description: "YYYY-MM-DD" },
            isEssential: { type: Type.BOOLEAN },
            paymentType: { type: Type.STRING, description: "'cash', 'card', 'online', or 'bank_transfer'" },
          },
          required: ["type", "amount", "categoryName", "note", "dateStr", "isEssential", "paymentType"],
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text.trim());
      return {
        type: parsed.type === "income" ? "income" : "expense",
        amount: Number(parsed.amount) || 0,
        categoryName: parsed.categoryName || categories[0] || "General",
        note: parsed.note || inputText,
        dateStr: parsed.dateStr || new Date().toISOString().slice(0, 10),
        isEssential: Boolean(parsed.isEssential),
        paymentType: parsed.paymentType || "card",
      };
    }
  } catch (err) {
    console.warn("Gemini AI parse failed, using fallback:", err);
  }

  return parseNaturalLanguageOffline(inputText, categories);
}

export async function generateCopilotAdvice(
  prompt: string,
  contextData: any,
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    // High quality offline contextual answer generator
    const lower = prompt.toLowerCase();
    const totalExp = contextData?.totals?.expenses ?? 0;
    const totalInc = contextData?.totals?.income ?? 0;
    const balance = contextData?.totals?.balance ?? 0;
    const curr = contextData?.currency ?? "INR";

    if (lower.includes("spend") || lower.includes("biggest") || lower.includes("category")) {
      const topCat = contextData?.byCategory?.[0];
      if (topCat) {
        return `📊 Your top expense category this cycle is **${topCat.name}** at **${curr} ${topCat.spent.toLocaleString()}**. Total spending across all categories is **${curr} ${totalExp.toLocaleString()}**.`;
      }
      return `📊 You've spent a total of **${curr} ${totalExp.toLocaleString()}** so far this cycle.`;
    }

    if (lower.includes("afford") || lower.includes("trip") || lower.includes("buy")) {
      const burnRate = contextData?.prediction?.burnRate ?? 0;
      if (balance > 500) {
        return `✅ Based on your current surplus of **${curr} ${balance.toLocaleString()}** and daily burn rate of **${curr} ${Math.round(burnRate)}**, you have sufficient liquidity for planned discretionary purchases!`;
      }
      return `⚠️ Your current balance is **${curr} ${balance.toLocaleString()}**. With a daily burn rate of **${curr} ${Math.round(burnRate)}**, we recommend holding off on large discretionary expenses until next cycle.`;
    }

    if (lower.includes("save") || lower.includes("tip") || lower.includes("cut")) {
      const nonEss = contextData?.totals?.nonEssential ?? 0;
      return `💡 **Smart Savings Action Plan:**\n1. Discretionary spending is currently **${curr} ${nonEss.toLocaleString()}** (${Math.round((nonEss / (totalExp || 1)) * 100)}% of total expenses).\n2. Capping non-essential dining and entertainment by 20% would save you approx **${curr} ${Math.round(nonEss * 0.2).toLocaleString()}** monthly!`;
    }

    return `🤖 **Pocket Copilot Snapshot:**\n- Monthly Income: **${curr} ${totalInc.toLocaleString()}**\n- Expenses: **${curr} ${totalExp.toLocaleString()}**\n- Net Surplus: **${curr} ${balance.toLocaleString()}**\n\nAsk me specific questions like "Can I afford ${curr} 200?" or "Where am I spending the most?"`;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: `You are Google/Amazon level financial copilot inside PocketPlanner.
User financial context: ${JSON.stringify(contextData)}.
Provide concise, clear, actionable bullet points formatted with markdown. Be encouraging, realistic, and highly practical.`,
      },
    });

    return response.text || "Could not generate AI advice.";
  } catch (err: any) {
    return `Note: ${err.message || "Failed to reach Gemini server."}`;
  }
}
