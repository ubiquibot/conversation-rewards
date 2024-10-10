import configuration from "./configuration/config-reader";
import { collectLinkedMergedPulls } from "./data-collection/collect-linked-pulls";
import { GITHUB_PAYLOAD_LIMIT } from "./helpers/constants";
import githubCommentModuleInstance from "./helpers/github-comment-module-instance";
import { getSortedPrices } from "./helpers/label-price-extractor";
import logger from "./helpers/logger";
import { returnDataToKernel } from "./helpers/validator";
import { IssueActivity } from "./issue-activity";
import { getOctokitInstance } from "./octokit";
import program from "./parser/command-line";
import { Processor, Result } from "./parser/processor";
import { parseGitHubUrl } from "./start";

export async function run() {
  const { eventPayload, eventName, stateId } = program;
  if (eventName === "issues.closed") {
    if (eventPayload.issue.state_reason !== "completed") {
      return logger.info("Issue was not closed as completed. Skipping.").logMessage.raw;
    }
    if (!(await preCheck())) {
      const result = logger.error("All linked pull requests must be closed to generate rewards.");
      await githubCommentModuleInstance.postComment(result.logMessage.diff);
      return result.logMessage.raw;
    }
    await githubCommentModuleInstance.postComment(logger.ok("Evaluating results. Please wait...").logMessage.diff);
    const issue = parseGitHubUrl(eventPayload.issue.html_url);
    const activity = new IssueActivity(issue);
    await activity.init();
    if (configuration.incentives.requirePriceLabel && !getSortedPrices(activity.self?.labels).length) {
      const result = logger.error("No price label has been set. Skipping permit generation.");
      await githubCommentModuleInstance.postComment(result.logMessage.diff);
      return result.logMessage.raw;
    }
    const processor = new Processor();
    await processor.run(activity);
    let result = processor.dump();
    const zeroFilterResult = resultFilter(result);
    result = zeroFilterResult;
    if (result.length > GITHUB_PAYLOAD_LIMIT) {
      const resultObject = JSON.parse(result) as Result;
      for (const [key, value] of Object.entries(resultObject)) {
        resultObject[key] = {
          userId: value.userId,
          task: value.task,
          permitUrl: value.permitUrl,
          total: value.total,
        };
      }
      result = JSON.stringify(resultObject);
    }
    await returnDataToKernel(process.env.GITHUB_TOKEN, stateId, { result });
    return result;
  } else {
    return logger.error(`${eventName} is not supported, skipping.`).logMessage.raw;
  }
}

async function preCheck() {
  const { eventPayload } = program;

  const issue = parseGitHubUrl(eventPayload.issue.html_url);
  const linkedPulls = await collectLinkedMergedPulls(issue);
  logger.debug("Checking open linked pull-requests for", {
    issue,
    linkedPulls,
  });
  if (linkedPulls.some((linkedPull) => linkedPull.state === "OPEN")) {
    await getOctokitInstance().rest.issues.update({
      owner: issue.owner,
      repo: issue.repo,
      issue_number: issue.issue_number,
      state: "open",
    });
    return false;
  }
  return true;
}

function resultFilter(result: string) {
  // remove 0 total from github comment
  const parsedResult = JSON.parse(result) as Result;
  const filterCheckKeys = Object.keys(parsedResult).filter((value) => parsedResult[value].total <= 0);
  if (filterCheckKeys.length > 0) {
    for (const key of filterCheckKeys) {
      delete parsedResult[key];
    }
    return JSON.stringify(parsedResult);
  }
  return result;
}
