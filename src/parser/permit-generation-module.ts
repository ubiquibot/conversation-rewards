import { context } from "@actions/github";
import { Value } from "@sinclair/typebox/value";
import { createClient } from "@supabase/supabase-js";
import {
  Context,
  createAdapters,
  Database,
  encodePermits,
  generatePayoutPermit,
  PermitReward,
  SupportedEvents,
  TokenType,
} from "@ubiquibot/permit-generation/core";
import Decimal from "decimal.js";
import configuration from "../configuration/config-reader";
import {
  PermitGenerationConfiguration,
  permitGenerationConfigurationType,
} from "../configuration/permit-generation-configuration";
import { getOctokitInstance } from "../get-authentication-token";
import { IssueActivity } from "../issue-activity";
import { getRepo, parseGitHubUrl } from "../start";
import envConfigSchema, { EnvConfigType } from "../types/env-type";
import program from "./command-line";
import { Module, Result } from "./processor";

interface Payload {
  evmNetworkId: number;
  issueUrl: string;
  evmPrivateEncrypted: string;
  erc20RewardToken: string;
  issue: { id: number };
}

export class PermitGenerationModule implements Module {
  readonly _configuration: PermitGenerationConfiguration | null = configuration.incentives.permitGeneration;
  readonly _supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const payload: Context["payload"] & Payload = {
      ...context.payload.inputs,
      issueUrl: program.eventPayload.issue.html_url,
      evmPrivateEncrypted: configuration.evmPrivateEncrypted,
      evmNetworkId: configuration.evmNetworkId,
      erc20RewardToken: configuration.erc20RewardToken,
    };
    const issueId = Number(payload.issueUrl.match(/[0-9]+$/)?.[0]);
    payload.issue = {
      id: issueId,
    };
    const env = Value.Default(envConfigSchema, process.env) as EnvConfigType;
    if (!Value.Check(envConfigSchema, env)) {
      console.warn("[PermitGenerationModule] Invalid env detected, skipping.");
      return Promise.resolve(result);
    }
    const eventName = context.eventName as SupportedEvents;
    const octokit = getOctokitInstance();
    const logger = {
      debug() {},
      error(message: unknown, optionalParams: unknown) {
        console.error(message, optionalParams);
      },
      fatal(message: unknown, optionalParams: unknown) {
        console.error(message, optionalParams);
      },
      info() {},
      warn(message: unknown, optionalParams: unknown) {
        console.warn(message, optionalParams);
      },
    };
    const adapters = {} as ReturnType<typeof createAdapters>;

    // apply fees
    result = await this._applyFees(result, payload.erc20RewardToken);

    for (const [key, value] of Object.entries(result)) {
      try {
        const config: Context["config"] = {
          evmNetworkId: payload.evmNetworkId,
          evmPrivateEncrypted: payload.evmPrivateEncrypted,
          permitRequests: [
            {
              amount: value.total,
              username: key,
              contributionType: "",
              type: TokenType.ERC20,
              tokenAddress: payload.erc20RewardToken,
            },
          ],
        };
        const permits = await generatePayoutPermit(
          {
            env,
            eventName,
            logger,
            payload,
            adapters: createAdapters(this._supabase, {
              env,
              eventName,
              octokit,
              config,
              logger,
              payload,
              adapters,
            }),
            octokit,
            config,
          },
          config.permitRequests
        );
        result[key].permitUrl = `https://pay.ubq.fi?claim=${encodePermits(permits)}`;
        await this._savePermitsToDatabase(result[key].userId, { issueUrl: payload.issueUrl, issueId }, permits);
      } catch (e) {
        console.error(e);
      }
    }

    // remove treasury item from final result in order not to display permit fee in github comments
    if (process.env.PERMIT_TREASURY_GITHUB_USERNAME) delete result[process.env.PERMIT_TREASURY_GITHUB_USERNAME];

