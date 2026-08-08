/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sparkles, Code2, Rocket, Layout, Wand2, ArrowRight } from 'lucide-react';

export default function App() {
  const suggestions = [
    {
      icon: Layout,
      title: "Interactive Dashboards",
      desc: "Analytics platforms, financial trackers, or project management boards with live charts."
    },
    {
      icon: Wand2,
      title: "AI Tools & Workflows",
      desc: "Smart summarizers, creative content generators, or automated workflow assistants."
    },
    {
      icon: Code2,
      title: "Productivity Apps",
      desc: "Task managers, note-taking suites, habit trackers, or specialized calculators."
    },
    {
      icon: Rocket,
      title: "Custom Web Utilities",
      desc: "Interactive games, data converters, portfolio showcases, or visual canvas tools."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Bar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-semibold text-slate-900 tracking-tight text-lg">AI Studio Builder</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Ready to Build
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-16 flex-1 flex flex-col justify-center items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Powered by Gemini & Antigravity Agent</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 max-w-2xl leading-tight mb-4">
          What would you like to create today?
        </h1>

        <p className="text-lg text-slate-600 max-w-xl mb-12 leading-relaxed">
          Describe your application ideas, features, or design preferences in the chat, and I will craft a complete, full-stack application tailored to your needs.
        </p>

        {/* Suggestion Cards */}
        <div className="grid sm:grid-cols-2 gap-4 w-full text-left">
          {suggestions.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx}
                className="group p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200"
              >
                <div className="h-10 w-10 rounded-xl bg-slate-100 group-hover:bg-indigo-50 text-slate-700 group-hover:text-indigo-600 flex items-center justify-center mb-4 transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1 flex items-center justify-between">
                  {item.title}
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100" />
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500 bg-white">
        <p>Type your request in the chat to start building instantly.</p>
      </footer>
    </div>
  );
}

