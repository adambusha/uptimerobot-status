/// <reference types="react" />

declare module '@raycast/api' {
  export function getPreferenceValues<T>(): T;
  
  export const ActionPanel: any;
  export const Action: any;
  export const List: any;
  export const Icon: any;
  export const Color: any;
  
  export function open(url: string): Promise<void>;
  export function showToast(options: any): Promise<void>;
  
  export const Toast: {
    Style: {
      Failure: string;
      Success: string;
      Animated: string;
    };
  };
  
  export const Clipboard: {
    copy(text: string): Promise<void>;
    paste(): Promise<string>;
  };
  
  export class Cache {
    set(key: string, value: string): void;
    get(key: string): string | undefined;
  }
}

// Define Buffer for Node.js
declare const Buffer: {
  byteLength(str: string, encoding?: string): number;
  from(str: string, encoding?: string): Buffer;
};

interface Buffer extends Uint8Array {
  toString(encoding?: string): string;
} 