    return result;
  }

  /**
   * Applies fees to the final result.
   * How it works:
   * 1. Fee (read from ENV variable) is subtracted from all of the final result items (user.total, user.task.reward, user.comments[].reward)
   * 2. Total fee is calculated
   * 3. A new item is added to the final result object, example:
   * ```
   * {
   *   ...other items
   *   "ubiquibot-treasury": {
   *     total: 10.00,
   *     userId: 1
   *   }
   * }
   * ```
   * This method is meant to be called before the final permit generation.
   * @param result Result object
   * @param erc20RewardToken ERC20 address of the reward token
   * @returns Result object
   */
  async _applyFees(result: Result, erc20RewardToken: string): Promise<Result> {
    // validate fee related env variables
    if (!process.env.PERMIT_FEE_RATE || +process.env.PERMIT_FEE_RATE === 0) {
      console.log("PERMIT_FEE_RATE is not set, skipping permit fee generation");
      return result;
    }
    if (!process.env.PERMIT_TREASURY_GITHUB_USERNAME) {
      console.log("PERMIT_TREASURY_GITHUB_USERNAME is not set, skipping permit fee generation");
      return result;
    }
    if (process.env.PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST) {
      const erc20TokensNoFee = process.env.PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST.split(",");
      if (erc20TokensNoFee.includes(erc20RewardToken)) {
        console.log(`Token address ${erc20RewardToken} is whitelisted to be fee free, skipping permit fee generation`);
        return result;
      }
    }

    // Get treasury github user id
    const octokit = getOctokitInstance();
    const { data: treasuryGithubData } = await octokit.users.getByUsername({
      username: process.env.PERMIT_TREASURY_GITHUB_USERNAME,
    });
    if (!treasuryGithubData) {
      console.log(
        `GitHub user was not found for username ${process.env.PERMIT_TREASURY_GITHUB_USERNAME}, skipping permit fee generation`
      );
      return result;
    }

    // Subtract fees from the final result:
    // - user.total
    // - user.task.reward
    // - user.comments[].reward
    const feeRateDecimal = new Decimal(100).minus(process.env.PERMIT_FEE_RATE).div(100);
    let permitFeeAmountDecimal = new Decimal(0);
    for (const [_, rewardResult] of Object.entries(result)) {
      // accumulate total permit fee amount
      const totalAfterFee = +new Decimal(rewardResult.total).mul(feeRateDecimal);
      permitFeeAmountDecimal = permitFeeAmountDecimal.add(new Decimal(rewardResult.total).minus(totalAfterFee));
      // subtract fees
      rewardResult.total = +totalAfterFee.toFixed(2);
      if (rewardResult.task)
        rewardResult.task.reward = +new Decimal(rewardResult.task.reward).mul(feeRateDecimal).toFixed(2);
      if (rewardResult.comments) {
        for (let comment of rewardResult.comments) {
          if (comment.score) comment.score.reward = +new Decimal(comment.score.reward).mul(feeRateDecimal).toFixed(2);
        }
      }
    }

    // Add a new result item for treasury
    result[process.env.PERMIT_TREASURY_GITHUB_USERNAME] = {
      total: +permitFeeAmountDecimal.toFixed(2),
      userId: treasuryGithubData.id,
    };

    return result;
  }

  async _getOrCreateIssueLocation(issue: { issueId: number; issueUrl: string }) {
    let locationId: number | null = null;

    const { data: locationData } = await this._supabase
      .from("locations")
      .select("id")
      .eq("issue_id", issue.issueId)
      .eq("node_url", issue.issueUrl)
      .single();

    if (!locationData) {
      const issueItem = await getRepo(parseGitHubUrl(issue.issueUrl));
      const { data: newLocationData, error } = await this._supabase
        .from("locations")
        .insert({
          node_url: issue.issueUrl,
          issue_id: issue.issueId,
          node_type: "Issue",
          repository_id: issueItem.id,
        })
        .select("id")
        .single();
      if (!newLocationData || error) {
        console.error("Failed to create a new location", error);
      } else {
        locationId = newLocationData.id;
      }
    } else {
      locationId = locationData.id;
    }
    if (!locationId) {
      throw new Error(`Failed to retrieve the related location from issue ${issue}`);
    }
    return locationId;
  }

  async _savePermitsToDatabase(userId: number, issue: { issueId: number; issueUrl: string }, permits: PermitReward[]) {
    for (const permit of permits) {
      try {
        const { data: userData } = await this._supabase.from("users").select("id").eq("id", userId).single();
        const locationId = await this._getOrCreateIssueLocation(issue);

        if (userData) {
          const { error } = await this._supabase.from("permits").insert({
            amount: permit.amount.toString(),
            nonce: permit.nonce.toString(),
            deadline: permit.deadline.toString(),
            signature: permit.signature,
            beneficiary_id: userData.id,
            location_id: locationId,
          });
          if (error) {
            console.error("Failed to insert a new permit", error);
          }
        } else {
          console.error(`Failed to save the permit: could not find user ${userId}`);
        }
      } catch (e) {
        console.error("Failed to save permits to the database", e);
      }
    }
  }

  get enabled(): boolean {
    if (!Value.Check(permitGenerationConfigurationType, this._configuration)) {
      console.warn("Invalid / missing configuration detected for PermitGenerationModule, disabling.");
      return false;
    }
    return true;
  }
}
