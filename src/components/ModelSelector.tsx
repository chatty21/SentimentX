// src/components/ModelSelector.tsx
'use client';

import { useEffect, useState } from 'react';

export type LLMChoice =
  | 'google/gemini-2.0-flash-exp'
  | 'openai/gpt-4o-mini'
  | 'meta-llama/llama-3.1-70b-instruct'
  | 'perplexity/llama-3.1-sonar-large-128k-online'; // great for RAG-like searchy tasks

const LABELS: Record<LLMChoice, string> = {
  'google/gemini-2.0-flash-exp': 'Gemini 2.0 Flash',
  'openai/gpt-4o-mini': 'GPT-4o mini',
  'meta-llama/llama-3.1-70b-instruct': 'Llama-3.1 70B Instruct',
  'perplexity/llama-3.1-sonar-large-128k-online': 'Perplexity Sonar (Llama-3.1)',
};

const KEY = 'sx_llm_choice';

export default function ModelSelector({
  onChange,
  compact = false,
}: {
  onChange?: (m: LLMChoice) => void;
  compact?: boolean;
}) {
  const [model, setModel] = useState<LLMChoice>('google/gemini-2.0-flash-exp');

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) || '') as LLMChoice;
    if (saved && LABELS[saved]) setModel(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, model);
    onChange?.(model);
  }, [model, onChange]);

  return (
    <label className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <span className="text-zinc-400">Model:</span>
      <select
        className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-zinc-100"
        value={model}
        onChange={(e) => setModel(e.target.value as LLMChoice)}
      >
        {Object.entries(LABELS).map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function getSavedModel(): LLMChoice {
  const saved = (typeof window !== 'undefined' ? localStorage.getItem('sx_llm_choice') : '') as LLMChoice;
  return (saved && LABELS[saved] ? saved : 'google/gemini-2.0-flash-exp');
}