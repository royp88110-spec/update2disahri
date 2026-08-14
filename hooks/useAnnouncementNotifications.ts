/**
 * useAnnouncementNotifications
 *
 * Fetches each member's read-state from Supabase, queues all unread
 * announcements newest-first, and surfaces them one at a time through
 * `current`.  Call `onDismiss` when the toast finishes (auto or manual)
 * to advance the queue after a 1-second gap.
 *
 * Only active for members (never for admins).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import type { Announcement } from "@/context/DataContext";

/** Returns true if this announcement is visible to the given member. */
function isRelevantToMember(a: Announcement, memberId: string): boolean {
  if (a.type === "general") return true;
  if (a.type === "payment_reminder") return a.targetMemberId === memberId;
  return true;
}

// ─── Supabase helpers (lazy-import, matches the rest of the codebase) ─────────

const getSb = () =>
  import("@/lib/supabase").then(({ getSupabase }) => getSupabase());

async function fetchReadIds(memberId: string): Promise<Set<string>> {
  const client = await getSb();
  const { data } = await client
    .from("announcement_reads")
    .select("announcement_id")
    .eq("member_id", memberId);
  return new Set(
    ((data ?? []) as Array<Record<string, string>>).map(
      (r) => r.announcement_id,
    ),
  );
}

async function persistRead(
  memberId: string,
  announcementId: string,
): Promise<void> {
  const client = await getSb();
  await client
    .from("announcement_reads")
    .upsert(
      { member_id: memberId, announcement_id: announcementId },
      { onConflict: "member_id,announcement_id" },
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnnouncementNotifications() {
  const { user }                = useAuth();
  const { announcements, isLoaded } = useData();

  // The announcement currently on screen (null = nothing showing)
  const [current, setCurrent] = useState<Announcement | null>(null);

  // ── All mutable queue-state lives in refs to avoid stale-closure bugs ──────
  /** Announcements waiting to be shown. */
  const queueRef = useRef<Announcement[]>([]);
  /** IDs confirmed read in Supabase for this session. */
  const readIdsRef = useRef<Set<string>>(new Set());
  /**
   * IDs already queued OR shown this session — prevents double-queuing when
   * the announcements array re-renders or when realtime pushes a new item.
   */
  const processedRef = useRef<Set<string>>(new Set());
  /** True while a toast is visible on screen. */
  const isShowingRef = useRef(false);
  /** True once the initial Supabase read-fetch has completed. */
  const initDoneRef = useRef(false);
  /** Timer for the inter-notification gap. */
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Mirror of `announcements` kept in a ref so the initial-load effect can
   * read the latest value without adding `announcements` to its dep array
   * (which would re-run the "init once" guard on every realtime update).
   */
  const announcementsRef = useRef(announcements);
  announcementsRef.current = announcements;

  // ── Core: pop the front of the queue and show it ─────────────────────────
  const popAndShow = useCallback(
    (delayMs: number) => {
      if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
      if (queueRef.current.length === 0) return;

      waitTimerRef.current = setTimeout(() => {
        if (queueRef.current.length === 0) return;
        const [next, ...rest] = queueRef.current;
        queueRef.current = rest;
        isShowingRef.current = true;
        setCurrent(next);

        // Fire-and-forget: mark read in Supabase immediately on display
        if (user?.memberId) {
          persistRead(user.memberId, next.id).catch(() => {});
        }
      }, delayMs);
    },
    [user?.memberId],
  );

  /** Called by the toast when it finishes (auto timeout or manual close). */
  const onDismiss = useCallback(() => {
    isShowingRef.current = false;
    setCurrent(null);
    // Show next item after a 1-second breathing gap, or immediately if none pending
    popAndShow(queueRef.current.length > 0 ? 1000 : 0);
  }, [popAndShow]);

  /**
   * Add items to the queue (deduped via processedRef) and start showing
   * if nothing is currently on screen.
   */
  const enqueue = useCallback(
    (items: Announcement[]) => {
      for (const a of items) processedRef.current.add(a.id);
      queueRef.current = [...queueRef.current, ...items];
      if (!isShowingRef.current) {
        popAndShow(0);
      }
    },
    [popAndShow],
  );

  // ── Effect 1: Initial load — run once after data + user are ready ─────────
  useEffect(() => {
    if (!isLoaded || !user || user.role !== "member" || initDoneRef.current) {
      return;
    }
    initDoneRef.current = true;
    const memberId = user.memberId;

    fetchReadIds(memberId)
      .then((readIds) => {
        readIdsRef.current = readIds;

        // Use the ref so we always see the latest announcements value even
        // though `announcements` is intentionally absent from this effect's deps.
        const unread = announcementsRef.current
          .filter((a) => !readIds.has(a.id) && isRelevantToMember(a, memberId))
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );

        if (unread.length > 0) enqueue(unread);
      })
      .catch(() => {
        // Supabase unavailable — silently skip notifications
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user, enqueue]);
  // NOTE: `announcements` intentionally omitted — covered by announcementsRef.

  // ── Effect 2: New announcements from realtime subscriptions ───────────────
  useEffect(() => {
    // Only run after the initial load so we don't race with Effect 1
    if (!initDoneRef.current || !user || user.role !== "member") return;

    const memberId = user?.memberId ?? "";
    const newUnread = announcements
      .filter(
        (a) =>
          !readIdsRef.current.has(a.id) &&
          !processedRef.current.has(a.id) &&
          isRelevantToMember(a, memberId),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    if (newUnread.length > 0) enqueue(newUnread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcements]);
  // NOTE: `enqueue` and `user` intentionally omitted — they don't change
  // during a session and including them would cause spurious re-runs.

  // ── Effect 3: Reset everything on logout ─────────────────────────────────
  useEffect(() => {
    if (user) return; // still logged in — nothing to do

    if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    queueRef.current = [];
    readIdsRef.current = new Set();
    processedRef.current = new Set();
    isShowingRef.current = false;
    initDoneRef.current = false;
    setCurrent(null);
  }, [user]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(
    () => () => {
      if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    },
    [],
  );

  return { current, onDismiss };
}
