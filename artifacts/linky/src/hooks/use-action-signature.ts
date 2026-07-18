import { useSignMessage, useChainId } from "wagmi";

export type ActionName = "update-expert" | "complete-booking" | "send-message" | "create-expert";

export function useActionSignature() {
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();

  async function sign(action: ActionName, resource: string): Promise<{ signature: string; timestamp: number }> {
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `LINKY:${chainId}:${action}:${resource}:${timestamp}`;
    const signature = await signMessageAsync({ message });
    return { signature, timestamp };
  }

  return { sign };
}
