import { GitHubLinkEvent, isGitHubLinkEvent } from "../github-types";
import { IssueParams, getAllTimelineEvents, parseGitHubUrl } from "../start";

export async function collectLinkedMergedPulls(issue: IssueParams) {
  // normally we should only use this one to calculate incentives, because this specifies that the pull requests are merged (accepted)
  // and that are also related to the current issue, no just mentioned by
  const onlyPullRequests = await collectLinkedPulls(issue);
  return onlyPullRequests.filter((event) => {
    if (!event.source.issue.body) {
      return false;
    }
    // Matches all keywords according to the docs:
    // https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword
    // Works on multiple linked issues, and matches #<number> or URL patterns
    const linkedIssueRegex =
      /\b(?:Close(?:s|d)?|Fix(?:es|ed)?|Resolve(?:s|d)?):?\s+(?:#(\d+)|https?:\/\/(?:www\.)?github\.com\/(?:[^/\s]+\/[^/\s]+\/(?:issues|pull)\/(\d+)))\b/gi;
    // We remove the comments as they should not be part of the linked pull requests
    const linkedPrUrls = event.source.issue.body.replace(/<!--[\s\S]+-->/, "").match(linkedIssueRegex);
    if (!linkedPrUrls) {
      return false;
    }
    let isClosingPr = false;
    for (const linkedPrUrl of linkedPrUrls) {
      const idx = linkedPrUrl.indexOf("#");
      if (idx !== -1) {
        isClosingPr = Number(linkedPrUrl.slice(idx + 1)) === issue.issue_number;
      } else {
        const url = linkedPrUrl.match(/https.+/)?.[0];
        if (url) {
          const linkedRepo = parseGitHubUrl(url);
          isClosingPr =
            linkedRepo.issue_number === issue.issue_number &&
            linkedRepo.repo === issue.repo &&
            linkedRepo.owner === issue.owner;
        }
      }
      if (isClosingPr) break;
    }
    return isGitHubLinkEvent(event) && event.source.issue.pull_request?.merged_at && isClosingPr;
  });
}
export async function collectLinkedPulls(issue: IssueParams) {
  // this one was created to help with tests, but probably should not be used in the main code
  const issueLinkEvents = await getLinkedEvents(issue);
  const onlyConnected = eliminateDisconnects(issueLinkEvents);
  return onlyConnected.filter((event) => isGitHubLinkEvent(event) && event.source.issue.pull_request);
}

function eliminateDisconnects(issueLinkEvents: GitHubLinkEvent[]) {
  // Track connections and disconnections
  const connections = new Map<number, GitHubLinkEvent>(); // Use issue/pr number as key for easy access
  const disconnections = new Map<number, GitHubLinkEvent>(); // Track disconnections

  issueLinkEvents.forEach((issueEvent: GitHubLinkEvent) => {
    const issueNumber = issueEvent.source.issue.number as number;

    if (issueEvent.event === "connected" || issueEvent.event === "cross-referenced") {
      // Only add to connections if there is no corresponding disconnected event
      if (!disconnections.has(issueNumber)) {
        connections.set(issueNumber, issueEvent);
      }
    } else if (issueEvent.event === "disconnected") {
      disconnections.set(issueNumber, issueEvent);
      // If a disconnected event is found, remove the corresponding connected event
      if (connections.has(issueNumber)) {
        connections.delete(issueNumber);
      }
    }
  });

  return Array.from(connections.values());
}

async function getLinkedEvents(params: IssueParams): Promise<GitHubLinkEvent[]> {
  const issueEvents = await getAllTimelineEvents(params);
  return issueEvents.filter(isGitHubLinkEvent);
}
