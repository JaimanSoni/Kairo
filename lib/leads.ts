import { getDb, withDbRetry } from "./db";

export type GtmLead = {
  name: string;
  username: string;
  platform: string;
  profile_url: string;
  post_url: string;
  competitor: string;
  pain_points: string[];
  review_summary: string;
  sentiment: string;
  contact_email: string;
  website: string;
  twitter: string;
  linkedin: string;
  github: string;
  newsletter: string;
  company: string;
  job_title: string;
  country: string;
  best_contact_method: string;
  estimated_fit_score: number;
  why_kairo_can_help: string;
  suggested_personalized_outreach: string;
  contacted?: boolean;
  contacted_at?: Date;
  notes?: string;
  status?: "new" | "contacted" | "replied" | "converted" | "declined" | "invalid";
  createdAt?: Date;
  updatedAt?: Date;
};

const COLLECTION = "leads";

export async function seedLeads(leads: GtmLead[]): Promise<{ inserted: number; skipped: number }> {
  return withDbRetry(async () => {
    const db = await getDb();
    const col = db.collection<GtmLead>(COLLECTION);

    let inserted = 0;
    let skipped = 0;

    for (const lead of leads) {
      const exists = await col.findOne({
        $or: [
          { username: lead.username, platform: lead.platform },
          { post_url: lead.post_url },
        ],
      });

      if (exists) {
        skipped++;
        continue;
      }

      await col.insertOne({
        ...lead,
        status: "new",
        contacted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      inserted++;
    }

    return { inserted, skipped };
  });
}

export async function listLeads(opts?: {
  status?: GtmLead["status"];
  competitor?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
  sort?: "score" | "created" | "updated";
}): Promise<{ leads: GtmLead[]; total: number }> {
  return withDbRetry(async () => {
    const db = await getDb();
    const col = db.collection<GtmLead>(COLLECTION);

    const filter: Record<string, unknown> = {};
    if (opts?.status) filter.status = opts.status;
    if (opts?.competitor) filter.competitor = opts.competitor;
    if (opts?.minScore) filter.estimated_fit_score = { $gte: opts.minScore };

    const total = await col.countDocuments(filter);

    const sort: Record<string, 1 | -1> =
      opts?.sort === "score"
        ? { estimated_fit_score: -1 }
        : opts?.sort === "updated"
          ? { updatedAt: -1 }
          : { createdAt: -1 };

    const leads = await col
      .find(filter)
      .sort(sort)
      .skip(opts?.offset ?? 0)
      .limit(opts?.limit ?? 100)
      .toArray();

    return { leads, total };
  });
}

export async function getLeadStats(): Promise<{
  total: number;
  byCompetitor: { _id: string; count: number }[];
  byStatus: { _id: string; count: number }[];
  bySentiment: { _id: string; count: number }[];
  byScore: { high: number; medium: number; low: number };
  topPainPoints: { _id: string; count: number }[];
}> {
  return withDbRetry(async () => {
    const db = await getDb();
    const col = db.collection<GtmLead>(COLLECTION);

    const total = await col.countDocuments();

    const byCompetitor = await col
      .aggregate([
        { $group: { _id: "$competitor", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray() as { _id: string; count: number }[];

    const byStatus = await col
      .aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray() as { _id: string; count: number }[];

    const bySentiment = await col
      .aggregate([
        { $group: { _id: "$sentiment", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray() as { _id: string; count: number }[];

    const highScore = await col.countDocuments({ estimated_fit_score: { $gte: 80 } });
    const mediumScore = await col.countDocuments({
      estimated_fit_score: { $gte: 60, $lt: 80 },
    });
    const lowScore = await col.countDocuments({ estimated_fit_score: { $lt: 60 } });

    const topPainPoints = await col
      .aggregate([
        { $unwind: "$pain_points" },
        { $group: { _id: "$pain_points", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ])
      .toArray() as { _id: string; count: number }[];

    return {
      total,
      byCompetitor,
      byStatus,
      bySentiment,
      byScore: { high: highScore, medium: mediumScore, low: lowScore },
      topPainPoints,
    };
  });
}

export async function updateLeadStatus(
  username: string,
  platform: string,
  update: Partial<Pick<GtmLead, "status" | "notes" | "contacted">>
): Promise<boolean> {
  return withDbRetry(async () => {
    const db = await getDb();
    const col = db.collection<GtmLead>(COLLECTION);

    const set: Record<string, unknown> = { updatedAt: new Date(), ...update };
    if (update.contacted) set.contacted_at = new Date();

    const result = await col.updateOne({ username, platform }, { $set: set });
    return result.modifiedCount > 0;
  });
}
