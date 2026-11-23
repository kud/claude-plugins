export type AskInput = {
  question: string;
  options: string[];
  french?: boolean;
  isGated?: boolean;
};

declare module "claude-code" {
  interface PluginState {
    "reply-kit": { answers: Shaped<Record<string, number>> };
  }
}
