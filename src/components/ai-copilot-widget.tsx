import { useState } from "react";
import { Sparkles, Bot, Send, Loader2, Lightbulb, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateCopilotAdvice } from "@/lib/gemini-financial-engine";

interface AICopilotWidgetProps {
  contextData: any;
}

export function AICopilotWidget({ contextData }: AICopilotWidgetProps) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "👋 Hi! I'm your **Pocket Copilot**. Ask me anything about your household finances or try a quick suggestion below!",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const quickPrompts = [
    "📊 What's my biggest expense category?",
    "💡 Give me 3 tips to save $300",
    "✈️ Can I afford a $200 weekend trip?",
  ];

  const handleSend = async (textToSend?: string) => {
    const q = textToSend || prompt;
    if (!q.trim() || loading) return;

    const userMsg = { role: "user" as const, text: q };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    setLoading(true);

    const reply = await generateCopilotAdvice(q, contextData);
    setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    setLoading(false);
  };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold flex items-center gap-1.5">
              Gemini Financial Copilot
              <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                PRO AI
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">Contextual intelligence & instant answers</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="space-y-4">
          <div className="max-h-60 overflow-y-auto space-y-3 pr-1 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                    <Sparkles className="size-3.5" />
                  </div>
                )}
                <div
                  className={`rounded-xl p-3 max-w-[85%] leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-muted/50 text-foreground border"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                Gemini is analyzing your transaction records...
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {quickPrompts.map((qp) => (
              <button
                key={qp}
                onClick={() => handleSend(qp)}
                className="rounded-lg border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all flex items-center gap-1"
              >
                <Lightbulb className="size-3 text-amber-500" />
                {qp}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask Copilot a financial question..."
              className="text-xs h-9 rounded-xl"
            />
            <Button size="sm" className="h-9 px-3 rounded-xl gap-1" onClick={() => handleSend()} disabled={loading}>
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
