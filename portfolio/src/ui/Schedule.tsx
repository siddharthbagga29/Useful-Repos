import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { INTEGRATIONS } from "../data/site.ts";
import { bus } from "../jarvis/bus.ts";
import { track } from "../lib/track.ts";
import { rise } from "./Panel.tsx";

/**
 * Calendly inline scheduler. Hidden until VITE_CALENDLY_URL is set. The widget's own
 * postMessage events tell us when someone views it and when a meeting is booked, which
 * works on Calendly's free plan (webhooks need a paid plan).
 */
export function Schedule() {
  const url = INTEGRATIONS.calendly;
  const [show, setShow] = useState(false);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    if (!url) return;
    const onMsg = (e: MessageEvent) => {
      if (!/^https:\/\/([a-z0-9-]+\.)?calendly\.com$/.test(e.origin)) return;
      const ev = (e.data as { event?: string })?.event;
      if (ev === "calendly.event_type_viewed") track("calendly_view", {}, true);
      if (ev === "calendly.event_scheduled") {
        setBooked(true);
        const p = (e.data as { payload?: { event?: { uri?: string }; invitee?: { uri?: string } } }).payload;
        track("calendly_booked", { event: p?.event?.uri ?? "", invitee: p?.invitee?.uri ?? "" });
      }
    };
    addEventListener("message", onMsg);
    const off = bus.on((e) => e.type === "open_schedule" && setShow(true));
    return () => {
      removeEventListener("message", onMsg);
      off();
    };
  }, [url]);

  if (!url) return null;
  const src = `${url}${url.includes("?") ? "&" : "?"}embed_domain=${encodeURIComponent(location.host)}&embed_type=Inline&hide_gdpr_banner=1&background_color=131312&text_color=f2efe6&primary_color=ff4a1c`;

  return (
    <motion.div className="sched" variants={rise} id="schedule">
      <div className="sched-h">
        <div>
          <span className="lbl">Private conversation</span>
          <b>Book 20 minutes directly</b>
        </div>
        {!show && (
          <button className="cta hot" onClick={() => setShow(true)} data-testid="sched-open">
            Pick a time
          </button>
        )}
      </div>
      {booked && <p className="sched-ok">Booked — a calendar invite is on its way to you.</p>}
      {show && <iframe title="Book a time with Siddharth (Calendly)" src={src} loading="lazy" className="sched-frame" />}
    </motion.div>
  );
}
