import { Value } from "@sinclair/typebox/value";
import Decimal from "decimal.js";
import * as fs from "fs";
import { stringify } from "yaml";
import configuration from "../configuration/config-reader";
import githubCommentConfig, { GithubCommentConfiguration } from "../configuration/github-comment-config";
import { getOctokitInstance } from "../get-authentication-token";
import { CommentType, IssueActivity } from "../issue-activity";
import { parseGitHubUrl } from "../start";
import { getPayoutConfigByNetworkId } from "../types/payout";
import program from "./command-line";
import { GithubCommentScore, Module, Result } from "./processor";

/**
 * Posts a GitHub comment according to the given results.
 */
export class GithubCommentModule implements Module {
  private readonly _configuration: GithubCommentConfiguration = configuration.githubComment;
  private readonly _debugFilePath = "./output.html";

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const bodyArray: (string | undefined)[] = [];

    for (const [key, value] of Object.entries(result)) {
      result[key].evaluationCommentHtml = this._generateHtml(key, value);
      bodyArray.push(result[key].evaluationCommentHtml);
    }
    const body = bodyArray.join("");
    if (this._configuration.debug) {
      fs.writeFileSync(this._debugFilePath, body);
    }
    if (this._configuration.post) {
      try {
        const octokit = getOctokitInstance();
        const { owner, repo, issue_number } = parseGitHubUrl(program.opts().issue);

        await octokit.issues.createComment({
          body,
          repo,
          owner,
          issue_number,
        });
      } catch (e) {
        console.error(`Could not post GitHub comment: ${e}`);
      }
    }
    return Promise.resolve(result);
  }

  get enabled(): boolean {
    if (!Value.Check(githubCommentConfig, this._configuration)) {
      console.warn("Invalid configuration detected for GithubContentModule, disabling.");
      return false;
    }
    return true;
  }

  _generateHtml(username: string, result: Result[0]) {
    const sorted = result.comments?.reduce<{
      issues: { task: GithubCommentScore | null; comments: GithubCommentScore[] };
      reviews: GithubCommentScore[];
    }>(
      (acc, curr) => {
        if (curr.type & CommentType.ISSUE) {
          if (curr.type & CommentType.TASK) {
            acc.issues.task = curr;
          } else {
            acc.issues.comments.push(curr);
          }
        } else if (curr.type & CommentType.REVIEW) {
          acc.reviews.push(curr);
        }
        return acc;
      },
      { issues: { task: null, comments: [] }, reviews: [] }
    );

    function createContributionRows() {
      const content: string[] = [];

      if (!sorted) {
        return content.join("");
      }

      function generateContributionRow(
        view: string,
        contribution: string,
        count: number,
        reward: number | Decimal | undefined
      ) {
        return `
          <tr>
            <td>${view}</td>
            <td>${contribution}</td>
            <td>${count}</td>
            <td>${reward || "-"}</td>
          </tr>`;
      }

      if (result.task?.reward) {
        content.push(generateContributionRow("Issue", "Task", 1, result.task.reward));
      }
      if (sorted.issues.task) {
        content.push(generateContributionRow("Issue", "Specification", 1, sorted.issues.task.score?.reward));
      }
      if (sorted.issues.comments.length) {
        content.push(
          generateContributionRow(
            "Issue",
            "Comment",
            sorted.issues.comments.length,
            sorted.issues.comments.reduce((acc, curr) => acc.add(curr.score?.reward ?? 0), new Decimal(0))
          )
        );
      }
      if (sorted.reviews.length) {
        content.push(
          generateContributionRow(
            "Review",
            "Comment",
            sorted.reviews.length,
            sorted.reviews.reduce((acc, curr) => acc.add(curr.score?.reward ?? 0), new Decimal(0))
          )
        );
      }
      return content.join("");
    }

    function createIncentiveRows() {
      const content: string[] = [];

      if (!sorted) {
        return content.join("");
      }

      function buildIncentiveRow(commentScore: GithubCommentScore) {
        // Properly escape carriage returns for HTML rendering
        const formatting = stringify(commentScore.score?.formatting?.content).replace(/[\n\r]/g, "&#13;");
        // Makes sure any HTML injected in the templated is not rendered itself
        const sanitizedContent = commentScore.content.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        return `
          <tr>
            <td>
              <h6>
                <a href="${commentScore.url}" target="_blank" rel="noopener">${sanitizedContent.replace(/(.{64})..+/, "$1&hellip;")}</a>
              </h6>
            </td>
            <td>
            <details>
              <summary>
                ${Object.values(commentScore.score?.formatting?.content || {}).reduce((acc, curr) => {
                  return acc.add(curr.score * curr.count);
                }, new Decimal(0))}
              </summary>
              <pre>${formatting}</pre>
             </details>
            </td>
            <td>${commentScore.score?.relevance || "-"}</td>
            <td>${commentScore.score?.reward || "-"}</td>
          </tr>`;
      }

      for (const issueComment of sorted.issues.comments) {
        content.push(buildIncentiveRow(issueComment));
      }
      for (const reviewComment of sorted.reviews) {
        content.push(buildIncentiveRow(reviewComment));
      }
      return content.join("");
    }

    return `
    <details>
      <summary>
        <b>
          <h3>
            <a href="${result.permitUrl}" target="_blank" rel="noopener">
              [ ${result.total} ${getPayoutConfigByNetworkId(program.opts().evmNetworkId).symbol} ]
            </a>
          </h3>
          <h6>
            @${username}
          </h6>
        </b>
      </summary>
      <h6>Contributions Overview</h6>
      <table>
        <thead>
          <tr>
            <th>View</th>
            <th>Contribution</th>
            <th>Count</th>
            <th>Reward</th>
          </tr>
        </thead>
        <tbody>
          ${createContributionRows()}
        </tbody>
      </table>
      <h6>Conversation Incentives</h6>
      <table>
        <thead>
          <tr>
            <th>Comment</th>
            <th>Formatting</th>
            <th>Relevance</th>
            <th>Reward</th>
          </tr>
        </thead>
        <tbody>
          ${createIncentiveRows()}
        </tbody>
      </table>
    </details>
    `
      .replace(/\s+/g, " ")
      .trim();
  }
}
