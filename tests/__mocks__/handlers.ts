import { http, HttpResponse } from "msw";
import { db } from "./db";
import issue22CommentsGet from "./routes/issue-22-comments-get.json";
import issue22Get from "./routes/issue-22-get.json";
import issue25CommentsGet from "./routes/issue-25-comments-get.json";
import issue69EventsGet from "./routes/issue-69-events-get.json";
import issue69CommentsGet from "./routes/issue-69-comments-get.json";
import issue69Get from "./routes/issue-69-get.json";
import issueEvents2Get from "./routes/issue-events-2-get.json";
import issueEventsGet from "./routes/issue-events-get.json";
import issueTimelineGet from "./routes/issue-timeline-get.json";
import issue69TimelineGet from "./routes/issue-69-timeline-get.json";
import pullsCommentsGet from "./routes/pulls-comments-get.json";
import pullsGet from "./routes/pulls-get.json";
import pullsReviewsGet from "./routes/pulls-reviews-get.json";

/**
 * Intercepts the routes and returns a custom payload
 */
export const handlers = [
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/22", () => {
    return HttpResponse.json(issue22Get);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/69", () => {
    return HttpResponse.json(issue69Get);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives", () => {
    return HttpResponse.json(issue22Get);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/events", ({ params: { page } }) => {
    return HttpResponse.json(!page ? issueEventsGet : issueEvents2Get);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/69/events", () => {
    return HttpResponse.json(issue69EventsGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/comments", () => {
    return HttpResponse.json(issue22CommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/69/comments", () => {
    return HttpResponse.json(issue69CommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/25/comments", () => {
    return HttpResponse.json(issue25CommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/timeline", () => {
    return HttpResponse.json(issueTimelineGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/69/timeline", () => {
    return HttpResponse.json(issue69TimelineGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/pulls/25", () => {
    return HttpResponse.json(pullsGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/pulls/25/reviews", () => {
    return HttpResponse.json(pullsReviewsGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/pulls/25/comments", () => {
    return HttpResponse.json(pullsCommentsGet);
  }),
  http.get("https://api.github.com/users/:login", ({ params: { login } }) => {
    const user = db.users.findFirst({
      where: {
        login: {
          equals: login.toString(),
        },
      },
    });
    if (!user) {
      return HttpResponse.json("[mock] User was not found", { status: 404 });
    }
    return HttpResponse.json(user);
  }),
  http.post("https://api.github.com/app/installations/48381972/access_tokens", () => {
    return HttpResponse.json({});
  }),
  http.get("https://wfzpewmlyiozupulbuur.supabase.co/rest/v1/users", ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const userId = Number((id as string).match(/\d+/)?.[0]);
    const user = db.users.findFirst({
      where: {
        id: {
          equals: userId,
        },
      },
    });
    if (!user) {
      return HttpResponse.json("User not found", { status: 404 });
    }
    return HttpResponse.json(user);
  }),
  http.get("https://wfzpewmlyiozupulbuur.supabase.co/rest/v1/locations", ({ request }) => {
    const url = new URL(request.url);
    const issue = url.searchParams.get("issue_id");
    const node = url.searchParams.get("node_url");
    if (!issue) {
      return HttpResponse.json(db.locations.findMany({}));
    }
    const issueId = Number((issue as string).match(/\d+/)?.[0]);
    const nodeUrl = (node as string).match(/https.+/)?.[0];
    const location = db.locations.findFirst({
      where: {
        node_url: {
          equals: nodeUrl,
        },
        issue_id: {
          equals: issueId,
        },
      },
    });
    if (!location) {
      return HttpResponse.json("Location not found", { status: 404 });
    }
    return HttpResponse.json(location);
  }),
  http.post("https://wfzpewmlyiozupulbuur.supabase.co/rest/v1/locations", async ({ request }) => {
    const data = await request.json();
    if (!data) {
      return HttpResponse.error();
    }
    const createdLocation = db.locations.create(data as Record<string, string>);
    return HttpResponse.json(createdLocation);
  }),
  http.post("https://wfzpewmlyiozupulbuur.supabase.co/rest/v1/permits", async ({ request }) => {
    const data = (await request.json()) as Record<string, string | number>;
    if (!data) {
      return HttpResponse.error();
    }
    data.id = db.permits.count() + 1;
    const createdPermit = db.permits.create(data);
    return HttpResponse.json(createdPermit);
  }),
  http.post("https://api.github.com/repos/:owner/:repo/issues/:id/comments", () => {
    return HttpResponse.json({});
  }),
];
