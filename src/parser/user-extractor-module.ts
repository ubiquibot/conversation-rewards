import { Value } from "@sinclair/typebox/value";
import Decimal from "decimal.js";
import configuration from "../configuration/config-reader";
import { UserExtractorConfiguration, userExtractorConfigurationType } from "../configuration/user-extractor-config";
import { GitHubIssue } from "../github-types";
import { getSortedPrices } from "../helpers/label-price-extractor";
import { IssueActivity } from "../issue-activity";
import { Module, Result } from "./processor";

/**
 * Creates entries for each user with its associated comments.
 */
export class UserExtractorModule implements Module {
  private readonly _configuration: UserExtractorConfiguration | null = configuration.incentives.userExtractor;

  get enabled(): boolean {
    if (!Value.Check(userExtractorConfigurationType, this._configuration)) {
      console.warn("Invalid / missing configuration detected for UserExtractorModule, disabling.");
      return false;
    }
    return true;
  }

  /**
   * Checks if the comment is made by a human user, not empty, and not a command.
   */
  _checkEntryValidity(comment: (typeof IssueActivity.prototype.allComments)[0]) {
    return comment.body && comment.user?.type === "User" && comment.body.trim()[0] !== "/";
  }

  /**
   * Gets the price from the labels, except if the configuration disables the redeem
   */
  _extractTaskPrice(issue: GitHubIssue) {
    if (this._configuration?.redeemTask === false) {
      return 0;
    }
    const sortedPriceLabels = getSortedPrices(issue.labels);
    if (!sortedPriceLabels.length) {
      console.warn("There are no price labels in this repository.");
      return 0;
    }
    return sortedPriceLabels[0];
  }

  _getTaskMultiplier(issue: GitHubIssue) {
    return new Decimal(1).div(issue.assignees?.length || 1);
  }

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    // First, try to add all assignees as they didn't necessarily add a comment but should receive a reward
    data.self?.assignees?.forEach((assignee) => {
      const task = data.self
        ? {
            reward: new Decimal(this._extractTaskPrice(data.self)).mul(this._getTaskMultiplier(data.self)).toFixed(2),
            multiplier: this._getTaskMultiplier(data.self).toNumber(),
          }
        : undefined;
      result[assignee.login] = {
        ...result[assignee.login],
        userId: assignee.id,
        total: 0,
        task,
      };
    });
    for (const comment of data.allComments) {
      if (comment.user && comment.body && this._checkEntryValidity(comment)) {
        result[comment.user.login] = {
          ...result[comment.user.login],
          total: 0,
          userId: comment.user.id,
        };
      }
    }
    return result;
  }
}
