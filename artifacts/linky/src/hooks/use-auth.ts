import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { useLogin, useRequestLoginNonce } from "@workspace/api-client-react";
import { loadSession, saveSession, clearSession, getTokenForWallet } from "@/lib/session";

export function useAuth() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const login = useLogin();
  const requestNonce = useRequestLoginNonce();

  const [token, setToken] = useState<string | null>(() => getTokenForWallet(address));

  useEffect(() => {
    setToken(getTokenForWallet(address));
  }, [address]);

  // If wallet changes away from the stored session wallet, clear it.
  useEffect(() => {
    const s = loadSession();
    if (s && address && s.wallet.toLowerCase() !== address.toLowerCase()) {
      clearSession();
      setToken(null);
    }
  }, [address]);

  const signIn = useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    let nonce: string;
    try {
      const r = await requestNonce.mutateAsync({ data: { wallet: address } });
      nonce = r.nonce;
    } catch {
      return false;
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `LINKY:${chainId}:login:${address.toLowerCase()}:${nonce}:${timestamp}`;
    let signature: string;
    try {
      signature = await signMessageAsync({ message });
    } catch {
      return false;
    }
    try {
      const res = await login.mutateAsync({
        data: { wallet: address, signature, timestamp, nonce },
      });
      saveSession({ token: res.token, wallet: res.wallet, expiresAt: res.expiresAt });
      setToken(res.token);
      return true;
    } catch {
      return false;
    }
  }, [address, chainId, signMessageAsync, login, requestNonce]);

  const signOut = useCallback(() => {
    clearSession();
    setToken(null);
  }, []);

  return {
    address,
    isAuthenticated: !!token,
    isSigningIn: login.isPending || requestNonce.isPending,
    signIn,
    signOut,
  };
}
