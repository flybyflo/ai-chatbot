'use client';

import { OptionsNavigator } from './options-navigator';
import { getOptionPages } from './options/registry';

interface InputOptionsProps {
  onTitleChange?: (title: React.ReactNode) => void;
  resetTrigger?: boolean;
}

export function InputOptions({ onTitleChange, resetTrigger }: InputOptionsProps) {
  const optionPages = getOptionPages();
  return <OptionsNavigator pages={optionPages} onTitleChange={onTitleChange} resetTrigger={resetTrigger} />;
}