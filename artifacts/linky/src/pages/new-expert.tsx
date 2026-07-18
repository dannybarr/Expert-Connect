import { Helmet } from "react-helmet-async";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Wallet, ConnectWallet } from "@coinbase/onchainkit/wallet";
import { Avatar, Name } from "@coinbase/onchainkit/identity";
import { useGetExpertByWallet, useCreateExpert, getGetExpertByWalletQueryKey } from "@workspace/api-client-react";
import { useActionSignature } from "@/hooks/use-action-signature";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const optionalUrl = z.string().url().optional().or(z.literal(""));
const priceStr = z.string().regex(/^\d+(\.\d{1,2})?$/, "e.g. 50.00");

const formSchema = z
  .object({
    handle: z.string().min(2).max(32).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
    name: z.string().min(1, "Name is required"),
    about: z.string().min(1, "Tell people what you do"),
    linkedinUrl: optionalUrl,
    xUrl: optionalUrl,
    avatarUrl: optionalUrl,
    messagingEnabled: z.boolean(),
    messagingPlatform: z.enum(["whatsapp", "telegram"]).optional(),
    messagingHandle: z.string().optional().or(z.literal("")),
    messagingPriceUsdc: z.string().optional().or(z.literal("")),
    callsEnabled: z.boolean(),
    callsBookingUrl: z.string().optional().or(z.literal("")),
    callsPriceUsdc: z.string().optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (!v.messagingEnabled && !v.callsEnabled) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Turn on at least one channel.", path: ["messagingEnabled"] });
    }
    if (v.messagingEnabled) {
      if (!v.messagingPlatform) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pick WhatsApp or Telegram.", path: ["messagingPlatform"] });
      }
      if (!v.messagingHandle?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add your handle or number.", path: ["messagingHandle"] });
      }
      const r = priceStr.safeParse(v.messagingPriceUsdc);
      if (!r.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Price like 50.00", path: ["messagingPriceUsdc"] });
      }
    }
    if (v.callsEnabled) {
      const u = z.string().url().safeParse(v.callsBookingUrl);
      if (!u.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paste a full https:// calendar link.", path: ["callsBookingUrl"] });
      }
      const r = priceStr.safeParse(v.callsPriceUsdc);
      if (!r.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Price like 150.00", path: ["callsPriceUsdc"] });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

export default function NewExpert() {
  const { address, isConnected } = useAccount();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const walletStepRef = useRef<HTMLDivElement>(null);

  const { data: existingProfile } = useGetExpertByWallet(address || "", {
    query: { enabled: !!address, queryKey: getGetExpertByWalletQueryKey(address || "") }
  });

  const createExpert = useCreateExpert();
  const { sign } = useActionSignature();
  const { signIn } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      handle: "",
      name: "",
      about: "",
      linkedinUrl: "",
      xUrl: "",
      avatarUrl: "",
      messagingEnabled: false,
      messagingPlatform: "telegram",
      messagingHandle: "",
      messagingPriceUsdc: "25",
      callsEnabled: false,
      callsBookingUrl: "",
      callsPriceUsdc: "100",
    },
  });

  const messagingEnabled = form.watch("messagingEnabled");
  const callsEnabled = form.watch("callsEnabled");

  const submitToServer = async (values: FormValues, wallet: string) => {
    try {
      const { signature, timestamp } = await sign("create-expert", values.handle);
      const payload = {
        handle: values.handle,
        wallet,
        signature,
        timestamp,
        name: values.name,
        about: values.about,
        linkedinUrl: values.linkedinUrl || null,
        xUrl: values.xUrl || null,
        avatarUrl: values.avatarUrl || null,
        messaging: values.messagingEnabled
          ? {
              enabled: true,
              platform: values.messagingPlatform!,
              handle: values.messagingHandle!.trim(),
              priceUsdc: values.messagingPriceUsdc!,
            }
          : null,
        calls: values.callsEnabled
          ? {
              enabled: true,
              bookingUrl: values.callsBookingUrl!.trim(),
              priceUsdc: values.callsPriceUsdc!,
            }
          : null,
      };

      createExpert.mutate({ data: payload }, {
        onSuccess: async (expert) => {
          queryClient.invalidateQueries({ queryKey: getGetExpertByWalletQueryKey(wallet) });
          await signIn();
          setLocation(`/${expert.handle}`);
        },
        onError: (err: any) => {
          toast({ title: "Couldn't claim handle", description: err?.message ?? "Try again.", variant: "destructive" });
        },
      });
    } catch (err: any) {
      toast({ title: "Signature failed", description: err?.message ?? "Try again.", variant: "destructive" });
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!address) {
      setPendingValues(values);
      setTimeout(() => walletStepRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      return;
    }
    await submitToServer(values, address);
  };

  // When the wallet arrives after the form was already submitted, finish the job.
  useEffect(() => {
    if (address && pendingValues && !existingProfile) {
      const v = pendingValues;
      setPendingValues(null);
      void submitToServer(v, address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, pendingValues, existingProfile]);

  if (isConnected && existingProfile) {
    return (
      <div className="container max-w-lg mx-auto px-4 py-24 flex flex-col items-start gap-6">
        <Helmet><title>Create LINKY</title></Helmet>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">// Already done</span>
        <h1 className="font-display text-5xl font-bold tracking-[-0.02em]">You're already in.</h1>
        <p className="text-db-mute">
          This wallet is linked to <strong className="text-db-ink font-mono">@{existingProfile.handle}</strong>.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center px-6 bg-db-cobalt text-db-cream border-[2.5px] border-db-ink rounded-[16px] font-display font-bold shadow-[5px_5px_0_var(--db-ink)]"
          >
            Open dashboard
          </Link>
          <Link
            href={`/${existingProfile.handle}`}
            className="inline-flex h-12 items-center justify-center px-6 bg-transparent text-db-ink border-[2.5px] border-db-ink rounded-[16px] font-display font-bold shadow-[5px_5px_0_var(--db-ink)]"
          >
            View profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-12">
      <Helmet><title>Create LINKY Profile</title></Helmet>

      <div className="mb-8">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-2">
          // Setup · 60 seconds
        </div>
        <h1 className="font-display text-5xl font-bold tracking-[-0.02em] mb-3">Claim a handle.</h1>
        <p className="text-db-mute">Add the channels people can buy. Set a price each. Go.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid gap-6 p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)]">
            <FormField
              control={form.control}
              name="handle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">Handle</FormLabel>
                  <FormControl>
                    <div className="flex items-stretch">
                      <span className="bg-db-bg-alt px-4 flex items-center border-[2.5px] border-r-0 border-db-ink rounded-l-[16px] text-sm font-mono text-db-mute">linky.so/</span>
                      <Input placeholder="satoshi" className="rounded-l-none shadow-none" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">Name</FormLabel>
                  <FormControl><Input placeholder="Satoshi Nakamoto" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="about"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">About me</FormLabel>
                  <FormControl><Textarea placeholder="Your profession or one-liner — what can people pay you to talk about?" className="resize-none h-24" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="linkedinUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">LinkedIn (optional)</FormLabel>
                    <FormControl><Input placeholder="https://linkedin.com/in/…" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="xUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">X / Twitter (optional)</FormLabel>
                    <FormControl><Input placeholder="https://x.com/…" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

          </div>

          {/* Messaging channel */}
          <div className="grid gap-6 p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)]">
            <FormField
              control={form.control}
              name="messagingEnabled"
              render={({ field }) => (
                <FormItem className="flex items-start justify-between gap-4 space-y-0">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-1">// Channel · 1</div>
                    <h3 className="font-display text-2xl font-bold">Messaging</h3>
                    <p className="text-sm text-db-mute mt-1">WhatsApp or Telegram. Buyer pays → gets your handle.</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${field.value ? "text-db-ink" : "text-db-mute"}`}>
                        {field.value ? "On" : "Off"}
                      </span>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Toggle Messaging channel" />
                      </FormControl>
                    </div>
                    <FormMessage className="text-right" />
                  </div>
                </FormItem>
              )}
            />
            {messagingEnabled && (
              <div className="grid grid-cols-1 gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="messagingPlatform"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">Platform</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pick one" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="telegram">Telegram</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="messagingHandle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">
                          {form.watch("messagingPlatform") === "whatsapp" ? "WhatsApp number" : "Telegram username"}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder={form.watch("messagingPlatform") === "whatsapp" ? "+15555550123" : "satoshi"} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="messagingPriceUsdc"
                  render={({ field }) => (
                    <FormItem className="pt-1">
                      <FormLabel className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">Price per unlock</FormLabel>
                      <FormControl>
                        <div className="flex items-center h-16 rounded-[16px] border-[2.5px] border-db-ink bg-db-bg shadow-[3px_3px_0_var(--db-ink)] focus-within:shadow-[5px_5px_0_var(--db-cobalt),5px_5px_0_2.5px_var(--db-ink)] transition-shadow duration-100 overflow-hidden">
                          <span className="pl-4 pr-1 font-display font-bold text-3xl leading-none text-db-ink select-none">$</span>
                          <input
                            inputMode="decimal"
                            placeholder="25"
                            className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none px-2 font-display font-bold text-3xl leading-none tracking-tight text-db-ink placeholder:text-db-mute"
                            {...field}
                          />
                          <span className="mr-3 px-2.5 py-1 bg-db-bg-alt border-[2px] border-db-ink rounded-[10px] font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-ink select-none">USDC</span>
                        </div>
                      </FormControl>
                      <p className="text-sm text-db-mute mt-2">What buyers pay to message you once.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

          {/* Calls channel */}
          <div className="grid gap-6 p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)]">
            <FormField
              control={form.control}
              name="callsEnabled"
              render={({ field }) => (
                <FormItem className="flex items-start justify-between gap-4 space-y-0">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-1">// Channel · 2</div>
                    <h3 className="font-display text-2xl font-bold">Calls</h3>
                    <p className="text-sm text-db-mute mt-1">Any calendar link. Buyer pays → lands on your booking page.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${field.value ? "text-db-ink" : "text-db-mute"}`}>
                      {field.value ? "On" : "Off"}
                    </span>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Toggle Calls channel" />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />
            {callsEnabled && (
              <div className="grid grid-cols-1 gap-5">
                <FormField
                  control={form.control}
                  name="callsBookingUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">Calendar link</FormLabel>
                      <FormControl>
                        <Input placeholder="https://cal.com/you/intro" {...field} />
                      </FormControl>
                      <p className="text-sm text-db-mute mt-2">Cal.com, Calendly, Google Calendar, Savvycal — any public booking link. Buyers land here after paying.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="callsPriceUsdc"
                  render={({ field }) => (
                    <FormItem className="pt-1">
                      <FormLabel className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">Price per call</FormLabel>
                      <FormControl>
                        <div className="flex items-center h-16 rounded-[16px] border-[2.5px] border-db-ink bg-db-bg shadow-[3px_3px_0_var(--db-ink)] focus-within:shadow-[5px_5px_0_var(--db-cobalt),5px_5px_0_2.5px_var(--db-ink)] transition-shadow duration-100 overflow-hidden">
                          <span className="pl-4 pr-1 font-display font-bold text-3xl leading-none text-db-ink select-none">$</span>
                          <input
                            inputMode="decimal"
                            placeholder="150"
                            className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none px-2 font-display font-bold text-3xl leading-none tracking-tight text-db-ink placeholder:text-db-mute"
                            {...field}
                          />
                          <span className="mr-3 px-2.5 py-1 bg-db-bg-alt border-[2px] border-db-ink rounded-[10px] font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-ink select-none">USDC</span>
                        </div>
                      </FormControl>
                      <p className="text-sm text-db-mute mt-2">What buyers pay to book a call with you.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={createExpert.isPending}>
            {createExpert.isPending
              ? "Creating…"
              : isConnected
                ? "Make it real"
                : "Continue"}
          </Button>

          {!isConnected && pendingValues && (
            <div
              ref={walletStepRef}
              className="grid gap-4 p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-honey shadow-[5px_5px_0_var(--db-ink)]"
            >
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">
                // Last step · Connect wallet
              </div>
              <h3 className="font-display text-2xl font-bold tracking-[-0.02em]">Plug in a wallet to publish.</h3>
              <p className="text-sm text-db-mute">
                It's the only thing tying you to <span className="font-mono">@{form.getValues("handle")}</span>. No email, no password. We'll finish publishing automatically once you connect.
              </p>
              <Wallet>
                <ConnectWallet className="border-[2.5px] border-db-ink bg-db-cobalt text-db-cream rounded-[16px] h-12 px-6 font-display font-bold shadow-[5px_5px_0_var(--db-ink)]">
                  <Avatar className="h-5 w-5" />
                  <Name />
                </ConnectWallet>
              </Wallet>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
