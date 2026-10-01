import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  LuSparkles as Sparkles,
  LuX as X,
  LuSend as Send,
  LuBot as Bot,
  LuUser as User,
  LuRefreshCw as RefreshCw,
  LuLightbulb as Lightbulb,
  LuShoppingCart as ShoppingCart,
  LuPlus as Plus,
  LuArrowRight as ArrowRight,
  LuTrendingUp as TrendingUp,
  LuCircleAlert as AlertCircle,
  LuExternalLink as ExternalLink,
} from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store/store";
import { fetchProducts, Product } from "../store/slices/productSlice";
import { getProductImage } from "../utils/productImages";
import { useToast } from "../context/ToastContext";
import api from "../services/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  "🔥 What are our top fast movers today?",
  "⚠️ Which products are at risk of running out of stock?",
  "💡 Suggest a promotional bundle for slow-moving jeans",
  "📐 Explain the floor plan placement for the Beige Jacket",
];

// --- INTERACTIVE RICH MARKDOWN MESSAGE COMPONENT ---
interface InteractiveMessageProps {
  content: string;
  products: Product[];
  onSelectProduct: (p: Product) => void;
}

const InteractiveMessage: React.FC<InteractiveMessageProps> = ({
  content,
  products,
  onSelectProduct,
}) => {
  // Find a product by name or SKU match
  const findProductMatch = (text: string): Product | undefined => {
    // Strip trailing/leading punctuation like colons, asterisks, commas, periods
    const clean = text.replace(/[:.,!?;'"]/g, "").trim().toLowerCase();
    if (!clean || clean.length < 3) return undefined;
    return products.find((p) => {
      const pName = p.name.toLowerCase();
      const pSku = p.sku.toLowerCase();
      return (
        pName === clean ||
        clean.includes(pName) ||
        pName.includes(clean) ||
        pSku === clean
      );
    });
  };

  // Parse inline formatted text (removes ** stars and creates interactive tokens)
  const renderInlineFormatted = (rawText: string) => {
    // Regex splits by **bold** or *item*
    const parts = rawText.split(/(\*\*.*?\*\*|\*.*?\*)/g);

    return parts.map((part, pIdx) => {
      // Bold token: **something**
      if (part.startsWith("**") && part.endsWith("**")) {
        const inner = part.slice(2, -2).trim();

        // Check if inner text matches a product in the catalog!
        const matchedProduct = findProductMatch(inner);
        if (matchedProduct) {
          const imgUrl =
            matchedProduct.imageUrl ||
            getProductImage(matchedProduct.category, matchedProduct.color, matchedProduct.name);
          return (
            <button
              key={pIdx}
              type="button"
              onClick={() => onSelectProduct(matchedProduct)}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 my-0.5 rounded-lg bg-brand-violet/25 hover:bg-brand-violet/35 border border-brand-violet/40 text-brand-violet font-bold text-[11px] transition-all cursor-pointer shadow-sm align-middle group"
              title={`Click to inspect ${matchedProduct.name} (Stock: ${matchedProduct.stock})`}
            >
              <img
                src={imgUrl}
                alt={matchedProduct.name}
                className="w-3.5 h-3.5 rounded object-cover border border-brand-violet/40"
              />
              <span className="group-hover:underline">{inner}</span>
              <span
                className={`text-[10px] font-mono ${
                  matchedProduct.stock <= 10 ? "text-rose-400 font-bold" : "text-slate-400"
                }`}
              >
                ({matchedProduct.stock} left)
              </span>
            </button>
          );
        }

        // Highlight key metric numbers (e.g. "9.6 units/day", "10 units left", "low on stock")
        if (inner.includes("units/day") || inner.includes("units left")) {
          return (
            <span
              key={pIdx}
              className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20"
            >
              {inner}
            </span>
          );
        }

        if (inner.toLowerCase().includes("low stock") || inner.toLowerCase().includes("stockout")) {
          return (
            <span
              key={pIdx}
              className="font-bold text-rose-400 bg-rose-500/15 px-1 py-0.2 rounded border border-rose-500/25"
            >
              {inner}
            </span>
          );
        }

        // Standard bold text without ugly asterisks!
        return (
          <strong key={pIdx} className="font-extrabold text-stone-950">
            {inner}
          </strong>
        );
      }

      // Italic single star: *something*
      if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
        const inner = part.slice(1, -1).trim();
        return (
          <em key={pIdx} className="text-stone-700 italic font-medium">
            {inner}
          </em>
        );
      }

      // Normal text
      return <span key={pIdx} className="text-stone-800">{part}</span>;
    });
  };

  // Split content by lines
  const lines = content.split("\n");

  return (
    <div className="space-y-2 text-xs leading-relaxed text-stone-800">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lIdx} className="h-1" />;

        // Recommendation block
        if (
          trimmed.toLowerCase().startsWith("**recommendation:**") ||
          trimmed.toLowerCase().startsWith("recommendation:")
        ) {
          const cleanText = trimmed.replace(/^\*\*recommendation:\*\*\s*/i, "").replace(/^recommendation:\s*/i, "");
          return (
            <div
              key={lIdx}
              className="p-3 my-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-stone-900 shadow-sm space-y-1.5"
            >
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-800">
                <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                <span>AI Merchandising Strategy</span>
              </div>
              <div className="text-[11px] leading-relaxed text-stone-800">
                {renderInlineFormatted(cleanText)}
              </div>
            </div>
          );
        }

        // Bullet point list item: * or -
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          const bulletText = trimmed.slice(2);
          return (
            <div key={lIdx} className="flex items-start gap-2 pl-1.5 my-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0 shadow-sm" />
              <div className="flex-1 min-w-0">{renderInlineFormatted(bulletText)}</div>
            </div>
          );
        }

        // Section Heading
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={lIdx} className="font-extrabold text-stone-950 text-xs mt-2 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-orange-500" />
              {renderInlineFormatted(trimmed.slice(4))}
            </h4>
          );
        }

        // Regular paragraph
        return <p key={lIdx} className="text-stone-800">{renderInlineFormatted(trimmed)}</p>;
      })}
    </div>
  );
};

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const dispatch = useDispatch<AppDispatch>();
  const products = useSelector((state: RootState) => state.products.items);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your **Velocity Retail AI Copilot** powered by Groq. I have live access to your store inventory, 7-day sales velocity, and category affinity models. How can I assist your merchandising strategy today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  // Lock background body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const history = newMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data } = await api.post("/copilot/chat", {
        message: text,
        history,
      });

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm experiencing a brief connection delay with the AI service. As a rule of thumb, always place high-margin accessories next to high-velocity apparel to maximize average order value.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Quick Actions directly from Copilot Chat
  const handleQuickRestock = async (product: Product) => {
    setActionLoading(true);
    try {
      await api.put(`/products/${product._id}`, { stock: product.stock + 10 });
      dispatch(fetchProducts());
      setSelectedProduct({ ...product, stock: product.stock + 10 });
      showToast(`Restocked +10 units of ${product.name}`, "success", "Inventory Updated");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ Restocked **${product.name}** with **+10 units**! New stock level is **${product.stock + 10} units**. Inventory updated in database.`,
        },
      ]);
    } catch {
      showToast("Failed to restock product. Please check connection.", "error", "Restock Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickSell = async (product: Product) => {
    setActionLoading(true);
    try {
      await api.post(`/products/${product._id}/sale`, { quantity: 1 });
      dispatch(fetchProducts());
      const newStock = Math.max(0, product.stock - 1);
      setSelectedProduct({ ...product, stock: newStock });
      showToast(`Sale recorded: 1 unit of ${product.name}`, "success", "Sale Processed");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `🛒 Quick POS sale recorded for **${product.name}**! Deducted **1 unit**. Current stock is **${newStock} units**.`,
        },
      ]);
    } catch {
      showToast("Failed to record sale. Please try again.", "error", "Transaction Error");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 w-screen h-screen z-[9999] flex justify-end overflow-hidden">
      {/* 100% Full Viewport Backdrop with Deep Blur and Dimming */}
      <div
        className="fixed inset-0 w-full h-full bg-stone-950/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      <div className="relative z-10 w-full max-w-md bg-[#FAF5EE] border-l border-[#E5D7BE] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 text-stone-900 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5D7BE] flex items-center justify-between bg-[#F8F2E6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                AI Merchandising Copilot
                <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded">
                  Groq 70B
                </span>
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">Live store inventory & analytics</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-[#EFE5D3] transition-colors cursor-pointer border border-transparent hover:border-[#E5D7BE]"
            title="Close AI Copilot"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm bg-[#FAF5EE]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-br-none shadow-sm"
                    : "bg-white text-stone-800 border border-[#E5D7BE] rounded-bl-none shadow-sm"
                }`}
              >
                {m.role === "assistant" ? (
                  <InteractiveMessage
                    content={m.content}
                    products={products}
                    onSelectProduct={(p) => setSelectedProduct(p)}
                  />
                ) : (
                  <div className="whitespace-pre-line">{m.content}</div>
                )}
              </div>
              {m.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-[#EFE5D3] text-stone-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center text-stone-500 text-xs">
              <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              </div>
              <span className="italic">AI Copilot is analyzing live catalog...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 🌟 INTERACTIVE PRODUCT ACTION DRAWER (When User Clicks Any Product Pill in Chat) */}
        {selectedProduct && (
          <div className="p-3.5 bg-white border-t border-[#E5D7BE] animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5D7BE]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600">
                <Sparkles className="w-3 h-3" />
                <span>Product Inspection</span>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 rounded text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3 py-2">
              <img
                src={
                  selectedProduct.imageUrl ||
                  getProductImage(selectedProduct.category, selectedProduct.color, selectedProduct.name)
                }
                alt={selectedProduct.name}
                className="w-12 h-12 rounded-xl object-cover border border-[#E5D7BE] bg-[#FAF5EE]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-stone-400 font-mono">{selectedProduct.sku}</p>
                <h5 className="font-bold text-stone-900 text-xs truncate">{selectedProduct.name}</h5>
                <div className="flex items-center gap-2 text-[11px] mt-0.5">
                  <span className="font-bold text-orange-600">₹{selectedProduct.price}</span>
                  <span
                    className={`font-semibold ${
                      selectedProduct.stock <= 10 ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {selectedProduct.stock} in stock
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleQuickRestock(selectedProduct)}
                disabled={actionLoading}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#FAF5EE] hover:bg-[#F2E8D5] text-stone-800 text-xs font-bold border border-[#E5D7BE] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Restock (+10)</span>
              </button>
              <button
                onClick={() => handleQuickSell(selectedProduct)}
                disabled={actionLoading || selectedProduct.stock === 0}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer shadow-sm"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Quick Sell (1x)</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Suggestion Prompts in Block Layout (No horizontal scrollbar) */}
        <div className="px-4 py-3 bg-[#F8F2E6] border-t border-[#E5D7BE] overflow-hidden shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700 mb-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span>Suggested Questions:</span>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(prompt)}
                className="w-full block text-left text-xs bg-white hover:bg-orange-50/70 text-stone-800 font-semibold px-3 py-2 rounded-xl border border-[#E5D7BE] hover:border-orange-300 transition-all cursor-pointer shadow-xs group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{prompt}</span>
                  <span className="text-[11px] text-orange-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    Ask →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-[#E5D7BE] bg-[#F8F2E6]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about sales, floor layout, stock..."
              className="flex-1 bg-white border border-[#E5D7BE] rounded-xl px-3.5 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white disabled:opacity-40 hover:opacity-95 transition-opacity cursor-pointer shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
