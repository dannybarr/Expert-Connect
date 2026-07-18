// Best-effort transactional email via the Replit-managed Resend connector.
// Uses the Replit Connectors SDK (blueprint id: resend), which proxies the
// request to Resend and injects auth automatically — no API key is stored in
// this codebase. Every function here is fail-soft: it returns false on any
// problem and never throws, so the buy flow is never blocked by email delivery.

import { ReplitConnectors } from "@replit/connectors-sdk";

type RevealContact = {
  channel: "messaging" | "calls";
  platform: "whatsapp" | "telegram" | null;
  handle: string | null;
  bookingUrl: string | null;
};

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? "LINKY <onboarding@resend.dev>";
}

function contactLines(expertName: string, contact: RevealContact): { subject: string; html: string; text: string } {
  const subject = `Your LINKY contact for ${expertName}`;
  let detailHtml = "";
  let detailText = "";
  if (contact.channel === "messaging" && contact.handle) {
    const platform = contact.platform === "telegram" ? "Telegram" : "WhatsApp";
    detailHtml = `<p style="font-size:16px"><strong>${platform}:</strong> ${escapeHtml(contact.handle)}</p>`;
    detailText = `${platform}: ${contact.handle}`;
  } else if (contact.channel === "calls" && contact.bookingUrl) {
    detailHtml = `<p style="font-size:16px"><strong>Book a call:</strong> <a href="${escapeAttr(contact.bookingUrl)}">${escapeHtml(contact.bookingUrl)}</a></p>`;
    detailText = `Book a call: ${contact.bookingUrl}`;
  }
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
      <h2 style="margin-bottom:4px">Payment confirmed 🎉</h2>
      <p style="color:#555">Here's how to reach <strong>${escapeHtml(expertName)}</strong>:</p>
      ${detailHtml}
      <p style="color:#888;font-size:13px;margin-top:24px">Thanks for using LINKY.</p>
    </div>`;
  const text = `Payment confirmed!\n\nHere's how to reach ${expertName}:\n${detailText}\n\nThanks for using LINKY.`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

/**
 * Send the unlocked contact to the buyer. Returns true only if Resend accepted
 * the message. Never throws.
 */
export async function sendContactEmail(args: {
  to: string;
  expertName: string;
  contact: RevealContact;
}): Promise<boolean> {
  if (!args.to) return false;
  const { subject, html, text } = contactLines(args.expertName, args.contact);
  try {
    // Replit Connectors SDK (blueprint: resend) — proxies to Resend's REST API
    // and handles identity / token refresh / auth headers automatically.
    const connectors = new ReplitConnectors();
    const res = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress(), to: [args.to], subject, html, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
