import { useState, useEffect } from "react";
import { Mic, MicOff, Sparkles, Command, Check, ArrowRight, Loader2, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { parseWithGeminiAI, ParsedTransaction } from "@/lib/gemini-financial-engine";
import { saveExpense, saveIncome } from "@/lib/pocket.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/audit-and-export";

interface AICommandBarProps {
  categories: { id: string; name: string }[];
  members: { id: string; name: string }[];
  currency?: string;
}

export function AICommandBar({ categories, members, currency = "INR" }: AICommandBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedTransaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const queryClient = useQueryClient();

  // Listen for Cmd+K or Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Voice Recognition Handler
  const toggleListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Web Speech API is not supported in this browser environment.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        toast.info("Listening... Speak your expense now.");
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        setQuery(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
        toast.error("Speech recognition error. Please try again.");
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      toast.error("Could not activate microphone.");
    }
  };

  const handleParse = async () => {
    if (!query.trim()) return;
    setIsParsing(true);
    setParsedResult(null);

    const categoryNames = categories.map((c) => c.name);
    const result = await parseWithGeminiAI(query, categoryNames);

    setIsParsing(false);
    setParsedResult(result);
  };

  const handleConfirmSave = async () => {
    if (!parsedResult || parsedResult.amount <= 0) {
      toast.error("Valid amount is required");
      return;
    }

    setIsSaving(true);
    try {
      const matchedCategory = categories.find(
        (c) => c.name.toLowerCase() === parsedResult.categoryName.toLowerCase(),
      );

      if (parsedResult.type === "expense") {
        await saveExpense({
          data: {
            amount: parsedResult.amount,
            categoryId: matchedCategory ? matchedCategory.id : categories[0]?.id || null,
            occurredOn: parsedResult.dateStr,
            note: parsedResult.note,
            paymentType: parsedResult.paymentType,
            spenderId: members[0]?.id || null,
            beneficiaryId: null,
            isShared: true,
            isEssential: parsedResult.isEssential,
          },
        });
        logAuditEvent("VOICE_AI_EXPENSE_ADDED", "TRANSACTION", `Logged ${parsedResult.amount} ${parsedResult.note} via AI Voice/NLP`);
      } else {
        await saveIncome({
          data: {
            amount: parsedResult.amount,
            occurredOn: parsedResult.dateStr,
            source: parsedResult.note || "AI Voice Entry",
            frequency: "irregular",
            memberId: members[0]?.id || null,
          },
        });
        logAuditEvent("VOICE_AI_INCOME_ADDED", "TRANSACTION", `Logged income ${parsedResult.amount} via AI Voice/NLP`);
      }

      toast.success(
        `Saved ${parsedResult.type.toUpperCase()}: ${currency} ${parsedResult.amount} (${parsedResult.categoryName})`,
      );

      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });

      setOpen(false);
      setQuery("");
      setParsedResult(null);
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Trigger Button in Navigation or Floating Header */}
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-primary/10 shadow-sm transition-all"
      >
        <Sparkles className="size-4 text-primary animate-pulse" />
        <span className="hidden sm:inline">AI Voice & Text Log</span>
        <span className="sm:hidden">AI Log</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 md:flex">
          <Command className="size-3" />K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="size-5 text-primary" /> Gemini Voice & Quick Command Bar
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Speak or type naturally (e.g., "Paid 450 for groceries yesterday" or "Received 25000 salary").
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="relative flex items-center">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleParse()}
                placeholder="Type or click mic to speak..."
                className="pr-20 text-sm h-11 rounded-xl"
                autoFocus
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "ghost"}
                  size="icon"
                  className={`size-8 rounded-lg ${isListening ? "animate-pulse" : ""}`}
                  onClick={toggleListening}
                  title={isListening ? "Stop listening" : "Start mic recording"}
                >
                  {isListening ? <MicOff className="size-4" /> : <Mic className="size-4 text-primary" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-xs font-semibold"
                  onClick={handleParse}
                  disabled={!query.trim() || isParsing}
                >
                  {isParsing ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
                </Button>
              </div>
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="text-muted-foreground text-[10px] self-center">Try:</span>
              {[
                "Spent 1200 on fuel today",
                "Paid 350 for dinner at Swiggy",
                "Received 15000 freelance payout",
              ].map((sample) => (
                <button
                  key={sample}
                  onClick={() => {
                    setQuery(sample);
                  }}
                  className="rounded-full bg-secondary px-2.5 py-1 font-medium hover:bg-secondary/80 text-secondary-foreground"
                >
                  {sample}
                </button>
              ))}
            </div>

            {/* Parsed Result Card */}
            {parsedResult && (
              <div className="rounded-xl border bg-card p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <Badge variant={parsedResult.type === "expense" ? "destructive" : "default"} className="uppercase font-bold text-[10px]">
                    {parsedResult.type}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{parsedResult.dateStr}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Amount:</span>
                    <p className="text-base font-bold text-foreground">
                      {currency} {parsedResult.amount.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <p className="font-semibold text-foreground">{parsedResult.categoryName}</p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <p className="font-medium">{parsedResult.isEssential ? "Essential" : "Discretionary"}</p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Payment:</span>
                    <p className="font-medium capitalize">{parsedResult.paymentType}</p>
                  </div>
                </div>

                <div className="pt-2 border-t flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setParsedResult(null)} disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleConfirmSave} disabled={isSaving} className="gap-1.5 font-bold">
                    {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Confirm & Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
